// MSAL Configuration for Electron
module.exports = {
  auth: {
    clientId: '5c64a3e4-41e4-4487-9246-7e9d735cce01',
    authority: 'https://login.microsoftonline.com/2f2b6561-0a3c-476e-9080-9dc1a1f3f486',
    // For Electron, we use a custom redirect URI
    redirectUri: 'http://localhost:4200/',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        if (!containsPii) {
          console.log(message);
        }
      },
      piiLoggingEnabled: false,
      logLevel: 'Info',
    },
  },
  // Scopes for Microsoft Graph API
  scopes: [
    'User.Read',
    'User.ReadBasic.All',
    'Calendars.Read',
    'Calendars.ReadBasic'
  ],
  // Graph API endpoints
  graphEndpoints: {
    me: 'https://graph.microsoft.com/v1.0/me',
    mePhoto: 'https://graph.microsoft.com/v1.0/me/photo/$value',
    users: 'https://graph.microsoft.com/v1.0/users/',
    calendarView: 'https://graph.microsoft.com/v1.0/me/calendarview'
  }
};
