// =============================================================================
// SheetsWriter.gs  —  Writes extracted PO data to Google Sheets
// =============================================================================

/**
 * Writes a single processed agreement to the correct sheet tab.
 * Creates headers automatically if the sheet is empty.
 *
 * @param {string} docType    - One of: PO_STANDARD, PO_CAPEX, PO_SERVICE, PO_EMERGENCY
 * @param {Object} extracted  - Result from parsePdfFields()
 * @param {Object} agreement  - Adobe Sign agreement metadata {id, name, displayDate}
 * @param {string} driveUrl   - URL of the saved PDF in Google Drive
 */
function writeToSheet(docType, extracted, agreement, driveUrl) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheetName = CONFIG.SHEET_NAMES[docType] || CONFIG.SHEET_NAMES['PO_STANDARD'];
  let sheet = ss.getSheetByName(sheetName);

  // Create the tab if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    Logger.log('  Created sheet tab: ' + sheetName);
  }

  // Build the column definition for this doc type
  const columns = buildColumnDef_(docType);

  // If sheet is empty, write the header row first
  if (sheet.getLastRow() === 0) {
    writeHeaders_(sheet, columns);
  } else {
    // Validate headers match current config (handles config changes gracefully)
    ensureHeadersMatch_(sheet, columns);
  }

  // Check for duplicate (same agreement ID already in sheet)
  if (isDuplicate_(sheet, agreement.id)) {
    Logger.log('  Skipping duplicate: ' + agreement.id);
    return;
  }

  // Build and append the data row
  const row = buildRow_(columns, extracted, agreement, driveUrl);
  sheet.appendRow(row);

  // Auto-format the new row
  formatLastRow_(sheet, columns);

  Logger.log('  Written to sheet: ' + sheetName + ' (row ' + sheet.getLastRow() + ')');
}


/**
 * Returns the ordered column definitions for a given doc type.
 * Each column: { key, header, type }
 *   key:    field key to look up in extracted.fields (or special keys below)
 *   header: column label shown in the sheet
 *   type:   'field' | 'timestamp' | 'meta' | 'link'
 */
function buildColumnDef_(docType) {
  const config = CONFIG.DOC_TYPES[docType] || CONFIG.DOC_TYPES['PO_STANDARD'];

  const columns = [
    // Metadata columns always come first
    { key: '_agreement_id',   header: 'Agreement ID',    type: 'meta' },
    { key: '_agreement_name', header: 'Document Name',   type: 'meta' },
    { key: '_adobe_sign_date',header: 'Sign Date',       type: 'meta' },
    { key: '_doc_type',       header: 'Doc Type',        type: 'meta' },
    { key: '_drive_link',     header: 'PDF Link',        type: 'link' },
  ];

  // Document-specific field columns from config
  for (const [fieldName, colHeader] of Object.entries(config.fieldMap)) {
    columns.push({ key: fieldName, header: colHeader, type: 'field' });
  }

  // Timestamp columns always come last
  columns.push(
    { key: 'sent_timestamp',      header: 'Sent At',        type: 'timestamp' },
    { key: 'signed_timestamp',    header: 'Signed At',      type: 'timestamp' },
    { key: 'completed_timestamp', header: 'Completed At',   type: 'timestamp' },
    { key: '_processed_at',       header: 'Processed At',   type: 'meta' },
  );

  return columns;
}


function writeHeaders_(sheet, columns) {
  const headers = columns.map(c => c.header);
  sheet.appendRow(headers);

  // Style the header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontFamily('Arial')
    .setFontSize(10)
    .setHorizontalAlignment('center');

  // Freeze the header row
  sheet.setFrozenRows(1);

  // Set column widths
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    let width = 120;
    if (col.type === 'meta' && col.key === '_agreement_id') width = 90;
    if (col.type === 'meta' && col.key === '_agreement_name') width = 200;
    if (col.type === 'link') width = 80;
    if (col.type === 'timestamp') width = 160;
    if (col.header.includes('Description') || col.header.includes('Notes') ||
        col.header.includes('Justification')) width = 250;
    sheet.setColumnWidth(i + 1, width);
  }
}


function buildRow_(columns, extracted, agreement, driveUrl) {
  return columns.map(col => {
    switch (col.key) {
      case '_agreement_id':    return agreement.id;
      case '_agreement_name':  return agreement.name;
      case '_adobe_sign_date': return agreement.displayDate || '';
      case '_doc_type':        return extracted.docType || '';
      case '_drive_link':      return driveUrl;
      case '_processed_at':    return new Date().toISOString();
      default:
        if (col.type === 'timestamp') {
          return extracted.timestamps[col.key] || '';
        }
        return extracted.fields[col.key] || '';
    }
  });
}


function formatLastRow_(sheet, columns) {
  const lastRow = sheet.getLastRow();
  const range = sheet.getRange(lastRow, 1, 1, columns.length);

  // Alternate row shading
  const bgColor = lastRow % 2 === 0 ? '#f8f9fa' : '#ffffff';
  range.setBackground(bgColor);
  range.setFontFamily('Arial').setFontSize(10);
  range.setVerticalAlignment('middle');

  // Make PDF link column a hyperlink
  const linkCol = columns.findIndex(c => c.type === 'link') + 1;
  if (linkCol > 0) {
    const linkCell = sheet.getRange(lastRow, linkCol);
    const url = linkCell.getValue();
    if (url) {
      linkCell.setFormula(`=HYPERLINK("${url}","View PDF")`);
      linkCell.setFontColor('#1a73e8');
    }
  }
}


function ensureHeadersMatch_(sheet, columns) {
  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const expectedHeaders = columns.map(c => c.header);

  // Add any new columns that don't exist yet (handles config additions gracefully)
  for (let i = existingHeaders.length; i < expectedHeaders.length; i++) {
    sheet.getRange(1, i + 1).setValue(expectedHeaders[i])
      .setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');
  }
}


function isDuplicate_(sheet, agreementId) {
  if (sheet.getLastRow() <= 1) return false;
  const idColumn = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  return idColumn.some(row => row[0] === agreementId);
}


// ── Sheet Setup Helper ────────────────────────────────────────────────────────

/**
 * Creates all 4 sheet tabs with correct headers.
 * Run this ONCE after initial setup to prepare the spreadsheet.
 */
function initializeSpreadsheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  for (const docType of Object.keys(CONFIG.DOC_TYPES)) {
    const sheetName = CONFIG.SHEET_NAMES[docType];
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear();
    }
    const columns = buildColumnDef_(docType);
    writeHeaders_(sheet, columns);
    Logger.log('Initialized sheet: ' + sheetName);
  }

  // Create a summary/dashboard sheet
  createSummarySheet_(ss);

  Logger.log('Spreadsheet initialization complete.');
}


function createSummarySheet_(ss) {
  let summary = ss.getSheetByName('Summary');
  if (!summary) summary = ss.insertSheet('Summary');
  summary.clear();

  summary.getRange('A1').setValue('PO Sync Dashboard')
    .setFontSize(16).setFontWeight('bold').setFontFamily('Arial');
  summary.getRange('A3').setValue('Last Sync:');
  summary.getRange('B3').setFormula('=NOW()');
  summary.getRange('A5').setValue('Sheet');
  summary.getRange('B5').setValue('Record Count');

  let row = 6;
  for (const [docType, sheetName] of Object.entries(CONFIG.SHEET_NAMES)) {
    summary.getRange(row, 1).setValue(sheetName);
    summary.getRange(row, 2).setFormula(
      `=IFERROR(COUNTA('${sheetName}'!A:A)-1,0)`
    );
    row++;
  }

  summary.setColumnWidth(1, 160);
  summary.setColumnWidth(2, 120);
  ss.setActiveSheet(summary);
  ss.moveActiveSheet(1); // put Summary first
}
