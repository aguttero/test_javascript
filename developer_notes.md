________________________________________________
FULL ARCHITECTURE DIAGRAM
________________________________________________


┌─────────────────────────────────────────────────────────────────┐
│  TRIGGER LAYER (user's choice — pick one)                       │
│                                                                  │
│  A) Google Sheet button  →  Apps Script runs immediately        │
│  B) Time-based trigger   →  Apps Script runs every night        │
│  C) Adobe Sign Webhook   →  fires on each new signed doc        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  GOOGLE APPS SCRIPT (runs in Google Cloud — no local device)    │
│                                                                  │
│  1. Call Adobe Sign API → list new SIGNED agreements            │
│  2. For each agreement:                                         │
│     a. Download combined PDF (signed + audit trail)             │
│     b. Save PDF to Google Drive /PO-Archive/YYYY-MM/            │
│     c. POST PDF bytes → PDF Extractor microservice              │
│     d. Receive JSON { doc_type, data{}, timestamps{} }          │
│     e. Append row to correct Google Sheet tab                   │
│  3. Store last-run cursor (agreement ID or date) in Script      │
│     Properties to avoid re-processing                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
┌─────────▼──────────┐   ┌──────────▼──────────────────────────────┐
│  ADOBE SIGN API    │   │  PDF EXTRACTOR MICROSERVICE              │
│  (Enterprise)      │   │  (Cloud Run / Render / Railway — free)  │
│                    │   │                                          │
│  OAuth2 token      │   │  FastAPI + adobe_sign_extractor.py       │
│  /agreements       │   │  POST /extract → returns JSON           │
│  /combinedDocument │   │  Stateless, needs no DB                 │
└────────────────────┘   └──────────────────────────────────────────┘
          │                         │
          └────────────┬────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│  GOOGLE WORKSPACE                                                │
│                                                                  │
│  Drive:  /PO-Archive/2025-03/vendor_po_12345.pdf               │
│  Sheets: "PO Tracker"                                           │
│    Tab: PO_STANDARD  | Tab: PO_CAPEX  | Tab: PO_SERVICE ...    │
└─────────────────────────────────────────────────────────────────┘



Part 1 — Adobe Sign App Setup (Steps 1–6)
The setup happens entirely inside the Acrobat Sign application (not the Adobe Admin Console). You create a CUSTOMER-type OAuth application, grab the Client ID and Client Secret, set https://oauth.pstmn.io/v1/callback as the redirect URI, and enable agreement_read:account + user_login:self as the minimum scopes.
Part 2 — OAuth2 Flow Explained
A reference table walking through the 6 phases: authorization request → user login → auth code → token exchange → API calls → refresh. Useful for understanding what to expect and what to implement later in Apps Script.
Part 3 — Postman Setup on macOS (Steps 7–11)
Install Postman → import Adobe's official collection (optional shortcut) → create an environment with your credentials → configure the OAuth2 grant type with the exact field values → click Get New Access Token and complete the browser login.
Part 4 — Four Test Calls
Step-by-step requests for: GET /baseUris (find your shard), GET /agreements?query=SIGNED (list POs), GET /agreements/{id} (full metadata), and GET /agreements/{id}/combinedDocument (download the signed PDF with audit trail).
Part 5 — Token Management
Access token expires in 1 hour; refresh token is valid 60 days from last use. Includes the POST /oauth/v2/refresh call you'll implement in Apps Script.
Part 6 — Troubleshooting table covering the most common errors (redirect_uri_mismatch, invalid_client, scope issues, pop-up blocks).
Part 7 — Next Steps bridging into the Google Apps Script automation with rate limiting notes.


Complete Corrected Call (with all optional parameters documented)
Query Parameter Value               Effect
attachAuditReport = true            Appends the Adobe Sign audit trail page — this is what you were missing
attachSupportingDocuments = true    Includes any supporting documents attached to the agreement
versionId (omit)                    Omitting returns the latest/final version — correct for completed agreements

___________
File Structure in Apps Script: 
Code.gs         Main orchestrator — workflow entry point and triggers
Config.gs       All constants — Client ID, Sheet ID, field mappings
Auth.gs         OAuth2 service configuration and callback handler
AdobeSign.gs    Adobe Sign REST API calls (list, download, baseUri)
PdfParser.gs    PDF AcroForm extraction using pdf-lib via CDN
SheetsWriter.gs Google Sheets row building and formatting