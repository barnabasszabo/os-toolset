// Vékony, Promise-alapú HTTP réteg libsoup 3 fölött.
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

const session = new Soup.Session();

function readBody(message, bytes) {
    const data = bytes?.get_data();
    return data ? new TextDecoder().decode(data) : '';
}

// application/x-www-form-urlencoded POST -> JSON válasz.
export function postForm(url, params) {
    return new Promise((resolve, reject) => {
        const body = Object.entries(params)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
        const message = Soup.Message.new('POST', url);
        const bytes = new GLib.Bytes(new TextEncoder().encode(body));
        message.set_request_body_from_bytes('application/x-www-form-urlencoded', bytes);

        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (s, res) => {
            try {
                const resp = session.send_and_read_finish(res);
                const status = message.get_status();
                const text = readBody(message, resp);
                let json = null;
                try { json = JSON.parse(text); } catch (_) { /* nem JSON */ }
                if (status >= 200 && status < 300) {
                    resolve(json ?? {});
                } else {
                    const msg = (json && (json.error_description || json.error)) || `HTTP ${status}: ${text}`;
                    reject(new Error(msg));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

// Bearer-tokenes GET -> JSON válasz.
export function getJson(url, token) {
    return new Promise((resolve, reject) => {
        const message = Soup.Message.new('GET', url);
        const headers = message.get_request_headers();
        headers.append('Authorization', `Bearer ${token}`);
        headers.append('Accept', 'application/json');

        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (s, res) => {
            try {
                const resp = session.send_and_read_finish(res);
                const status = message.get_status();
                const text = readBody(message, resp);
                if (status >= 200 && status < 300) {
                    resolve(JSON.parse(text));
                } else {
                    reject(new Error(`HTTP ${status}: ${text}`));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}
