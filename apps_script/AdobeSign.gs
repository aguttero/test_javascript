// =============================================================================
// AdobeSign.gs  —  Adobe Sign REST API v6 calls
// =============================================================================

/**
 * Fetches the API base URI for this account from Adobe Sign.
 * Must be called once after auth and cached in Script Properties.
 */
function fetchBaseUri() {
  const url = `https://api.${CONFIG.ADOBE_SIGN_SHARD}.adobesign.com/api/rest/v6/baseUris`;
  const response = adobeSignRequest_(url, 'GET');
  const data = JSON.parse(response.getContentText());
  if (!data.apiAccessPoint) throw new Error('baseUris response missing apiAccessPoint');
  // Strip trailing slash for consistent URL construction
  return data.apiAccessPoint.replace(/\/$/, '');
}


/**
 * Returns all SIGNED agreements since the given cursor (agreement ID).
 * Paginates automatically — handles accounts with many agreements.
 *
 * @param {string} baseUri  - API base URI from fetchBaseUri()
 * @param {string} cursor   - Last processed agreement ID ('' for all)
 * @returns {Array}         - Array of agreement objects {id, name, status, displayDate}
 */
function getSignedAgreements(baseUri, cursor) {
  const agreements = [];
  let nextCursor = null;
  const pageSize = 100; // Adobe Sign maximum

  do {
    let url = `${baseUri}/api/rest/v6/agreements?query=SIGNED&pageSize=${pageSize}`;
    if (nextCursor) url += '&cursor=' + encodeURIComponent(nextCursor);

    const response = adobeSignRequest_(url, 'GET');
    const data = JSON.parse(response.getContentText());
    const page = data.userAgreementList || [];

    for (const agreement of page) {
      // If we have a cursor, skip agreements up to and including it
      // Adobe Sign returns newest first, so we stop when we hit the cursor
      if (cursor && agreement.id === cursor) {
        nextCursor = null; // signal to stop paginating
        break;
      }
      agreements.push(agreement);
    }

    nextCursor = (data.page && data.page.nextCursor) || null;

    // Rate limit compliance: 5 req/sec max
    if (nextCursor) Utilities.sleep(250);

  } while (nextCursor);

  // Return in chronological order (oldest first) for consistent cursor advancement
  return agreements.reverse();
}


/**
 * Downloads the combined signed PDF for an agreement (with audit trail appended).
 *
 * @param {string} baseUri      - API base URI
 * @param {string} agreementId  - Adobe Sign agreement ID
 * @param {string} name         - Agreement name (used for blob filename)
 * @returns {Blob}              - PDF blob ready to save to Drive
 */
function downloadAgreementPdf(baseUri, agreementId, name) {
  const url = `${baseUri}/api/rest/v6/agreements/${agreementId}/combinedDocument` +
              `?attachAuditReport=true&attachSupportingDocuments=true`;

  const response = adobeSignRequest_(url, 'GET');

  if (response.getResponseCode() !== 200) {
    throw new Error(`PDF download failed: HTTP ${response.getResponseCode()} — ${response.getContentText()}`);
  }

  const blob = response.getBlob();
  blob.setContentType('application/pdf');
  blob.setName(name + '.pdf');
  return blob;
}


/**
 * Fetches full agreement metadata including participant events and timestamps.
 * Use this to supplement timestamp data from the PDF when needed.
 *
 * @param {string} baseUri
 * @param {string} agreementId
 * @returns {Object} Full agreement metadata JSON
 */
function getAgreementDetails(baseUri, agreementId) {
  const url = `${baseUri}/api/rest/v6/agreements/${agreementId}`;
  const response = adobeSignRequest_(url, 'GET');
  return JSON.parse(response.getContentText());
}


/**
 * Downloads the audit trail as a standalone PDF (fallback if combined doc fails).
 *
 * @param {string} baseUri
 * @param {string} agreementId
 * @returns {Blob} Audit trail PDF blob
 */
function downloadAuditTrail(baseUri, agreementId) {
  const url = `${baseUri}/api/rest/v6/agreements/${agreementId}/auditTrail`;
  const response = adobeSignRequest_(url, 'GET');
  return response.getBlob();
}


// ── Internal HTTP helper ──────────────────────────────────────────────────────

/**
 * Makes an authenticated request to the Adobe Sign API.
 * Handles token refresh transparently via the OAuth2 library.
 * Throws on non-2xx responses.
 */
function adobeSignRequest_(url, method, payload) {
  const options = {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + getAccessToken_(),
      'Accept': 'application/json, application/pdf',
    },
    muteHttpExceptions: true,
    followRedirects: true,
  };

  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  // Handle expired token (should be rare — OAuth2 library refreshes proactively)
  if (code === 401) {
    // Force token refresh by resetting and retrying once
    getAdobeSignService_().refresh();
    options.headers['Authorization'] = 'Bearer ' + getAccessToken_();
    return UrlFetchApp.fetch(url, options);
  }

  if (code >= 400) {
    throw new Error(`Adobe Sign API error ${code}: ${response.getContentText().substring(0, 300)}`);
  }

  return response;
}
