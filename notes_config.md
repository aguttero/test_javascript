Configure .gs files in VS Code

option 1:
Abre un archivo .gs.
Presiona Ctrl+Shift+P (o Cmd+Shift+P en Mac) y escribe "Change Language Mode".
Selecciona "Configure File Association for '.gs'..." y elige JavaScript.

option 2:

Manualmente en settings.json:
Añade la siguiente línea a tu archivo de configuración para que sea permanente:

"files.associations": {
    "*.gs": "javascript"
}

Instala los tipos de Google Apps Script: En la terminal de tu proyecto.

Ejecuta:
npm install --save-dev @types/google-apps-script

(Usamos --save-dev porque solo necesitas estos tipos durante el desarrollo, no para ejecutar el código en Google).

Requisitos previos:
Debes tener un archivo package.json en tu carpeta. Si no lo tienes, créalo rápidamente con npm init -y.

Asegúrate de que VS Code detecte el archivo node_modules resultante para que el autocompletado se active al instante.

¿Ya tienes instalado Node.js en tu equipo para ejecutar el comando npm, o necesitas ayuda para verificarlo? (Es necesario para gestionar estas librerías de tipos).




