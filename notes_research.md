Aprender pdf-lib

Sitio oficial
pdf-lib.js.org

Libreria on-line
<script src="https://unpkg.com/pdf-lib"></script>
https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js

If you aren't using a package manager, UMD modules are available on the unpkg and jsDelivr CDNs:

https://unpkg.com/pdf-lib/dist/pdf-lib.js
https://unpkg.com/pdf-lib/dist/pdf-lib.min.js
https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.js
https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js
NOTE: if you are using the CDN scripts in production, you should include a specific version number in the URL, for example:
https://unpkg.com/pdf-lib@1.4.0/dist/pdf-lib.min.js
https://cdn.jsdelivr.net/npm/pdf-lib@1.4.0/dist/pdf-lib.min.js




GitHub:
https://github.com/Hopding/pdf-lib


Tutoriales con Google Apps Script:
Amit Agarwal (Labnol.org)
https://www.labnol.org/




https://stackoverflow.com/questions/73166361/how-to-use-a-external-javascript-library-pdf-lib-in-apps-script


: Es probablemente el mejor tutorial para GAS. Explica cómo cargar la librería y usarla para tareas comunes como unir PDFs almacenados en Google Drive.

Tanaike's Blog: Este desarrollador japonés es una leyenda en la comunidad de Apps Script. Busca "pdf-lib" en su sitio para encontrar soluciones a problemas muy específicos y avanzados de rendimiento.
https://tanaikech.github.io/


Comunidad y Soporte:
Stack Overflow (etiqueta pdf-lib): Para errores específicos de código.
Discord de pdf-lib: Si te quedas muy trabado, el autor y otros desarrolladores suelen responder dudas ahí.

---
EXTRACCION DE DATOS

Para extraer datos de un PDF con pdf-lib en Apps Script: 
pdf-lib es excelente para leer formularios (campos rellenables), 
pero no es la mejor para extraer texto libre (como párrafos de un contrato).

async function extraerDatosFormulario(fileId) {
  const bytes = DriveApp.getFileById(fileId).getBlob().getBytes();
  const pdfDoc = await PDFLib.PDFDocument.load(bytes);
  const form = pdfDoc.getForm();
  const campos = form.getFields();

  campos.forEach(campo => {
    const nombre = campo.getName();
    const valor = campo.getText(); // O .getValue() según el tipo
    console.log(`Campo: ${nombre}, Valor: ${valor}`);
  });
}

TEXTO LIBRE:

Google Drive OCR (Recomendado para el Banco): Es nativo, no requiere librerías externas y funciona muy bien con PDFs escaneados.

function ocrExtraerTexto(fileId) {
  const resource = { title: "Temp_OCR", mimeType: "application/pdf" };
  const config = { ocr: true, ocrLanguage: "es" };

  // Crea una copia en Google Docs (esto dispara el OCR)
  const doc = Drive.Files.copy(resource, fileId, config);
  const texto = DocumentApp.openById(doc.id).getBody().getText();

  // Borra el archivo temporal
  Drive.Files.remove(doc.id);
  return texto;
}

Documentación específica para extracción:
Guía de Formularios en pdf-lib: Mira los métodos getTextField, getCheckBox, etc.
Tutorial de Tanaike para leer PDFs: Explica cómo usar el truco del OCR para sacar texto de archivos difíciles.