// =============================================================================
// Code.gs  —  Main Orchestrator
// Adobe Sign → Google Drive → Google Sheets automation
// =============================================================================
// FILE STRUCTURE (paste each file into a separate .gs tab in Apps Script):
//   Code.gs        — this file: main workflow + triggers
//   Auth.gs        — Adobe Sign OAuth2 service
//   AdobeSign.gs   — Adobe Sign API calls
//   PdfParser.gs   — PDF field extraction via pdf-lib
//   SheetsWriter.gs — Google Sheets output
//   Config.gs      — all configuration constants
// =============================================================================

/**
 * ENTRY POINT — Run this manually first, or set as a time-based trigger.
 * Fetches all new signed agreements from Adobe Sign, downloads each PDF,
 * saves to Google Drive, extracts form fields, and writes to Google Sheets.
 */
function runPOSync() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log('Another instance is already running. Exiting.');
    return;
  }

  try {
    Logger.log('=== PO Sync started: ' + new Date().toISOString() + ' ===');

    // 1. Check auth — if not authorized, log the URL and stop
    if (!isAdobeSignAuthorized()) {
      const authUrl = getAdobeSignAuthorizationUrl();
      Logger.log('NOT AUTHORIZED. Open this URL to authorize:\n' + authUrl);
      sendAuthEmail_(authUrl);
      return;
    }

    // 2. Get the Adobe Sign base URI for this account
    const baseUri = getOrRefreshBaseUri_();
    if (!baseUri) {
      Logger.log('ERROR: Could not retrieve base URI from Adobe Sign.');
      return;
    }

    // 3. Get the cursor (last processed position) so we don't re-process old docs
    const props = PropertiesService.getScriptProperties();
    const cursor = props.getProperty(CONFIG.CURSOR_PROPERTY_KEY) || '';

    // 4. Fetch all new SIGNED agreements since last cursor
    const agreements = getSignedAgreements(baseUri, cursor);
    Logger.log('Found ' + agreements.length + ' new signed agreement(s).');

    if (agreements.length === 0) {
      Logger.log('Nothing new to process. Done.');
      return;
    }

    // 5. Process each agreement
    let newCursor = cursor;
    let processed = 0;
    let errors = 0;

    for (const agreement of agreements) {
      try {
        Logger.log('Processing: ' + agreement.name + ' (' + agreement.id + ')');
        processAgreement_(baseUri, agreement);
        newCursor = agreement.id; // advance cursor to last successfully processed ID
        processed++;
        Utilities.sleep(300); // respect Adobe Sign rate limit (5 req/sec)
      } catch (e) {
        Logger.log('ERROR processing ' + agreement.id + ': ' + e.message);
        logErrorToSheet_(agreement, e.message);
        errors++;
      }
    }

    // 6. Save the new cursor
    if (newCursor !== cursor) {
      props.setProperty(CONFIG.CURSOR_PROPERTY_KEY, newCursor);
    }

    Logger.log('=== Sync complete. Processed: ' + processed + '  Errors: ' + errors + ' ===');

  } finally {
    lock.releaseLock();
  }
}


/**
 * Processes a single agreement end-to-end:
 *   download PDF → save to Drive → parse fields → write to Sheets
 */
function processAgreement_(baseUri, agreement) {
  // 1. Download combined PDF (with audit trail)
  const pdfBlob = downloadAgreementPdf(baseUri, agreement.id, agreement.name);

  // 2. Save to Google Drive
  const driveFile = savePdfToDrive_(pdfBlob, agreement);
  Logger.log('  Saved to Drive: ' + driveFile.getUrl());

  // 3. Parse PDF form fields using pdf-lib
  const extracted = parsePdfFields(pdfBlob);
  Logger.log('  Extracted fields: ' + JSON.stringify(extracted.fields));
  Logger.log('  Timestamps: ' + JSON.stringify(extracted.timestamps));

  // 4. Identify document type
  const docType = identifyDocType_(extracted.fields);
  Logger.log('  Doc type: ' + docType);

  // 5. Write to Google Sheets
  writeToSheet(docType, extracted, agreement, driveFile.getUrl());
}


/**
 * Saves a PDF blob to the correct Google Drive subfolder.
 * Folder structure: /PO-Archive/YYYY-MM/
 */
function savePdfToDrive_(pdfBlob, agreement) {
  const rootFolder = getOrCreateFolder_(DriveApp.getRootFolder(), CONFIG.DRIVE_ROOT_FOLDER_NAME);
  const monthFolder = getOrCreateFolder_(rootFolder, getMonthFolderName_());
  const fileName = sanitizeFileName_(agreement.name) + '_' + agreement.id.slice(-8) + '.pdf';
  pdfBlob.setName(fileName);
  return monthFolder.createFile(pdfBlob);
}


/**
 * Identifies one of the 4 document types from extracted field values.
 * Adjust the discriminator logic to match your actual field names and values.
 */
function identifyDocType_(fields) {
  const docTypeField = (fields['doc_type'] || fields['document_type'] || '').toLowerCase();

  // Strategy 1: check a dedicated doc_type field
  for (const [type, config] of Object.entries(CONFIG.DOC_TYPES)) {
    if (docTypeField === config.discriminatorValue.toLowerCase()) return type;
  }

  // Strategy 2: fallback — look for keywords in any field values
  const allValues = Object.values(fields).join(' ').toLowerCase();
  if (allValues.includes('capex') || allValues.includes('capital'))   return 'PO_CAPEX';
  if (allValues.includes('service') || allValues.includes('sow'))     return 'PO_SERVICE';
  if (allValues.includes('emergency') || allValues.includes('urgent')) return 'PO_EMERGENCY';

  return 'PO_STANDARD'; // default
}


// ── Helper Utilities ──────────────────────────────────────────────────────────

function getOrCreateFolder_(parent, name) {
  const existing = parent.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(name);
}

function getMonthFolderName_() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function sanitizeFileName_(name) {
  return name.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').substring(0, 80);
}

function sendAuthEmail_(authUrl) {
  try {
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      'Adobe Sign Authorization Required',
      'Your PO Sync script needs authorization. Click this link:\n\n' + authUrl
    );
  } catch(e) { Logger.log('Could not send auth email: ' + e.message); }
}

function getOrRefreshBaseUri_() {
  const props = PropertiesService.getScriptProperties();
  let uri = props.getProperty(CONFIG.BASE_URI_PROPERTY_KEY);
  if (!uri) {
    uri = fetchBaseUri();
    if (uri) props.setProperty(CONFIG.BASE_URI_PROPERTY_KEY, uri);
  }
  return uri;
}

function logErrorToSheet_(agreement, errorMsg) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let errorSheet = ss.getSheetByName('_Errors');
    if (!errorSheet) {
      errorSheet = ss.insertSheet('_Errors');
      errorSheet.appendRow(['Timestamp', 'Agreement ID', 'Agreement Name', 'Error']);
    }
    errorSheet.appendRow([new Date().toISOString(), agreement.id, agreement.name, errorMsg]);
  } catch(e) { Logger.log('Could not log error to sheet: ' + e.message); }
}


// ── Trigger Management ────────────────────────────────────────────────────────

/**
 * Creates a daily time-based trigger.
 * Run this ONCE manually to set up the schedule.
 */
function createDailyTrigger() {
  // Remove existing triggers first to avoid duplicates
  removeTriggers_();
  ScriptApp.newTrigger('runPOSync')
    .timeBased()
    .everyDays(1)
    .atHour(7) // 7:00 AM in the script's timezone
    .create();
  Logger.log('Daily trigger created for 7:00 AM.');
}

/**
 * Creates an hourly trigger for higher-frequency processing.
 */
function createHourlyTrigger() {
  removeTriggers_();
  ScriptApp.newTrigger('runPOSync')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('Hourly trigger created.');
}

function removeTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runPOSync')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/**
 * Run this to reset the cursor and reprocess all agreements from scratch.
 * USE WITH CAUTION — will rewrite all rows.
 */
function resetCursorAndReprocess() {
  PropertiesService.getScriptProperties().deleteProperty(CONFIG.CURSOR_PROPERTY_KEY);
  Logger.log('Cursor reset. Next runPOSync() will process all SIGNED agreements.');
}
