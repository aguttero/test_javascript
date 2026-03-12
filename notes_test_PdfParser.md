Step 1 — Get the Google Drive File ID
Open Google Drive in your browser and find one of the PDFs you downloaded from Postman. Click on it to open the preview, then look at the URL in your browser address bar. It will look like this:
https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlpe/view
The file ID is the long string between /d/ and /view. In this example it would be:
1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlpe
Copy that string.

Step 2 — Paste it into inspectPdfById()
Open your Apps Script project. Click on the PdfParser.gs tab. Find this line near the bottom of the file:

const fileId = 'YOUR_DRIVE_FILE_ID_HERE'; // ✏️  set this

Replace YOUR_DRIVE_FILE_ID_HERE with the ID you just copied, keeping the quotes:

const fileId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlpe';
```

---

## Step 3 — Run it and Read the Log

In the Apps Script editor, select `inspectPdfById` from the function dropdown at the top (the dropdown that probably says `runPOSync` or `myFunction`). Click the **Run** button (▶).

The first time you run anything, Apps Script will ask for permissions — click **Review permissions → Allow**.

Then click **Execution log** at the bottom of the screen. You will see one of three outcomes:

---

## Reading the Results

**Outcome A — Everything worked perfectly:**
```
=== PDF INSPECTION ===
Parse method: pdf-lib-acroform

--- AcroForm Fields ---
"doc_type" = "Standard PO"
"vendor_name" = "Acme Corp"
"po_number" = "PO-2025-0042"
"total_amount" = "15750.00"
... (more fields)

--- Timestamps ---
{
  "sent_timestamp": "2025-03-10T09:15:00Z",
  "signed_timestamp": "2025-03-10T14:32:00Z",
  "completed_timestamp": "2025-03-10T14:32:05Z"
}
```

This means pdf-lib read the AcroForm fields directly. Copy the exact field names shown (like `"vendor_name"`, `"po_number"`) into the `fieldMap` section of `Config.gs`.

---

**Outcome B — Fields are empty, OCR fallback activated:**
```
Parse method: ocr-text-regex
pdf-lib extraction failed: ... — trying text fallback
OCR extracted 6 fields
"vendor_name" = "Acme Corp"
"po_number" = "PO-2025-0042"
```

This means Adobe Sign flattened the form fields when completing the document (a common setting). The OCR fallback worked but may miss some fields. Your options are:

- Use the Adobe Sign API `/agreements/{id}/formData` endpoint to get the original field data before flattening — this is the most reliable fix in this case
- Or adjust the regex patterns in `parseFieldsFromText_()` to match your specific document layout

---

**Outcome C — Timestamps are all empty:**
```
"sent_timestamp": "",
"signed_timestamp": "",
"completed_timestamp": ""

---

This means the XMP metadata in your PDF uses different tag names than expected. To diagnose it, temporarily add this line inside extractTimestamps_() right after the const str = bytesToString_(bytes) line:

Logger.log('XMP SNIPPET: ' + str.substring(0, 3000));

Run inspectPdfById() again. The log will show the raw XMP block. Look for the actual tag names Adobe Sign used (they may be adobesign: prefix instead of echosign:, or the field names may differ slightly). Then update the patterns in extractTimestamps_() to match.

---

Running All 4 Document Types
Once the first test passes, repeat Steps 1–3 for one PDF of each of your other 3 document types. Each run will show you the real field names for that type — copy them directly into the corresponding fieldMap in Config.gs. This is the only configuration work needed before running the full runPOSync().