export const environment = {
  production: true,
  apiUrl: 'https://expense-tracker-api.stockthinks.com/api',
  auth: {
    issuer: 'https://accounts.google.com',
    redirectUri: window.location.origin,
    scope: 'openid profile email',
    responseType: 'code',
    silentRefreshRedirectUri: window.location.origin + '/silent-refresh.html',
    useSilentRefresh: true,
    sessionChecksEnabled: true,
    showDebugInformation: false,
  },
};
