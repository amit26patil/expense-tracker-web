export const environment = {
  production: false,
  apiUrl: 'http://localhost:8003/api',
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
