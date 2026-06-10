// OAuth 2.0 Authorization Code + PKCE (public client, loopback redirect).
// A tokeneket egy 0600-as JSON fájlban tároljuk: ~/.config/outlook-meetings/tokens.json
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

import * as Config from './config.js';
import {postForm} from './http.js';

function tokenDir() {
    return GLib.build_filenamev([GLib.get_user_config_dir(), 'outlook-meetings']);
}
function tokenPath() {
    return GLib.build_filenamev([tokenDir(), 'tokens.json']);
}

// --- PKCE segédfüggvények ---
function randomUrlSafe(byteLen) {
    const bytes = new Uint8Array(byteLen);
    for (let i = 0; i < byteLen; i++)
        bytes[i] = GLib.random_int_range(0, 256);
    return GLib.base64_encode(bytes)
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pkceChallenge(verifier) {
    const hex = GLib.compute_checksum_for_bytes(
        GLib.ChecksumType.SHA256,
        new GLib.Bytes(new TextEncoder().encode(verifier)));
    const raw = new Uint8Array(hex.length / 2);
    for (let i = 0; i < raw.length; i++)
        raw[i] = parseInt(hex.substr(i * 2, 2), 16);
    return GLib.base64_encode(raw)
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildQuery(params) {
    return Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
}

function parseQuery(qs) {
    const out = {};
    for (const pair of (qs || '').split('&')) {
        if (!pair) continue;
        const idx = pair.indexOf('=');
        const k = decodeURIComponent(idx < 0 ? pair : pair.slice(0, idx));
        const v = idx < 0 ? '' : decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
        out[k] = v;
    }
    return out;
}

export class OAuth {
    // Lemezre mentett tokenek beolvasása (vagy null).
    _load() {
        try {
            const file = Gio.File.new_for_path(tokenPath());
            if (!file.query_exists(null)) return null;
            const [ok, contents] = file.load_contents(null);
            if (!ok) return null;
            return JSON.parse(new TextDecoder().decode(contents));
        } catch (e) {
            logError(e, 'OutlookMeetings: token beolvasás sikertelen');
            return null;
        }
    }

    // Token-válasz mentése. A refresh_token-t megtartjuk, ha az új válasz nem ad újat.
    _store(resp, prevRefresh) {
        const now = Math.floor(GLib.get_real_time() / 1000000); // epoch másodperc
        const data = {
            access_token: resp.access_token,
            refresh_token: resp.refresh_token || prevRefresh || null,
            expires_at: now + (resp.expires_in ? Number(resp.expires_in) : 3600),
            scope: resp.scope || Config.SCOPES.join(' '),
        };
        try {
            GLib.mkdir_with_parents(tokenDir(), 0o700);
            const file = Gio.File.new_for_path(tokenPath());
            file.replace_contents(
                new TextEncoder().encode(JSON.stringify(data)),
                null, false,
                Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION,
                null);
        } catch (e) {
            logError(e, 'OutlookMeetings: token mentés sikertelen');
        }
        return data;
    }

    logout() {
        try {
            const file = Gio.File.new_for_path(tokenPath());
            if (file.query_exists(null)) file.delete(null);
        } catch (e) {
            logError(e, 'OutlookMeetings: kijelentkezés sikertelen');
        }
    }

    isAuthenticated() {
        const t = this._load();
        return !!(t && (t.access_token || t.refresh_token));
    }

    // Érvényes access token, szükség esetén refresh_token-nel megújítva. null, ha be kell jelentkezni.
    async getAccessToken() {
        const t = this._load();
        if (!t) return null;
        const now = Math.floor(GLib.get_real_time() / 1000000);
        if (t.access_token && t.expires_at && t.expires_at - 60 > now)
            return t.access_token;

        if (t.refresh_token) {
            const resp = await postForm(Config.TOKEN_URL, {
                grant_type: 'refresh_token',
                client_id: Config.CLIENT_ID,
                refresh_token: t.refresh_token,
                scope: Config.SCOPES.join(' '),
            });
            const stored = this._store(resp, t.refresh_token);
            return stored.access_token;
        }
        return null;
    }

    // Teljes interaktív bejelentkezés: böngésző megnyitása + loopback szerver a kód elkapásához.
    login() {
        return new Promise((resolve, reject) => {
            const verifier = randomUrlSafe(48);
            const challenge = pkceChallenge(verifier);
            const state = randomUrlSafe(16);

            const server = new Soup.Server();
            let settled = false;
            const finish = (fn, arg) => {
                if (settled) return;
                settled = true;
                try { server.disconnect(); } catch (_) {}
                fn(arg);
            };

            server.add_handler('/', (srv, msg) => {
                const query = msg.get_uri().get_query();
                const params = parseQuery(query);
                const html = `<!DOCTYPE html><html lang="hu"><head><meta charset="utf-8">
<title>Outlook Meetings</title></head>
<body style="font-family:sans-serif;text-align:center;margin-top:18vh">
<h2>${params.error ? 'Bejelentkezés sikertelen' : 'Bejelentkezés kész ✅'}</h2>
<p>Visszatérhetsz a panelhez, ez az ablak bezárható.</p></body></html>`;
                msg.set_response('text/html; charset=utf-8',
                    Soup.MemoryUse.COPY, new TextEncoder().encode(html));
                msg.set_status(200, null);

                if (params.error) {
                    finish(reject, new Error(params.error_description || params.error));
                } else if (params.code) {
                    // A kód beváltása token-re.
                    postForm(Config.TOKEN_URL, {
                        grant_type: 'authorization_code',
                        client_id: Config.CLIENT_ID,
                        code: params.code,
                        redirect_uri: Config.REDIRECT_URI,
                        code_verifier: verifier,
                    }).then(resp => {
                        this._store(resp, null);
                        finish(resolve, true);
                    }).catch(e => finish(reject, e));
                } else {
                    finish(reject, new Error('Nem érkezett auth kód.'));
                }
            });

            try {
                server.listen_local(Config.REDIRECT_PORT, Soup.ServerListenOptions.IPV4_ONLY);
            } catch (e) {
                reject(new Error(`Nem sikerült a ${Config.REDIRECT_PORT} portra figyelni: ${e.message}`));
                return;
            }

            const authUrl = `${Config.AUTHORIZE_URL}?${buildQuery({
                client_id: Config.CLIENT_ID,
                response_type: 'code',
                redirect_uri: Config.REDIRECT_URI,
                response_mode: 'query',
                scope: Config.SCOPES.join(' '),
                code_challenge: challenge,
                code_challenge_method: 'S256',
                state,
            })}`;

            try {
                Gio.AppInfo.launch_default_for_uri(authUrl, null);
            } catch (e) {
                finish(reject, new Error(`Nem sikerült megnyitni a böngészőt: ${e.message}`));
                return;
            }

            // Biztonsági időkorlát: 3 perc.
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 180, () => {
                finish(reject, new Error('Időtúllépés a bejelentkezésnél.'));
                return GLib.SOURCE_REMOVE;
            });
        });
    }
}
