// Cargar la biblioteca desde un CDN (jsDelivr)
// const cdnjs = "https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js";
// eval(UrlFetchApp.fetch(cdnjs).getContentText());

// const fileId = '1wsHk3GiacYAHJngDTX8UA0EIba695yj8'; // file firmado sin audit Trail
// const fileId = '1rAMJt23phRwu9HCc_1UgrXyoiS0ulfOm'; // file simple creado con pdf-lib
// const blob = DriveApp.getFileById(fileId).getBlob();

// Para evitar -> ReferenceError: setTimeout is not defined
// Este error ocurre porque pdf-lib intenta usar la función setTimeout, que existe en los navegadores y en Node.js, pero no existe en Google Apps Script [1].
// Como Apps Script se ejecuta en los servidores de Google de forma lineal, no tiene un sistema de temporizadores nativo. Para solucionarlo, debes "engañar" a la librería definiendo un setTimeout falso al principio de tu script.

// code to trick pdf-lib:
// Simulación de setTimeout para compatibilidad con librerías modernas
var setTimeout = (func, delay) => {
  Utilities.sleep(delay || 0);
  return func();
};

// Si la librería también pide clearTimeout (opcional)
// var clearTimeout = (id) => {};

function testConsoleLog () {
  console.log('this is a console.log message test')
}

async function createPdf() {
  // Una vez evaluado con eval (), el objeto global es 'PDFLib'
  // Con la librería cargada en file local no hace falta el eval (). Objeto globla es 'PDFLib'
  const pdfDoc = await PDFLib.PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  page.drawText('¡Hola desde Google Apps Script!');
  
  const pdfBytes = await pdfDoc.save();
  // Guardar en Google Drive
  DriveApp.createFile(Utilities.newBlob(pdfBytes, 'application/pdf', 'nuevo_01.pdf'));
}

async function createSamplePdf() {
  // import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'-> haría falta en JS para web-app
  const pdfDoc = await PDFLib.PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(PDFLib.StandardFonts.TimesRoman);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 30;
  page.drawText('Creating PDFs in JavaScript is awesome!', {
    x: 50,
    y: height - 4 * fontSize,
    size: fontSize,
    font: timesRomanFont,
    color: PDFLib.rgb(0, 0.53, 0.71),
  });

  const pdfBytes = await pdfDoc.save();
  // Guardar en Google Drive
  DriveApp.createFile(Utilities.newBlob(pdfBytes, 'application/pdf', 'nuevo_sample_01.pdf'));
}

async function modifyPDFLibPdf() {
  // import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'; -> para JS web-app

  
  // busca un PDF online del sample de pdf-lib:
  const url = 'https://pdf-lib.js.org/assets/with_update_sections.pdf';
  // const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer()); // funciona en browser
  const response = UrlFetchApp.fetch(url); //
  const existingPdfBytes = response.getContent(); // getContent() crea los bytes que PDF-lib necesita
  
  // Convet from Int8Array to Uint8Array
  const uint8ArrayBytes = new Uint8Array(existingPdfBytes);

  // version simplificada del code:
  // const url = 'https://pdf-lib.js.org';
  // const existingPdfBytes = UrlFetchApp.fetch(url).getContent();
  // Conversión de bytes para GAS
  //const uint8Array = new Uint8Array(existingPdfBytes.map(b => (b + 256) % 256));

  const pdfDoc = await PDFLib.PDFDocument.load(uint8ArrayBytes);
  Logger.log("PDF OK Load");

  

  const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();
  firstPage.drawText('This text added with Apps Script', {
    x: 5,
    y: height / 2 + 300,
    size: 50,
    font: helveticaFont,
    color: PDFLib.rgb(0.95, 0.1, 0.1),
    rotate: PDFLib.degrees(-45),
  });

  const pdfBytes = await pdfDoc.save();
  // Guardar en Google Drive
  DriveApp.createFile(Utilities.newBlob(pdfBytes, 'application/pdf', 'nuevo_sample_02.pdf'));
}

async function modifyGdrivePdf() {
  // import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'; -> para JS web-app
  
  // busca un PDF online del sample de pdf-lib:
  // const url = 'https://pdf-lib.js.org/assets/with_update_sections.pdf'
  // const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer())

  // busca el file en google drive
  const fileId = '1rAMJt23phRwu9HCc_1UgrXyoiS0ulfOm'; // file simple creado con pdf-lib
  // const fileId = '1wsHk3GiacYAHJngDTX8UA0EIba695yj8'; // file de firmado sin audit Trail

  const existingPdfBytes = DriveApp.getFileById(fileId).getBlob().getBytes();
  const uint8ArrayBytes = new Uint8Array(existingPdfBytes);
  const pdfDoc = await PDFLib.PDFDocument.load(uint8ArrayBytes);
  Logger.log("PDF OK Load");

  const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();
  firstPage.drawText('This text added with G App Script!', {
    x: 5,
    y: height / 2 + 300,
    size: 50,
    font: helveticaFont,
    color: PDFLib.rgb(0.95, 0.1, 0.1),
    rotate: PDFLib.degrees(-45),
  });

  const pdfBytes = await pdfDoc.save();
  // Guardar en Google Drive
  DriveApp.createFile(Utilities.newBlob(pdfBytes, 'application/pdf', 'nuevo_sample_04.pdf'));
}

async function modifyEncryptedGdrivePdf() {
  // import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'; -> para JS web-app
  
  // busca un PDF online del sample de pdf-lib:
  // const url = 'https://pdf-lib.js.org/assets/with_update_sections.pdf'
  // const existingPdfBytes = await fetch(url).then(res => res.arrayBuffer())

  // busca el file en google drive
  // const fileId = '1rAMJt23phRwu9HCc_1UgrXyoiS0ulfOm'; // file simple creado con pdf-lib
  const fileId = '1wsHk3GiacYAHJngDTX8UA0EIba695yj8'; // file firmado sin audit Trail

  const existingPdfBytes = DriveApp.getFileById(fileId).getBlob().getBytes();
  const uint8ArrayBytes = new Uint8Array(existingPdfBytes);
  const pdfDoc = await PDFLib.PDFDocument.load(uint8ArrayBytes, {ignoreEncryption: true});
  Logger.log("PDF OK Load");

  const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();
  firstPage.drawText('This text added with G App Script!', {
    x: 5,
    y: height / 2 + 300,
    size: 50,
    font: helveticaFont,
    color: PDFLib.rgb(0.95, 0.1, 0.1),
    rotate: PDFLib.degrees(-45),
  });

  const pdfBytes = await pdfDoc.save();
  // Guardar en Google Drive
  DriveApp.createFile(Utilities.newBlob(pdfBytes, 'application/pdf', 'nuevo_sample_04.pdf'));
}

async function listarCamposFormulario() {
  try {
    const fileId = '1rAMJt23phRwu9HCc_1UgrXyoiS0ulfOm'; // file simple creado con pdf-lib
    //const fileId = '1wsHk3GiacYAHJngDTX8UA0EIba695yj8'; // file firmado sin audit Trail
    const existingPdfBytes = DriveApp.getFileById(fileId).getBlob().getBytes();
    const uint8ArrayBytes = new Uint8Array(existingPdfBytes);
    // 1. Supongamos que ya tienes los bytes cargados (como vimos antes)
    const pdfDoc = await PDFLib.PDFDocument.load(uint8ArrayBytes, { ignoreEncryption: true });
    console.log("PDF OK Load");

    // 2. Obtener el objeto del formulario
    const form = pdfDoc.getForm();
    console.log("OK getForm");

    // 3. Obtener todos los campos
    const fields = form.getFields();
    console.log("OK getFields");

    console.log(`Se encontraron ${fields.length} campos.`);

    // 4. Recorrer la lista para extraer nombre y valor
    fields.forEach(field => {
      const type = field.constructor.name;
      const name = field.getName();
      let value = '';

      // El método para obtener el valor cambia según el tipo de campo
      try {
        if (type === 'PDFTextField') {
          value = field.getText() || '(vacío)';
        } else if (type === 'PDFCheckBox') {
          value = field.isChecked() ? 'Seleccionado' : 'No seleccionado';
        } else if (type === 'PDFDropdown' || type === 'PDFOptionList') {
          value = field.getSelected().join(', ') || '(sin selección)';
        } else if (type === 'PDFRadioGroup') {
          value = field.getSelected() || '(sin selección)';
        } else {
          value = '[Tipo de campo no soportado para lectura directa]';
        }
      } catch (e) {
        value = '[Error al leer valor]';
      }

      console.log(`Campo: "${name}" | Tipo: ${type} | Valor: ${value}`);
    });

  } catch (error) {
    console.error('Error al leer campos: ' + error.stack);
  }
}
