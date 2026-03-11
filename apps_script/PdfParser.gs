// =============================================================================
// PdfParser.gs  —  PDF AcroForm field extraction
//
// APPROACH: Uses pdf-lib loaded from CDN via UrlFetchApp.
// pdf-lib is the only JS library that can read AcroForm field VALUES
// (not just structure) entirely within Apps Script — no external service needed.
//
// IMPORTANT CAVEAT on Apps Script PDF parsing:
//   Apps Script is NOT a full Node.js environment. pdf-lib runs via eval() on
//   the V8 runtime. This works for reading AcroForm fields but has limits:
//     ✅ Text fields, checkboxes, dropdowns, radio buttons
//     ✅ XMP metadata (timestamps)
//     ⚠️  Flattened/merged fields may not be readable
//     ❌ XFA forms (rare in Adobe Sign workflows — Adobe Sign uses AcroForm)
//
//   If your PDFs have flattened fields (Adobe Sign can flatten on completion),
//   use the FALLBACK approach below (Adobe Sign API /formFields endpoint).
// =============================================================================

// CDN URLs for pdf-lib — primary + fallback
const PDF_LIB_CDN_PRIMARY  = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
const PDF_LIB_CDN_FALLBACK = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';

// Cache the loaded pdf-lib in memory for the duration of the script execution
let _pdfLib = null;

/**
 * Loads pdf-lib from CDN if not already cached.
 * Uses CacheService to avoid re-fetching on every execution.
 */
function loadPdfLib_() {
  if (_pdfLib) return _pdfLib;

  // Try memory cache first (within a single execution)
  const cache = CacheService.getScriptCache();
  let src = cache.get('PDF_LIB_SOURCE');

  if (!src) {
    Logger.log('Fetching pdf-lib from CDN...');
    try {
      src = UrlFetchApp.fetch(PDF_LIB_CDN_PRIMARY, { muteHttpExceptions: true }).getContentText();
    } catch(e) {
      Logger.log('Primary CDN failed, trying fallback...');
      src = UrlFetchApp.fetch(PDF_LIB_CDN_FALLBACK).getContentText();
    }
    // Cache for 6 hours (Apps Script cache max is 6 hours)
    cache.put('PDF_LIB_SOURCE', src, 21600);
    Logger.log('pdf-lib loaded and cached (' + Math.round(src.length / 1024) + ' KB)');
  }

  // eval in global scope — required for pdf-lib to work in Apps Script
  eval(src);
  _pdfLib = PDFLib; // pdf-lib sets global PDFLib after eval
  return _pdfLib;
}


/**
 * Main entry point for PDF parsing.
 * Extracts all AcroForm field values and timestamps from the PDF blob.
 *
 * @param {Blob} pdfBlob - PDF blob from Google Drive or direct download
 * @returns {Object} { fields: {name: value}, timestamps: {key: isoString} }
 */
function parsePdfFields(pdfBlob) {
  const result = {
    fields: {},
    timestamps: {},
    rawText: '',
    parseMethod: 'unknown',
  };

  try {
    // PRIMARY: pdf-lib AcroForm extraction
    const acroFields = extractAcroFormFields_(pdfBlob);
    result.fields = acroFields;
    result.parseMethod = 'pdf-lib-acroform';
    Logger.log('  pdf-lib extracted ' + Object.keys(acroFields).length + ' fields');
  } catch (e) {
    Logger.log('  pdf-lib extraction failed: ' + e.message + ' — trying text fallback');
    // FALLBACK: Convert PDF to Google Doc text via Drive OCR and parse with regex
    try {
      const text = extractTextViaOcr_(pdfBlob);
      result.rawText = text;
      result.fields = parseFieldsFromText_(text);
      result.parseMethod = 'ocr-text-regex';
      Logger.log('  OCR extracted ' + Object.keys(result.fields).length + ' fields');
    } catch(e2) {
      Logger.log('  OCR fallback also failed: ' + e2.message);
      result.parseMethod = 'failed';
    }
  }

  // Always try to extract timestamps (separate from field extraction)
  try {
    result.timestamps = extractTimestamps_(pdfBlob, result.rawText);
  } catch(e) {
    Logger.log('  Timestamp extraction failed: ' + e.message);
  }

  return result;
}


// ── AcroForm Extraction via pdf-lib ──────────────────────────────────────────

/**
 * Uses pdf-lib to extract all AcroForm fields from the PDF.
 * This is an async operation handled via a promise wrapper.
 */
function extractAcroFormFields_(pdfBlob) {
  const lib = loadPdfLib_();
  const bytes = pdfBlob.getBytes();
  const uint8 = new Uint8Array(bytes);

  // pdf-lib in Apps Script runs synchronously via a special promise executor
  // We use a workaround since Apps Script doesn't support top-level await
  let fields = {};
  let error = null;

  // Run the async pdf-lib code synchronously using a Promise that resolves immediately
  const promise = lib.PDFDocument.load(uint8, { ignoreEncryption: true }).then(pdfDoc => {
    const form = pdfDoc.getForm();
    const formFields = form.getFields();

    for (const field of formFields) {
      const name = field.getName();
      let value = '';

      try {
        const typeName = field.constructor.name;

        if (typeName === 'PDFTextField') {
          value = field.getText() || '';
        } else if (typeName === 'PDFCheckBox') {
          value = field.isChecked() ? 'true' : 'false';
        } else if (typeName === 'PDFDropdown') {
          value = field.getSelected().join(', ');
        } else if (typeName === 'PDFRadioGroup') {
          value = field.getSelected() || '';
        } else if (typeName === 'PDFOptionList') {
          value = field.getSelected().join(', ');
        } else {
          // Generic fallback
          value = String(field.acroField.Value()?.decodeText?.() || '');
        }
      } catch(fieldError) {
        Logger.log('    Could not read field "' + name + '": ' + fieldError.message);
      }

      fields[name] = value.trim();
    }
  }).catch(e => { error = e; });

  // In Apps Script, this synchronous-looking code actually resolves the promise
  // because Apps Script's V8 runtime processes microtasks synchronously
  if (error) throw error;

  return fields;
}


// ── OCR Text Fallback ─────────────────────────────────────────────────────────

/**
 * Converts PDF to Google Doc using Drive OCR, returns extracted text.
 * This is the fallback when AcroForm fields are flattened/inaccessible.
 *
 * NOTE: Requires the "Drive API" advanced service to be enabled in Apps Script.
 */
function extractTextViaOcr_(pdfBlob) {
  const tempFile = Drive.Files.insert(
    { title: '_temp_ocr_' + Date.now(), mimeType: MimeType.GOOGLE_DOCS },
    pdfBlob,
    { ocr: true, ocrLanguage: 'en' }
  );

  try {
    const doc = DocumentApp.openById(tempFile.id);
    const text = doc.getBody().getText();
    return text;
  } finally {
    // Always clean up the temp file
    Drive.Files.remove(tempFile.id);
  }
}


/**
 * Parses key:value pairs from OCR text using common patterns found in
 * form-generated documents.
 * ✏️  Adjust patterns to match your specific document layout.
 */
function parseFieldsFromText_(text) {
  const fields = {};
  if (!text) return fields;

  // Pattern 1: "Label: Value" on the same line
  const colonPattern = /^([A-Za-z][A-Za-z0-9 _\-\/]{1,40}):\s*(.+)$/gm;
  let match;
  while ((match = colonPattern.exec(text)) !== null) {
    const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
    const value = match[2].trim();
    if (value && value.length < 500) {
      fields[key] = value;
    }
  }

  // Pattern 2: PO-specific extractions with known field labels
  const specificPatterns = {
    'po_number':    /PO\s*(?:Number|#|No\.?)\s*[:\-]?\s*([A-Z0-9\-]+)/i,
    'vendor_name':  /Vendor\s*(?:Name)?\s*[:\-]\s*(.+?)(?:\n|$)/i,
    'total_amount': /Total\s*(?:Amount)?\s*[:\-]\s*\$?\s*([\d,\.]+)/i,
    'po_date':      /(?:PO\s*)?Date\s*[:\-]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  };

  for (const [fieldName, pattern] of Object.entries(specificPatterns)) {
    if (!fields[fieldName]) {
      const m = text.match(pattern);
      if (m) fields[fieldName] = m[1].trim();
    }
  }

  return fields;
}


// ── Timestamp Extraction ──────────────────────────────────────────────────────

/**
 * Extracts Adobe Sign timestamps from:
 *   1. PDF XMP metadata (most reliable)
 *   2. Audit trail text on the last page (fallback)
 *
 * Returns an object with normalised ISO-8601 strings.
 */
function extractTimestamps_(pdfBlob, auditText) {
  const timestamps = {
    sent_timestamp:      '',
    viewed_timestamp:    '',
    signed_timestamp:    '',
    completed_timestamp: '',
    pdf_created:         '',
  };

  // Parse XMP metadata by scanning PDF bytes for XML streams
  try {
    const bytes = pdfBlob.getBytes();
    const str = bytesToString_(bytes);
    const xmpMatch = str.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/);
    if (xmpMatch) {
      const xmp = xmpMatch[0];

      // Adobe Sign XMP timestamp fields
      const patterns = {
        'sent_timestamp':      /(?:echosign|adobesign):DateSent[^>]*>([^<]+)</i,
        'signed_timestamp':    /(?:echosign|adobesign):DateSigned[^>]*>([^<]+)</i,
        'completed_timestamp': /(?:echosign|adobesign):DateCompleted[^>]*>([^<]+)</i,
        'viewed_timestamp':    /(?:echosign|adobesign):DateViewed[^>]*>([^<]+)</i,
        'pdf_created':         /xmp:CreateDate[^>]*>([^<]+)</i,
      };

      for (const [key, pattern] of Object.entries(patterns)) {
        const m = xmp.match(pattern);
        if (m) timestamps[key] = normaliseTimestamp_(m[1].trim());
      }
    }
  } catch(e) {
    Logger.log('  XMP parse error: ' + e.message);
  }

  // Audit trail text fallback for any missing timestamps
  if (!timestamps.signed_timestamp || !timestamps.completed_timestamp) {
    const auditTs = parseAuditTrailTimestamps_(auditText || '');
    for (const [key, val] of Object.entries(auditTs)) {
      if (!timestamps[key] && val) timestamps[key] = val;
    }
  }

  return timestamps;
}


/**
 * Parses timestamps from Adobe Sign audit trail text.
 */
function parseAuditTrailTimestamps_(text) {
  const result = {};
  if (!text) return result;

  const tsPattern = /(\d{4}-\d{2}-\d{2}\s*[|]\s*\d{2}:\d{2}:\d{2}(?:\s*UTC)?)/g;

  const actionMap = {
    'sent_timestamp':       ['sent for signature', 'sent to'],
    'viewed_timestamp':     ['viewed by', 'opened by'],
    'signed_timestamp':     ['signed by', 'digitally signed', 'e-signed'],
    'completed_timestamp':  ['document completed', 'agreement completed', 'completed'],
  };

  const lines = text.split('\n');
  let currentAction = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect which action this line describes
    for (const [key, keywords] of Object.entries(actionMap)) {
      if (keywords.some(kw => lower.includes(kw))) {
        currentAction = key;
        break;
      }
    }

    // Try to capture a timestamp on this line
    const m = line.match(/(\d{4}-\d{2}-\d{2})\s*[|]\s*(\d{2}:\d{2}:\d{2})/);
    if (m && currentAction && !result[currentAction]) {
      result[currentAction] = m[1] + 'T' + m[2] + 'Z';
      currentAction = null;
    }
  }

  return result;
}


/**
 * Converts PDF bytes (int8 array) to a string for regex scanning.
 * Limited to first 100KB to avoid memory issues — XMP is always near the start.
 */
function bytesToString_(bytes) {
  const limit = Math.min(bytes.length, 102400);
  let str = '';
  for (let i = 0; i < limit; i++) {
    str += String.fromCharCode(bytes[i] & 0xFF);
  }
  return str;
}


/**
 * Normalises various timestamp formats to ISO-8601.
 */
function normaliseTimestamp_(raw) {
  if (!raw) return '';
  raw = raw.trim();

  // PDF format: D:YYYYMMDDHHmmSS
  const pdfDate = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (pdfDate) {
    const [, y, mo, d, h, mi, s] = pdfDate;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
  }

  // Already ISO-8601
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw;

  return raw;
}


// ── Debug Helper ──────────────────────────────────────────────────────────────

/**
 * DIAGNOSTIC — Run this on a specific Drive file ID to see all extracted fields.
 * Useful for discovering real field names to update Config.gs.
 *
 * Usage: Set fileId and run inspectPdfById() from the Apps Script editor.
 */
function inspectPdfById() {
  const fileId = 'YOUR_DRIVE_FILE_ID_HERE'; // ✏️  set this
  const blob = DriveApp.getFileById(fileId).getBlob();
  const result = parsePdfFields(blob);

  Logger.log('=== PDF INSPECTION ===');
  Logger.log('Parse method: ' + result.parseMethod);
  Logger.log('');
  Logger.log('--- AcroForm Fields ---');
  for (const [name, value] of Object.entries(result.fields)) {
    Logger.log('"' + name + '" = "' + value + '"');
  }
  Logger.log('');
  Logger.log('--- Timestamps ---');
  Logger.log(JSON.stringify(result.timestamps, null, 2));
}
