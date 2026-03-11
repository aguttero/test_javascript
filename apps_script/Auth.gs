// =============================================================================
// Auth.gs  —  Adobe Sign OAuth2 Service
// Uses the Google Apps Script OAuth2 library (ID below)
// Library Script ID: 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF
// =============================================================================

/**
 * Returns a configured OAuth2 service for Adobe Sign.
 * Called before every API request.
 */
function getAdobeSignService_() {
  return OAuth2.createService('AdobeSign')
    .setAuthorizationBaseUrl(CONFIG.OAUTH_AUTH_URL)
    .setTokenUrl(CONFIG.OAUTH_TOKEN_URL)
    .setClientId(CONFIG.ADOBE_SIGN_CLIENT_ID)
    .setClientSecret(CONFIG.ADOBE_SIGN_CLIENT_SECRET)
    // Redirect URI — MUST match what you registered in Adobe Sign (Part 1, Step 5 of guide)
    // This is automatically set to: https://script.google.com/macros/d/{SCRIPT_ID}/usercallback
    .setCallbackFunction('authCallback')
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope('agreement_read:account user_login:self user_read:self')
    // Adobe Sign returns token as JSON
    .setTokenFormat(OAuth2.TOKEN_FORMAT.JSON)
    // Store refresh token — critical for unattended operation
    .setParam('access_type', 'offline')
    .setParam('prompt', 'consent');
}


/**
 * Handles the OAuth2 redirect callback from Adobe Sign.
 * Apps Script automatically routes /usercallback to this function.
 */
function authCallback(request) {
  const service = getAdobeSignService_();
  const authorized = service.handleCallback(request);
  if (authorized) {
    // Refresh and cache the base URI immediately after auth
    const baseUri = fetchBaseUri();
    if (baseUri) {
      PropertiesService.getScriptProperties().setProperty(CONFIG.BASE_URI_PROPERTY_KEY, baseUri);
    }
    return HtmlService.createHtmlOutput(
      '<h2 style="font-family:Arial;color:#1a73e8">✅ Authorization successful!</h2>' +
      '<p style="font-family:Arial">You can close this tab and return to Google Sheets.</p>'
    );
  } else {
    return HtmlService.createHtmlOutput(
      '<h2 style="font-family:Arial;color:#d93025">❌ Authorization denied.</h2>' +
      '<p style="font-family:Arial">Please try again. Check your scopes and redirect URI.</p>'
    );
  }
}


/**
 * Returns true if the service has a valid (non-expired) access token.
 */
function isAdobeSignAuthorized() {
  return getAdobeSignService_().hasAccess();
}


/**
 * Returns the authorization URL to open in a browser.
 * Log this and open it when setting up for the first time.
 */
function getAdobeSignAuthorizationUrl() {
  return getAdobeSignService_().getAuthorizationUrl();
}


/**
 * Returns the current access token (refreshes automatically if expired).
 * The OAuth2 library handles refresh transparently.
 */
function getAccessToken_() {
  const service = getAdobeSignService_();
  if (!service.hasAccess()) {
    throw new Error('Adobe Sign is not authorized. Run getAdobeSignAuthorizationUrl() and open the URL.');
  }
  return service.getAccessToken();
}


/**
 * Revokes the stored token — use when rotating credentials or troubleshooting.
 * After this, the user must re-authorize.
 */
function revokeAdobeSignAuth() {
  const service = getAdobeSignService_();
  // Call the Adobe Sign revoke endpoint before clearing local token
  if (service.hasAccess()) {
    try {
      UrlFetchApp.fetch(CONFIG.OAUTH_REVOKE_URL + '?token=' + service.getAccessToken(), {
        method: 'get',
        headers: { 'Authorization': 'Bearer ' + service.getAccessToken() },
        muteHttpExceptions: true
      });
    } catch(e) { Logger.log('Revoke call failed (non-critical): ' + e.message); }
  }
  service.reset();
  PropertiesService.getScriptProperties().deleteProperty(CONFIG.BASE_URI_PROPERTY_KEY);
  Logger.log('Adobe Sign authorization revoked. Re-run authorization flow to reconnect.');
}


/**
 * SETUP HELPER — Run this once to get the URL to paste in your browser.
 * Opens the auth URL in a dialog if running from Sheets UI.
 */
function authorizeAdobeSign() {
  const authUrl = getAdobeSignAuthorizationUrl();
  Logger.log('Open this URL to authorize Adobe Sign:\n' + authUrl);

  // If called from Sheets UI, show a dialog with the link
  try {
    const html = HtmlService.createHtmlOutput(
      '<p style="font-family:Arial;font-size:14px">Click the link below to authorize Adobe Sign:</p>' +
      '<a href="' + authUrl + '" target="_blank" style="font-family:Arial;font-size:14px">' +
      'Authorize Adobe Sign</a>' +
      '<p style="font-family:Arial;font-size:12px;color:#666">After authorizing, close this dialog.</p>'
    ).setWidth(450).setHeight(150);
    SpreadsheetApp.getUi().showModalDialog(html, 'Authorize Adobe Sign');
  } catch(e) {
    // Not running from Sheets UI — URL already logged above
  }
}
