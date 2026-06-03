# 📝 Guía de Integración: AsistenciQR y Google Sheets

Sigue esta guía paso a paso en castellano para enlazar tu aplicación web de escaneo de códigos QR directamente con una hoja de cálculo en tu cuenta personal de Google Drive.

---

## 📅 Paso 1: Preparar tu Google Sheet
1. Entra a tu cuenta de Gmail y abre [Google Sheets (Hojas de cálculo de Google)](https://sheets.google.com).
2. Crea una **nueva hoja de cálculo en blanco**.
3. Cámbiale el nombre en la esquina superior izquierda a algo representativo, por ejemplo: `Control Asistencia - Congreso Científico`.
4. *(Opcional)* En la primera fila (Fila 1), puedes escribir los siguientes títulos en las columnas para tener una estructura ordenada (el script los creará automáticamente si está vacía):
   * **Columna A:** `Fecha y Hora`
   * **Columna B:** `Nombre Completo`
   * **Columna C:** `Afiliación / Institución`
   * **Columna D:** `Método de Registro`
   * **Columna E:** `Dispositivo / Recepción`

---

## 💻 Paso 2: Pegar el Código en Google Apps Script
1. Dentro de tu hoja de cálculo, haz clic en el menú superior: **Extensiones** ➔ **Apps Script**.
2. Se abrirá una nueva ventana del editor. Por defecto verás una función vacía `myFunction()`.
3. Abre el archivo [google_apps_script.js](file:///d:/Antigravity/Ejemplo/google_apps_script.js) que se encuentra en esta misma carpeta, copia todo su contenido.
4. **Borra** todo lo que haya en el editor de Apps Script y **pega** el código copiado.
5. Haz clic en el botón con icono de **Disco (Guardar proyecto)** en la barra de herramientas. Puedes asignarle un nombre al proyecto del script, por ejemplo: `Script de Asistencia QR`.

---

## 🚀 Paso 3: Implementar como Aplicación Web (Deploy)
Para que la aplicación web pueda enviar información a tu hoja de cálculo, debemos "publicar" el script como un punto de acceso seguro.

1. En la esquina superior derecha del editor, haz clic en el botón azul: **Implementar** (o *Deploy*) ➔ **Nueva implementación** (*New deployment*).
2. En la ventana emergente, haz clic en el icono del **engranaje** junto a "Seleccionar tipo" y selecciona **Aplicación web** (*Web app*).
3. Configura las siguientes opciones exactamente así:
   * **Descripción:** `Conector AsistenciQR`
   * **Ejecutar como:** **Yo** (`tu-correo@gmail.com`)
   * **Quién tiene acceso:** **Cualquier persona** (o *Anyone*).
     > ⚠️ **IMPORTANTE:** Debes seleccionar *"Cualquier persona"* (incluso anónimos). Esto permite que la aplicación web que usas en el navegador pueda enviar el registro del QR sin pedirle a cada recepcionista iniciar sesión con sus cuentas personales de Google, manteniendo tus credenciales 100% seguras.
4. Haz clic en el botón azul **Implementar**.
5. **Autorizar accesos:** La primera vez, Google te pedirá autorizar el acceso del script a tu hoja.
   * Haz clic en **Autorizar acceso**.
   * Elige tu cuenta de Gmail.
   * Si te aparece un aviso de seguridad ("Google no ha verificado esta aplicación"), haz clic abajo a la izquierda en **Configuración Avanzada** (o *Advanced*) y luego en **Ir a Script de Asistencia QR (no seguro)**.
   * Haz clic en **Permitir**.
6. Una vez completado, verás una pantalla que dice *"Implementación completada correctamente"*.
7. Copia el enlace largo que aparece bajo el título **URL de la aplicación web** (debe terminar en `/exec`).

---

## ⚙️ Paso 4: Configurar la Aplicación Web
1. Abre tu aplicación web `index.html` en tu navegador.
2. Ve a la pestaña **Configuración**.
3. **Desactiva el Modo Simulador** haciendo clic en el interruptor (*switch*).
4. Pega la URL que copiaste en el paso anterior dentro del campo **URL de Google Apps Script**.
5. Haz clic en el botón **Guardar Configuración**.
6. Haz clic en el botón **Probar Conexión**. La aplicación hará un envío rápido y te mostrará un mensaje flotante verde indicando que se ha conectado correctamente.

¡Felicidades! A partir de este momento, cada código QR que escaneen los recepcionistas (o registro manual que realicen) quedará grabado automáticamente y al instante en tu Google Sheet, ordenado por fecha y hora exacta.

---

## 💡 Consejos de Uso durante el Congreso
* **Uso Multidispositivo:** Al ser una aplicación web estática, puedes alojar esta carpeta en cualquier servidor (como GitHub Pages de forma gratuita) o incluso abrir el archivo `index.html` en múltiples dispositivos con cámara que compartan la misma URL de Google Apps Script. ¡Todos los recepcionistas grabarán en la misma hoja simultáneamente sin colisiones!
* **Resiliencia ante caídas de Red:** Si a algún recepcionista se le cae la red de internet en medio del registro, la aplicación seguirá leyendo los QR y almacenándolos de manera interna y segura en la memoria del dispositivo. En el historial verá un estado "Pendiente". Al recuperar internet, o al presionar el botón "Sincronizar Pendientes", todo se registrará en la nube sin duplicarse.
