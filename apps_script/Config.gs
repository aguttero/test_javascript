// =============================================================================
// Config.gs  —  All configuration constants
// ✏️  EDIT THIS FILE with your actual values before running anything
// =============================================================================

const CONFIG = {

  // ── Adobe Sign Credentials ─────────────────────────────────────────────────
  // Get these from Adobe Sign Admin → Account → Acrobat Sign API → API Applications
  ADOBE_SIGN_CLIENT_ID:     'YOUR_CLIENT_ID_HERE',
  ADOBE_SIGN_CLIENT_SECRET: 'YOUR_CLIENT_SECRET_HERE',

  // Your Adobe Sign account shard — check your login URL (na1, na2, eu1, jp1, etc.)
  ADOBE_SIGN_SHARD: 'na1',

  // ── Google Sheets ──────────────────────────────────────────────────────────
  // The ID of your Google Sheet (from its URL: /spreadsheets/d/SPREADSHEET_ID/edit)
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',

  // Tab names — one per document type + one shared log
  SHEET_NAMES: {
    PO_STANDARD:  'PO Standard',
    PO_CAPEX:     'PO CapEx',
    PO_SERVICE:   'PO Service',
    PO_EMERGENCY: 'PO Emergency',
  },

  // ── Google Drive ───────────────────────────────────────────────────────────
  // Root folder name to create under My Drive (subfolders YYYY-MM created automatically)
  DRIVE_ROOT_FOLDER_NAME: 'PO-Archive',

  // ── Script Properties Keys (internal — do not change) ─────────────────────
  CURSOR_PROPERTY_KEY:   'ADOBE_SIGN_CURSOR',
  BASE_URI_PROPERTY_KEY: 'ADOBE_SIGN_BASE_URI',

  // ── Document Type Configuration ────────────────────────────────────────────
  // For each doc type:
  //   discriminatorValue: the value of the 'doc_type' AcroForm field that identifies it
  //   fieldMap: { acroformFieldName: 'Column Header in Sheet' }
  // ✏️  Replace field names with the REAL names from your PDF (run inspect_pdf.py first)
  DOC_TYPES: {

    PO_STANDARD: {
      discriminatorValue: 'Standard PO',
      fieldMap: {
        'po_number':      'PO Number',
        'po_date':        'PO Date',
        'vendor_name':    'Vendor Name',
        'vendor_id':      'Vendor ID',
        'department':     'Department',
        'cost_center':    'Cost Center',
        'total_amount':   'Total Amount',
        'currency':       'Currency',
        'requestor_name': 'Requestor',
        'approver_name':  'Approver',
        'description':    'Description',
        'notes':          'Notes',
      }
    },

    PO_CAPEX: {
      discriminatorValue: 'CapEx PO',
      fieldMap: {
        'po_number':       'PO Number',
        'po_date':         'PO Date',
        'vendor_name':     'Vendor Name',
        'vendor_id':       'Vendor ID',
        'project_code':    'Project Code',
        'asset_category':  'Asset Category',
        'total_amount':    'Total Amount',
        'currency':        'Currency',
        'budget_line':     'Budget Line',
        'requestor_name':  'Requestor',
        'approver_name':   'Approver',
        'cfo_approver':    'CFO Approver',
        'description':     'Description',
      }
    },

    PO_SERVICE: {
      discriminatorValue: 'Service PO',
      fieldMap: {
        'po_number':      'PO Number',
        'po_date':        'PO Date',
        'vendor_name':    'Vendor Name',
        'service_type':   'Service Type',
        'start_date':     'Service Start Date',
        'end_date':       'Service End Date',
        'total_amount':   'Total Amount',
        'currency':       'Currency',
        'requestor_name': 'Requestor',
        'approver_name':  'Approver',
        'contract_ref':   'Contract Reference',
      }
    },

    PO_EMERGENCY: {
      discriminatorValue: 'Emergency PO',
      fieldMap: {
        'po_number':        'PO Number',
        'po_date':          'PO Date',
        'vendor_name':      'Vendor Name',
        'justification':    'Justification',
        'total_amount':     'Total Amount',
        'currency':         'Currency',
        'requestor_name':   'Requestor',
        'approver_name':    'Approver',
        'emergency_level':  'Emergency Level',
      }
    },
  },

  // ── Adobe Sign OAuth2 Endpoints (derived from shard — do not edit) ─────────
  get OAUTH_AUTH_URL()  { return `https://secure.${this.ADOBE_SIGN_SHARD}.adobesign.com/public/oauth/v2`; },
  get OAUTH_TOKEN_URL() { return `https://api.${this.ADOBE_SIGN_SHARD}.adobesign.com/oauth/v2/token`; },
  get OAUTH_REVOKE_URL(){ return `https://api.${this.ADOBE_SIGN_SHARD}.adobesign.com/oauth/v2/revoke`; },
};
