const { PublicClientApplication, CryptoProvider } = require('@azure/msal-node');
const { BrowserWindow, ipcMain, app } = require('electron');
const http = require('http');
const path = require('path');
const https = require('https');
const fs = require('fs');
const msalConfig = require('./msal-config');
const DateUtils = require('./date-utils');

const AUTH_STATE_FILE = path.join(app.getPath('userData'), 'auth-state.json');

// Try to use persistent cache if available
let cachePluginPromise = null;
try {
  const { PersistenceCreator, PersistenceCachePlugin } = require('@azure/msal-node-extensions');
  const cachePath = path.join(app.getPath('userData'), 'msal-cache.json');
  cachePluginPromise = PersistenceCreator.createPersistence({
    cachePath: cachePath,
    dataProtectionScope: 'CurrentUser',
    serviceName: 'win-widget',
    accountName: 'msal-cache'
  }).then(persistence => {
    return new PersistenceCachePlugin(persistence);
  }).catch(err => {
    console.log('Could not create persistent cache plugin:', err.message);
    return null;
  });
} catch (err) {
  console.log('MSAL extensions not available, using in-memory cache');
}

const cryptoProvider = new CryptoProvider();
const REDIRECT_URI = 'http://localhost:4200/';

// SPA flow: a token beváltás a böngészőben (cross-origin) történik, nem a main processben
let localServer = null;
let currentLoginResolve = null;
let currentLoginReject = null;
let currentLoginVerifier = null;
let authWindowRef = null;
let loginResolved = false;

function getTokenUrl() {
  const tenant = msalConfig.auth.authority.replace(/\/$/, '').split('/').pop();
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
}

function buildAccountFromTokenResponse(data) {
  let username = 'unknown';
  let name = '';
  let oid = '';
  if (data.id_token) {
    try {
      const b64 = data.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(b64, 'base64').toString());
      username = payload.preferred_username || payload.upn || username;
      name = payload.name || '';
      oid = payload.sub || payload.oid || '';
    } catch (e) {
      /* ignore */
    }
  }
  return { username, name, oid };
}

function saveAuthState(accessToken, account, expiresAt) {
  try {
    const state = {
      accessToken,
      account,
      expiresAt: expiresAt ? (expiresAt instanceof Date ? expiresAt.getTime() : DateUtils.toDate(expiresAt).getTime()) : null
    };
    fs.writeFileSync(AUTH_STATE_FILE, JSON.stringify(state), 'utf8');
  } catch (error) {
    console.error('Error saving auth state:', error);
  }
}

function loadAuthState() {
  try {
    if (fs.existsSync(AUTH_STATE_FILE)) {
      const data = fs.readFileSync(AUTH_STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      // Check if token is still valid (not expired)
      if (state.expiresAt) {
        const expiresAtDate = new Date(state.expiresAt);
        const now = DateUtils.toDate(DateUtils.now());
        if (expiresAtDate > now) {
          return state;
        }
      }
      // Token expired, delete the file
      fs.unlinkSync(AUTH_STATE_FILE);
    }
  } catch (error) {
    console.error('Error loading auth state:', error);
  }
  return null;
}

function deleteAuthState() {
  try {
    if (fs.existsSync(AUTH_STATE_FILE)) {
      fs.unlinkSync(AUTH_STATE_FILE);
    }
  } catch (error) {
    console.error('Error deleting auth state:', error);
  }
}

function cleanup() {
  currentLoginResolve = null;
  currentLoginReject = null;
  currentLoginVerifier = null;
  authWindowRef = null;
}

function ensureServerRunning() {
  if (localServer) return;
  localServer = http.createServer((req, res) => {
    const [pathPart, queryPart] = (req.url || '/').split('?');
    const params = new URLSearchParams(queryPart || '');
    const code = params.get('code');
    const error = params.get('error');
    const errorDesc = params.get('error_description');

    const tokenUrl = getTokenUrl();
    const clientId = msalConfig.auth.clientId;

    if (error) {
      const errMsg = errorDesc || error || 'Ismeretlen hiba';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html><html><body><p>Bejelentkezés megszakítva.</p>
        <script>
          if (window.authCallback) window.authCallback.sendError(${JSON.stringify(errMsg)});
        </script></body></html>
      `);
      return;
    }

    if (code) {
      if (!currentLoginVerifier) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html><html><body><p>Nincs függőben lévő bejelentkezés.</p>
          <script>
            if (window.authCallback) window.authCallback.sendError('No pending login');
          </script></body></html>
        `);
        return;
      }
      const codeVerifier = currentLoginVerifier;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body><p>Bejelentkezés befejezése…</p>
<script>
(function(){
  var params = new URLSearchParams(window.location.search);
  var code = params.get('code');
  if (!code) { if (window.authCallback) window.authCallback.sendError('Nincs kód'); return; }
  var tokenUrl = ${JSON.stringify(tokenUrl)};
  var clientId = ${JSON.stringify(clientId)};
  var redirectUri = ${JSON.stringify(REDIRECT_URI)};
  var codeVerifier = ${JSON.stringify(codeVerifier)};
  fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if (d.access_token && window.authCallback) window.authCallback.sendTokens(d);
    else if (window.authCallback) window.authCallback.sendError(d.error_description || d.error || 'Token hiba');
  })
  .catch(function(e){ if (window.authCallback) window.authCallback.sendError(e.message); });
})();
</script></body></html>
      `);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });
  localServer.listen(4200, 'localhost', () => {});
}

function registerIpcHandlers(service) {
  ipcMain.on('auth:callback-tokens', (e, data) => {
    if (!currentLoginResolve) return;
    loginResolved = true;
    try {
      service.accessToken = data.access_token;
      service.userInfo = null;
      const account = buildAccountFromTokenResponse(data);
      service.accounts = [account];
      
      // Calculate token expiration (typically 1 hour, but use refresh_token expiry if available)
      let expiresAt = DateUtils.now();
      if (data.expires_in) {
        expiresAt = DateUtils.addMinutes(expiresAt, Math.floor(data.expires_in / 60));
      } else {
        // Default to 1 hour if not specified
        expiresAt = DateUtils.addHours(expiresAt, 1);
      }
      const expiresAtDate = DateUtils.toDate(expiresAt);
      
      // Save auth state to file
      saveAuthState(data.access_token, account, expiresAtDate);
      
      currentLoginResolve({
        success: true,
        account,
        accessToken: data.access_token
      });
    } catch (err) {
      currentLoginReject(err);
    }
    if (authWindowRef && !authWindowRef.isDestroyed()) authWindowRef.close();
    cleanup();
  });

  ipcMain.on('auth:callback-error', (e, msg) => {
    if (currentLoginReject) {
      loginResolved = true;
      currentLoginReject(new Error(msg));
    }
    if (authWindowRef && !authWindowRef.isDestroyed()) authWindowRef.close();
    cleanup();
  });
}

class AuthService {
  constructor() {
    this.accounts = [];
    this.accessToken = null;
    this.userInfo = null;
    this.pca = null;
    this.initialized = false;
    registerIpcHandlers(this);
    // Initialize MSAL with persistent cache if available (async)
    this.initMSAL();
  }

  async ensureInitialized() {
    // If already initialized, return immediately
    if (this.initialized) return;
    
    // If initialization is in progress, wait for it
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    
    // Start initialization
    this.initPromise = this.initMSAL();
    await this.initPromise;
  }

  async initMSAL() {
    if (this.initialized) return;
    
    const config = {
      auth: {
        clientId: msalConfig.auth.clientId,
        authority: msalConfig.auth.authority
      },
      system: msalConfig.system
    };

    // Try to add persistent cache plugin
    if (cachePluginPromise) {
      try {
        const plugin = await cachePluginPromise;
        if (plugin) {
          config.cache = {
            cachePlugin: plugin
          };
        }
      } catch (err) {
        console.log('Could not initialize cache plugin:', err.message);
      }
    }

    this.pca = new PublicClientApplication(config);
    
    // Try to restore login state on startup
    await this.initializeAuthState();
    
    this.initialized = true;
    this.initPromise = null;
  }

  async initializeAuthState() {
    try {
      // First try to load from file (SPA flow)
      const savedState = loadAuthState();
      if (savedState && savedState.accessToken && savedState.account) {
        // Check if token is still valid
        if (savedState.expiresAt) {
          const expiresAtDate = new Date(savedState.expiresAt);
          const now = DateUtils.toDate(DateUtils.now());
          if (expiresAtDate > now) {
            this.accessToken = savedState.accessToken;
            this.accounts = [savedState.account];
            console.log('Login state restored from file');
            
            // Notify renderer if window exists
            if (this.onStateRestored) {
              try {
                const userInfo = await this.getUserInfo();
                this.onStateRestored({
                  isAuthenticated: true,
                  account: savedState.account,
                  userInfo: userInfo
                });
              } catch (e) {
                // If getUserInfo fails, token might be expired, try to refresh
                console.log('Token might be expired, trying to refresh...');
                // Delete expired state and try MSAL cache
                deleteAuthState();
                this.accounts = [];
                this.accessToken = null;
              }
            }
            
            // If we successfully restored, return early
            if (this.accessToken) {
              return;
            }
          } else {
            // Token expired, delete the file
            deleteAuthState();
          }
        }
      }
      
      // Fallback: Try to get cached accounts from MSAL (if using MSAL flow)
      const accounts = await this.pca.getTokenCache().getAllAccounts();
      if (accounts.length > 0) {
        try {
          // Try to acquire token silently
          const result = await this.pca.acquireTokenSilent({
            scopes: msalConfig.scopes,
            account: accounts[0]
          });
          this.accessToken = result.accessToken;
          this.accounts = [result.account];
          console.log('Login state restored from MSAL cache');
          
          // Save to file for future use
          const expiresAt = DateUtils.addHours(DateUtils.now(), 1);
          const expiresAtDate = DateUtils.toDate(expiresAt);
          saveAuthState(result.accessToken, result.account, expiresAtDate);
          
          // Notify renderer if window exists
          if (this.onStateRestored) {
            try {
              const userInfo = await this.getUserInfo();
              this.onStateRestored({
                isAuthenticated: true,
                account: result.account,
                userInfo: userInfo
              });
            } catch (e) {
              // If getUserInfo fails, still notify with account
              this.onStateRestored({
                isAuthenticated: true,
                account: result.account,
                userInfo: null
              });
            }
          }
        } catch (silentError) {
          // Silent token acquisition failed, user needs to login again
          console.log('Could not restore login state:', silentError.message);
          this.accounts = [];
          this.accessToken = null;
        }
      }
    } catch (error) {
      console.error('Error initializing auth state:', error);
    }
  }
  
  setStateRestoredCallback(callback) {
    this.onStateRestored = callback;
  }

  async login() {
    await this.ensureInitialized();
    try {
      // First check if we have a valid saved token
      const savedState = loadAuthState();
      if (savedState && savedState.accessToken && savedState.account) {
        if (savedState.expiresAt) {
          const expiresAtDate = new Date(savedState.expiresAt);
          const now = DateUtils.toDate(DateUtils.now());
          if (expiresAtDate > now) {
            // Token is still valid
            this.accessToken = savedState.accessToken;
            this.accounts = [savedState.account];
            return { success: true, account: savedState.account, accessToken: savedState.accessToken };
          } else {
            // Token expired, delete it
            deleteAuthState();
          }
        }
      }
      
      // Try MSAL cache
      const accounts = await this.pca.getTokenCache().getAllAccounts();
      if (accounts.length > 0) {
        try {
          const result = await this.pca.acquireTokenSilent({
            scopes: msalConfig.scopes,
            account: accounts[0]
          });
          this.accessToken = result.accessToken;
          this.accounts = [result.account];
          
          // Save to file
          const expiresAt = DateUtils.addHours(DateUtils.now(), 1);
          const expiresAtDate = DateUtils.toDate(expiresAt);
          saveAuthState(result.accessToken, result.account, expiresAtDate);
          
          return { success: true, account: result.account, accessToken: result.accessToken };
        } catch (silentError) {
          /* interactive login */
        }
      }

      // SPA flow: auth URL + böngészőben token beváltás (cross-origin), PKCE
      const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
      currentLoginVerifier = verifier;
      loginResolved = false;
      ensureServerRunning();

      const scopes = ['openid', ...msalConfig.scopes];
      const authUrl = await this.pca.getAuthCodeUrl({
        scopes,
        redirectUri: REDIRECT_URI,
        codeChallenge: challenge,
        codeChallengeMethod: 'S256'
      });

      authWindowRef = new BrowserWindow({
        width: 500,
        height: 600,
        show: true,
        modal: false,
        webPreferences: {
          preload: path.join(__dirname, 'auth-preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      authWindowRef.loadURL(authUrl);

      return new Promise((resolve, reject) => {
        currentLoginResolve = resolve;
        currentLoginReject = reject;

        authWindowRef.on('closed', () => {
          if (!loginResolved) {
            loginResolved = true;
            reject(new Error('Authentication window was closed'));
          }
          cleanup();
        });
      });
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  async logout() {
    await this.ensureInitialized();
    try {
      if (this.accounts.length > 0) {
        try {
          await this.pca.getTokenCache().removeAccount(this.accounts[0]);
        } catch (e) {
          /* SPA flow esetén nincs MSAL cache */
        }
      }
      this.accounts = [];
      this.accessToken = null;
      this.userInfo = null;
      
      // Delete saved auth state
      deleteAuthState();
      
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  async getAccessToken() {
    await this.ensureInitialized();
    
    // Check if we have a saved token that's still valid
    const savedState = loadAuthState();
    if (savedState && savedState.accessToken) {
      if (savedState.expiresAt) {
        const expiresAtDate = new Date(savedState.expiresAt);
        const now = DateUtils.toDate(DateUtils.now());
        if (expiresAtDate > now) {
          // Token is still valid
          this.accessToken = savedState.accessToken;
          if (!this.accounts.length && savedState.account) {
            this.accounts = [savedState.account];
          }
          return this.accessToken;
        } else {
          // Token expired, delete it
          deleteAuthState();
        }
      }
    }
    
    // If we have an in-memory token, return it
    if (this.accessToken) return this.accessToken;
    
    // Try MSAL cache
    if (this.accounts.length > 0) {
      try {
        const result = await this.pca.acquireTokenSilent({
          scopes: msalConfig.scopes,
          account: this.accounts[0]
        });
        this.accessToken = result.accessToken;
        
        // Save to file
        const expiresAt = DateUtils.addHours(DateUtils.now(), 1);
        const expiresAtDate = DateUtils.toDate(expiresAt);
        saveAuthState(result.accessToken, result.account, expiresAtDate);
        
        return this.accessToken;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  async getUserInfo() {
    if (!this.userInfo && this.accessToken) {
      try {
        const url = new URL(msalConfig.graphEndpoints.me);
        const options = {
          hostname: url.hostname,
          path: url.pathname,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        };
        this.userInfo = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              if (res.statusCode === 200) {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${data}`));
              }
            });
          });
          req.on('error', reject);
          req.end();
        });
      } catch (error) {
        console.error('Get user info error:', error);
      }
    }
    return this.userInfo;
  }

  async getProfilePhoto() {
    const token = await this.getAccessToken();
    if (!token) return null;
    try {
      const url = new URL(msalConfig.graphEndpoints.mePhoto);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      };
      return await new Promise((resolve) => {
        const req = https.request(options, (res) => {
          if (res.statusCode === 404) { resolve(null); return; }
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            if (res.statusCode !== 200) { resolve(null); return; }
            const ct = (res.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
            const b64 = Buffer.concat(chunks).toString('base64');
            resolve(`data:${ct};base64,${b64}`);
          });
        });
        req.on('error', () => resolve(null));
        req.end();
      });
    } catch (e) {
      return null;
    }
  }

  isAuthenticated() {
    return this.accounts.length > 0 && this.accessToken !== null;
  }

  getAccount() {
    return this.accounts.length > 0 ? this.accounts[0] : null;
  }
}

module.exports = new AuthService();
