// Cargar la biblioteca desde un CDN (jsDelivr)
// const cdnjs = "https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js";
// eval(UrlFetchApp.fetch(cdnjs).getContentText());

// const fileId = '1wsHk3GiacYAHJngDTX8UA0EIba695yj8';
// const blob = DriveApp.getFileById(fileId).getBlob();


async function createPdf() {
  // Una vez evaluado, el objeto global es 'PDFLib'
  const pdfDoc = await PDFLib.PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  page.drawText('¡Hola desde Google Apps Script!');
  
  const pdfBytes = await pdfDoc.save();
  // Guardar en Google Drive
  DriveApp.createFile(Utilities.newBlob(pdfBytes, 'application/pdf', 'nuevo_01.pdf'));
}
