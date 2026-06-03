/**
 * ==========================================================================
 * BACKEND BRIDGE - GOOGLE APPS SCRIPT (ASISTENCIQR)
 * ==========================================================================
 * 
 * Este script debe colocarse dentro de tu hoja de Google Sheets.
 * 
 * INSTRUCCIONES RÁPIDAS:
 * 1. Abre tu Google Sheet.
 * 2. Ve a "Extensiones" -> "Apps Script".
 * 3. Borra el código por defecto y pega este archivo completo.
 * 4. Guarda con el icono del disco.
 * 5. Haz clic en "Implementar" -> "Nueva implementación".
 * 6. Selecciona tipo: "Aplicación Web".
 * 7. Configura:
 *    - Descripción: Conexión AsistenciQR
 *    - Ejecutar como: "Yo" (tu correo de Gmail)
 *    - Quién tiene acceso: "Cualquier persona" (esencial para que los recepcionistas puedan registrar)
 * 8. Haz clic en "Implementar", autoriza los accesos de tu propia cuenta y copia la "URL de la aplicación web".
 * 9. Pega esa URL en la sección "Configuración" de la App Web y desactiva el "Modo Simulador".
 */

// Cabeceras para permitir CORS de forma limpia en peticiones de prueba GET
function getCorsResponse(obj) {
  var JSONString = JSON.stringify(obj);
  return ContentService.createTextOutput(JSONString)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Petición GET: Utilizada para pruebas de conexión (Ping) y verificaciones
 */
function doGet(e) {
  try {
    var action = e.parameter.action;
    
    // Test de conexión rápido (Ping/Pong)
    if (action === "ping") {
      return getCorsResponse({
        status: "pong",
        message: "¡Conexión establecida con éxito!",
        sheetName: SpreadsheetApp.getActiveSpreadsheet().getName()
      });
    }
    
    return getCorsResponse({
      status: "error",
      message: "Acción no reconocida en método GET."
    });
  } catch (err) {
    return getCorsResponse({
      status: "error",
      message: err.toString()
    });
  }
}

/**
 * Petición POST: Registra el asistente escaneado en la hoja de Google Sheets
 */
function doPost(e) {
  try {
    // Obtener los datos JSON enviados por la aplicación web
    var postData = JSON.parse(e.postData.contents);
    
    var nombre = postData.nombre || "Desconocido";
    var afiliacion = postData.afiliacion || "Sin Afiliación";
    var metodo = postData.metodo || "QR";
    
    // Obtener o crear fecha
    var fechaRegistro = new Date();
    if (postData.timestamp) {
      fechaRegistro = new Date(postData.timestamp);
    }
    
    // Formatear fecha para la celda de Excel de forma amigable (DD/MM/AAAA HH:MM:SS)
    var fechaFormateada = Utilities.formatDate(fechaRegistro, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

    // Acceder a la hoja activa de cálculo
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Si la hoja está completamente vacía, podemos crear automáticamente la cabecera
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Fecha y Hora", "Nombre Completo", "Afiliación / Institución", "Método de Registro", "Dispositivo / Recepción"]);
      // Dar estilo de negrita a la cabecera
      sheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#f1f5f9");
    }

    // Agregar la fila con la información recibida
    // Puedes personalizar las columnas aquí
    sheet.appendRow([
      fechaFormateada,
      nombre,
      afiliacion,
      metodo,
      "Mesa de Control" // Identificador por defecto del recepcionista
    ]);

    // Responder con éxito
    return getCorsResponse({
      status: "success",
      message: "Registro guardado exitosamente en Google Sheets.",
      row: sheet.getLastRow()
    });
    
  } catch (err) {
    return getCorsResponse({
      status: "error",
      message: "Error procesando registro en Apps Script: " + err.toString()
    });
  }
}
