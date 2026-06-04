/* ==========================================================================
   LÓGICA DE APLICACIÓN - ASISTENCIQR (JS VANILLA)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. CONFIGURACIÓN Y ESTADO DE LA APLICACIÓN
    let appState = {
        simulatorMode: false,
        sheetsUrl: '',
        history: [],
        activeTab: 'scan',
        isOffline: !navigator.onLine,
        isAudioEnabled: true,
        activeCameraId: null,
        isScannerRunning: false
    };

    // Objeto global de la biblioteca html5-qrcode
    let html5QrScanner = null;
    let isProcessingScan = false; // Prevención de lecturas duplicadas continuas
    let scanTimeout = null;

    // Instancia de AudioContext (se inicia con un gesto del usuario)
    let audioCtx = null;

    // 2. ELEMENTOS DEL DOM
    const elements = {
        // Conexión
        connectionStatus: document.getElementById('connectionStatus'),
        
        // Pestañas
        tabBtnScan: document.getElementById('tabBtnScan'),
        tabBtnManual: document.getElementById('tabBtnManual'),
        tabBtnHistory: document.getElementById('tabBtnHistory'),
        tabBtnSettings: document.getElementById('tabBtnSettings'),
        panelScan: document.getElementById('panel-scan'),
        panelManual: document.getElementById('panel-manual'),
        panelHistory: document.getElementById('panel-history'),
        panelSettings: document.getElementById('panel-settings'),
        offlineBadge: document.getElementById('offlineBadge'),
        
        // Escáner QR
        cameraSelect: document.getElementById('cameraSelect'),
        btnToggleCamera: document.getElementById('btnToggleCamera'),
        btnToggleAudio: document.getElementById('btnToggleAudio'),
        audioIcon: document.getElementById('audioIcon'),
        scannerOverlay: document.getElementById('scannerOverlay'),
        viewportWrapper: document.querySelector('.scanner-viewport-wrapper'),
        sidebarRecentContent: document.getElementById('sidebarRecentContent'),
        
        // Formulario Manual
        manualRegisterForm: document.getElementById('manualRegisterForm'),
        manualName: document.getElementById('manualName'),
        manualAffiliation: document.getElementById('manualAffiliation'),
        
        // Historial
        historyTableBody: document.getElementById('historyTableBody'),
        btnSyncOffline: document.getElementById('btnSyncOffline'),
        btnClearHistory: document.getElementById('btnClearHistory'),
        
        // Configuración
        settingSimulatorMode: document.getElementById('settingSimulatorMode'),
        settingSheetsUrl: document.getElementById('settingSheetsUrl'),
        googleSheetsUrlGroup: document.getElementById('googleSheetsUrlGroup'),
        btnSaveSettings: document.getElementById('btnSaveSettings'),
        btnTestSheetsConnection: document.getElementById('btnTestSheetsConnection'),
        btnResetSimulator: document.getElementById('btnResetSimulator'),
        
        // Banner de Feedback
        feedbackBanner: document.getElementById('feedbackBanner'),
        feedbackCard: document.getElementById('feedbackCard'),
        feedbackIcon: document.getElementById('feedbackIcon'),
        feedbackStatusTitle: document.getElementById('feedbackStatusTitle'),
        feedName: document.getElementById('feedName'),
        feedAffiliation: document.getElementById('feedAffiliation'),
        closeFeedbackBtn: document.getElementById('closeFeedbackBtn')
    };

    // 3. INICIALIZACIÓN
    function init() {
        // Cargar configuración guardada de LocalStorage
        loadSettingsFromLocalStorage();
        
        // Inicializar iconos de Lucide
        lucide.createIcons();
        
        // Detectar estado de conexión
        updateConnectionUI();
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);
        
        // Registrar Eventos
        registerEvents();
        
        // Renderizar Historial Inicial
        renderHistory();
        
        // Configurar Cámaras Iniciales
        queryCameras();
        
        // Intentar autoejecutar sincronización al iniciar si hay red
        if (!appState.isOffline) {
            syncOfflineRecords();
        }
    }

    // Cargar parámetros de configuración local
    function loadSettingsFromLocalStorage() {
        const savedSimulator = localStorage.getItem('qr_simulator_mode');
        const savedUrl = localStorage.getItem('qr_sheets_url');
        const savedHistory = localStorage.getItem('qr_attendance_history');
        const savedAudio = localStorage.getItem('qr_audio_enabled');

        if (savedSimulator !== null) {
            appState.simulatorMode = savedSimulator === 'true';
        }
        if (savedUrl !== null) {
            appState.sheetsUrl = savedUrl;
        }
        if (savedHistory !== null) {
            appState.history = JSON.parse(savedHistory);
        }
        if (savedAudio !== null) {
            appState.isAudioEnabled = savedAudio === 'true';
        }

        // Aplicar estado inicial a los inputs
        elements.settingSimulatorMode.checked = appState.simulatorMode;
        elements.settingSheetsUrl.value = appState.sheetsUrl;
        elements.settingSheetsUrl.disabled = appState.simulatorMode;
        
        if (appState.simulatorMode) {
            elements.googleSheetsUrlGroup.classList.add('disabled-field-group');
            elements.btnTestSheetsConnection.disabled = true;
        } else {
            elements.googleSheetsUrlGroup.classList.remove('disabled-field-group');
            elements.btnTestSheetsConnection.disabled = !appState.sheetsUrl;
        }

        // Configurar icono de audio
        updateAudioButtonUI();
    }

    // 4. REGISTRO DE EVENTOS
    function registerEvents() {
        // Navegación de Pestañas (Tabs)
        const tabs = [
            { btn: elements.tabBtnScan, panel: elements.panelScan, name: 'scan' },
            { btn: elements.tabBtnManual, panel: elements.panelManual, name: 'manual' },
            { btn: elements.tabBtnHistory, panel: elements.panelHistory, name: 'history' },
            { btn: elements.tabBtnSettings, panel: elements.panelSettings, name: 'settings' }
        ];

        tabs.forEach(tab => {
            tab.btn.addEventListener('click', () => {
                // Detener cámara si salimos de la pestaña de escaneo
                if (appState.activeTab === 'scan' && tab.name !== 'scan' && appState.isScannerRunning) {
                    stopCamera();
                }
                
                // Activar pestaña
                tabs.forEach(t => {
                    t.btn.classList.remove('active');
                    t.panel.classList.remove('active');
                });
                tab.btn.classList.add('active');
                tab.panel.classList.add('active');
                appState.activeTab = tab.name;
                
                // Inicializar gestos de audio para permitir síntesis de sonido en navegadores móviles
                initAudioContext();
            });
        });

        // Configuración
        elements.settingSimulatorMode.addEventListener('change', (e) => {
            const isSimulator = e.target.checked;
            elements.settingSheetsUrl.disabled = isSimulator;
            elements.btnTestSheetsConnection.disabled = isSimulator || !elements.settingSheetsUrl.value;
            
            if (isSimulator) {
                elements.googleSheetsUrlGroup.classList.add('disabled-field-group');
            } else {
                elements.googleSheetsUrlGroup.classList.remove('disabled-field-group');
            }
        });

        elements.settingSheetsUrl.addEventListener('input', (e) => {
            elements.btnTestSheetsConnection.disabled = elements.settingSimulatorMode.checked || !e.target.value;
        });

        elements.btnSaveSettings.addEventListener('click', saveSettings);
        elements.btnTestSheetsConnection.addEventListener('click', testSheetsConnection);
        elements.btnResetSimulator.addEventListener('click', () => {
            localStorage.removeItem('qr_simulator_mode');
            location.reload();
        });

        // Control de Escáner
        elements.btnToggleCamera.addEventListener('click', () => {
            initAudioContext();
            if (appState.isScannerRunning) {
                stopCamera();
            } else {
                startCamera();
            }
        });

        elements.btnToggleAudio.addEventListener('click', () => {
            appState.isAudioEnabled = !appState.isAudioEnabled;
            localStorage.setItem('qr_audio_enabled', appState.isAudioEnabled);
            updateAudioButtonUI();
            initAudioContext();
            
            // Tocar un bip corto de prueba
            if (appState.isAudioEnabled) {
                playSuccessSound();
            }
        });

        // Feedback Banner
        elements.closeFeedbackBtn.addEventListener('click', hideFeedback);

        // Formulario Registro Manual
        elements.manualRegisterForm.addEventListener('submit', handleManualSubmit);

        // Acciones del Historial
        elements.btnSyncOffline.addEventListener('click', () => {
            initAudioContext();
            syncOfflineRecords();
        });
        
        elements.btnClearHistory.addEventListener('click', clearHistory);
    }

    // 5. GENERACIÓN SINTÉTICA DE AUDIO (WEB AUDIO API)
    // Inicializar el contexto de audio perezosamente con interacción del usuario
    function initAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    function updateAudioButtonUI() {
        if (appState.isAudioEnabled) {
            elements.audioIcon.setAttribute('data-lucide', 'volume-2');
            elements.btnToggleAudio.classList.remove('muted');
        } else {
            elements.audioIcon.setAttribute('data-lucide', 'volume-x');
            elements.btnToggleAudio.classList.add('muted');
        }
        lucide.createIcons();
    }

    // Sonido Satisfactorio: bip doble agudo y limpio
    function playSuccessSound() {
        if (!appState.isAudioEnabled) return;
        try {
            initAudioContext();
            const now = audioCtx.currentTime;
            
            // Primer Tono (Nota A5)
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(880, now);
            osc1.frequency.exponentialRampToValueAtTime(1100, now + 0.08);
            
            gain1.gain.setValueAtTime(0.12, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.start(now);
            osc1.stop(now + 0.12);
            
            // Segundo Tono (Nota E6) con ligero retardo
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1320, now + 0.07);
            
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.setValueAtTime(0.12, now + 0.07);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
            
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start(now + 0.07);
            osc2.stop(now + 0.22);
        } catch (e) {
            console.error("No se pudo reproducir el audio sintético de éxito:", e);
        }
    }

    // Sonido de Error: doble tono grave vibrante
    function playErrorSound() {
        if (!appState.isAudioEnabled) return;
        try {
            initAudioContext();
            const now = audioCtx.currentTime;
            
            // Primer Zumbido Grave (Nota A3)
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(220, now);
            
            gain1.gain.setValueAtTime(0.2, now);
            gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
            
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.start(now);
            osc1.stop(now + 0.18);
            
            // Segundo Zumbido Grave (Nota F#3) con retardo
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(185, now + 0.2);
            
            gain2.gain.setValueAtTime(0, now);
            gain2.gain.setValueAtTime(0.2, now + 0.2);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.38);
            
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start(now + 0.2);
            osc2.stop(now + 0.38);
        } catch (e) {
            console.error("No se pudo reproducir el audio sintético de error:", e);
        }
    }

    // 6. LÓGICA DE DETECCION DE CÁMARAS Y ESCÁNER QR
    async function queryCameras() {
        try {
            // Solicitar permisos y obtener lista de cámaras disponibles
            const devices = await Html5Qrcode.getCameras();
            
            if (devices && devices.length > 0) {
                elements.cameraSelect.innerHTML = '';
                devices.forEach((device, index) => {
                    const option = document.createElement('option');
                    option.value = device.id;
                    // Nombrar cámara de forma amigable en castellano
                    let label = device.label || `Cámara ${index + 1}`;
                    if (label.toLowerCase().includes('back') || label.toLowerCase().includes('trasera')) {
                        label += ' (Trasera - Recomendada)';
                    } else if (label.toLowerCase().includes('front') || label.toLowerCase().includes('frontal')) {
                        label += ' (Frontal)';
                    }
                    option.text = label;
                    elements.cameraSelect.appendChild(option);
                });
                
                // Preseleccionar la cámara trasera si existe
                const backCamera = devices.find(device => 
                    device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('trasera') ||
                    device.label.toLowerCase().includes('environment')
                );
                
                if (backCamera) {
                    elements.cameraSelect.value = backCamera.id;
                    appState.activeCameraId = backCamera.id;
                } else {
                    appState.activeCameraId = devices[0].id;
                }
            } else {
                elements.cameraSelect.innerHTML = '<option value="">No se encontraron cámaras</option>';
            }
        } catch (err) {
            console.error("Error listando cámaras:", err);
            elements.cameraSelect.innerHTML = '<option value="">Sin permisos de cámara</option>';
        }
    }

    function startCamera() {
        const selectedId = elements.cameraSelect.value;
        if (!selectedId) {
            showInstantFeedback("Error", "No hay una cámara seleccionada o disponible.", false);
            playErrorSound();
            return;
        }

        // Crear instancia si no existe
        if (!html5QrScanner) {
            html5QrScanner = new Html5Qrcode("reader");
        }

        // Configuración de escaneo sin visor nativo para usar nuestro visor CSS premium al 100%
        const config = {
            fps: 15,
            aspectRatio: 1.333333
        };

        elements.btnToggleCamera.disabled = true;
        elements.btnToggleCamera.innerHTML = '<i class="spinning-icon" data-lucide="loader-2"></i><span>Iniciando...</span>';
        lucide.createIcons();

        html5QrScanner.start(
            selectedId, 
            config, 
            onQrCodeSuccess, 
            onQrCodeError
        ).then(() => {
            appState.isScannerRunning = true;
            appState.activeCameraId = selectedId;
            
            elements.viewportWrapper.classList.add('camera-on');
            elements.btnToggleCamera.disabled = false;
            elements.btnToggleCamera.classList.remove('btn-primary');
            elements.btnToggleCamera.classList.add('btn-danger-outline');
            elements.btnToggleCamera.innerHTML = '<i data-lucide="power"></i><span>Apagar Cámara</span>';
            lucide.createIcons();
        }).catch(err => {
            console.error("Error iniciando cámara:", err);
            appState.isScannerRunning = false;
            elements.viewportWrapper.classList.remove('camera-on');
            elements.btnToggleCamera.disabled = false;
            elements.btnToggleCamera.classList.add('btn-primary');
            elements.btnToggleCamera.classList.remove('btn-danger-outline');
            elements.btnToggleCamera.innerHTML = '<i data-lucide="power"></i><span>Iniciar Cámara</span>';
            lucide.createIcons();
            
            showInstantFeedback("Error de Cámara", "No se pudo acceder a la cámara. Asegúrate de dar permisos e intentar nuevamente.", false);
            playErrorSound();
        });
    }

    function stopCamera() {
        if (!html5QrScanner || !appState.isScannerRunning) return;

        elements.btnToggleCamera.disabled = true;
        elements.btnToggleCamera.innerHTML = '<i class="spinning-icon" data-lucide="loader-2"></i><span>Apagando...</span>';
        lucide.createIcons();

        html5QrScanner.stop().then(() => {
            appState.isScannerRunning = false;
            elements.viewportWrapper.classList.remove('camera-on');
            elements.btnToggleCamera.disabled = false;
            elements.btnToggleCamera.classList.add('btn-primary');
            elements.btnToggleCamera.classList.remove('btn-danger-outline');
            elements.btnToggleCamera.innerHTML = '<i data-lucide="power"></i><span>Iniciar Cámara</span>';
            lucide.createIcons();
        }).catch(err => {
            console.error("Error apagando cámara:", err);
            // Forzar reseteo del botón en el DOM
            appState.isScannerRunning = false;
            elements.viewportWrapper.classList.remove('camera-on');
            elements.btnToggleCamera.disabled = false;
            elements.btnToggleCamera.innerHTML = '<i data-lucide="power"></i><span>Iniciar Cámara</span>';
            lucide.createIcons();
        });
    }

    // Callback de lectura exitosa del código QR
    function onQrCodeSuccess(decodedText, decodedResult) {
        if (isProcessingScan) return; // Ignorar lecturas continuas mientras procesamos
        
        isProcessingScan = true;
        
        // Establecer un timeout de enfriamiento (3 segundos) para que la cámara no vuelva a leer inmediatamente
        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
            isProcessingScan = false;
        }, 3500);

        // Procesar la cadena QR
        // Formato esperado: "Nombre|Afiliacion"
        let name = "Asistente Desconocido";
        let affiliation = "Sin Afiliación";

        if (decodedText.includes('|')) {
            const parts = decodedText.split('|');
            name = parts[0].trim();
            affiliation = parts[1].trim();
            
            // Limpiar etiquetas opcionales como "Nombre:" o "Afiliación:" si el usuario las incluyó
            name = name.replace(/^(nombre|name):\s*/i, "");
            affiliation = affiliation.replace(/^(afiliación|afiliacion|institution|institución|afiliación):\s*/i, "");
        } else {
            // Si el QR tiene un formato simple (solo el nombre), capturar todo
            name = decodedText.trim();
        }

        // Registrar asistencia automáticamente
        registerAttendance(name, affiliation, 'QR');

        // Mantener la cámara activa 2.0s para que se vea la animación de escaneo
        setTimeout(() => {
            stopCamera();
        }, 2000);
    }

    function onQrCodeError(errorMessage) {
        // html5-qrcode genera eventos continuos de "buscando" que se pueden ignorar silenciosamente
    }

    // 7. REGISTRO DE ASISTENCIA Y COMUNICACIÓN API
    async function registerAttendance(name, affiliation, method = 'QR') {
        const timestamp = new Date().toISOString();
        const displayTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        // Crear registro básico de asistencia local
        const record = {
            id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: timestamp,
            displayTime: displayTime,
            name: name,
            affiliation: affiliation,
            method: method,
            syncStatus: 'pending' // Estado por defecto
        };

        // Si estamos en MODO SIMULADOR
        if (appState.simulatorMode) {
            record.syncStatus = 'success';
            appState.history.unshift(record);
            saveHistoryToLocalStorage();
            
            renderHistory();
            updateRecentScanSidebar(record);
            showInstantFeedback("¡Registro Exitoso! (Simulado)", name, true, affiliation);
            playSuccessSound();
            return;
        }

        // Guardar siempre localmente primero (instantáneo, sin esperar red)
        appState.history.unshift(record);
        saveHistoryToLocalStorage();
        renderHistory();
        updateRecentScanSidebar(record);
        updateOfflineBadge();

        showInstantFeedback("¡Registrado!", `${name} — Guardado localmente`, true, affiliation);
        playSuccessSound();
    }

    // Formulario Registro Manual
    function handleManualSubmit(e) {
        e.preventDefault();
        
        const name = elements.manualName.value.trim();
        const affiliation = elements.manualAffiliation.value.trim();
        
        if (!name || !affiliation) {
            showInstantFeedback("Campos vacíos", "Por favor completa el nombre y la afiliación.", false);
            playErrorSound();
            return;
        }

        registerAttendance(name, affiliation, 'Manual');
        
        // Limpiar formulario y cambiar de pestaña de forma sutil
        elements.manualName.value = '';
        elements.manualAffiliation.value = '';
        
        // Ir a la pestaña del historial después de 800ms para que vea su registro
        setTimeout(() => {
            elements.tabBtnHistory.click();
        }, 800);
    }

    // 8. SINCRONIZACIÓN OFFLINE (RESILIENCIA)
    async function syncOfflineRecords() {
        if (appState.simulatorMode) {
            showInstantFeedback("Modo Simulador", "No es necesario sincronizar en modo simulador.", true);
            return;
        }

        if (appState.isOffline) {
            showInstantFeedback("Sin Conexión", "No se puede sincronizar porque tu dispositivo no tiene acceso a internet.", false);
            playErrorSound();
            return;
        }

        if (!appState.sheetsUrl) {
            showInstantFeedback("Configuración Faltante", "Por favor configura la URL de tu Google Apps Script en la pestaña Configuración.", false);
            playErrorSound();
            return;
        }

        const pendingRecords = appState.history.filter(rec => rec.syncStatus === 'pending');
        
        if (pendingRecords.length === 0) {
            showInstantFeedback("Historial Sincronizado", "Todos los registros ya están en Google Sheets.", true);
            return;
        }

        elements.btnSyncOffline.disabled = true;
        elements.btnSyncOffline.innerHTML = '<i class="spinning-icon" data-lucide="refresh-cw"></i><span>Sincronizando...</span>';
        lucide.createIcons();

        let successCount = 0;
        
        for (const record of pendingRecords) {
            try {
                await fetch(appState.sheetsUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        nombre: record.name,
                        afiliacion: record.affiliation,
                        metodo: record.method,
                        timestamp: record.timestamp
                    })
                });

                record.syncStatus = 'success';
                successCount++;
                updateRecordStatus(record.id, 'success');
            } catch (err) {
                console.error(`Fallo la sincronización individual para registro ${record.id}:`, err);
            }
        }

        elements.btnSyncOffline.disabled = false;
        elements.btnSyncOffline.innerHTML = '<i data-lucide="refresh-cw"></i><span>Sincronizar Pendientes</span>';
        lucide.createIcons();

        saveHistoryToLocalStorage();
        renderHistory();
        updateOfflineBadge();

        if (successCount > 0) {
            showInstantFeedback("Sincronización Completa", `Se subieron con éxito ${successCount} registros a tu Google Sheets.`, true);
            playSuccessSound();
        } else {
            showInstantFeedback("Sincronización Fallida", "No se pudo comunicar con Google Sheets. Revisa la URL e internet.", false);
            playErrorSound();
        }
    }

    // 9. CONFIGURACIÓN DEL SISTEMA
    function saveSettings() {
        const simulator = elements.settingSimulatorMode.checked;
        const url = elements.settingSheetsUrl.value.trim();

        if (!simulator && !url) {
            showInstantFeedback("Enlace requerido", "Si desactivas el Modo Simulador, debes ingresar la URL de Google Apps Script.", false);
            playErrorSound();
            return;
        }

        appState.simulatorMode = simulator;
        appState.sheetsUrl = url;

        localStorage.setItem('qr_simulator_mode', simulator);
        localStorage.setItem('qr_sheets_url', url);

        showInstantFeedback("Configuración Guardada", "Los cambios han sido almacenados de forma segura en tu navegador.", true);
        playSuccessSound();
        
        // Refrescar estado de UI de campos
        loadSettingsFromLocalStorage();
    }

    async function testSheetsConnection() {
        const url = elements.settingSheetsUrl.value.trim();
        if (!url) return;

        elements.btnTestSheetsConnection.disabled = true;
        elements.btnTestSheetsConnection.innerHTML = '<i class="spinning-icon" data-lucide="loader-2"></i><span>Probando...</span>';
        lucide.createIcons();

        try {
            // Realizar una petición GET de ping al Apps Script
            const response = await fetch(url + '?action=ping', {
                method: 'GET',
                mode: 'cors' // Permitimos cors para el test (el backend configurado responderá cabeceras CORS de forma limpia)
            });
            const data = await response.json();

            if (data && data.status === 'pong') {
                showInstantFeedback("Conexión Exitosa", "¡Excelente! La aplicación se comunica correctamente con tu Google Sheet.", true);
                playSuccessSound();
            } else {
                throw new Error("Respuesta no estructurada");
            }
        } catch (err) {
            console.error("Error probando conexión:", err);
            // La mayoría de veces da error de CORS si no se configuró bien, pero se puede haber enviado.
            // Le indicamos al usuario una recomendación clara
            showInstantFeedback(
                "Verificar Configuración", 
                "No se pudo completar el test automático. Revisa que tu Apps Script esté implementado como 'Aplicación Web' y que en accesos tenga configurado 'Cualquier persona' (incluso anónimos).", 
                false
            );
            playErrorSound();
        } finally {
            elements.btnTestSheetsConnection.disabled = false;
            elements.btnTestSheetsConnection.innerHTML = '<i data-lucide="database"></i><span>Probar Conexión</span>';
            lucide.createIcons();
        }
    }

    // 10. CONTROL DE LA INTERFAZ DE USUARIO (RENDERIZACIÓN)
    
    // Alertas Flotantes Dinámicas
    function showInstantFeedback(title, name, isSuccess, affiliation = "") {
        // Configurar clase y contenido del banner
        elements.feedbackCard.className = 'feedback-card ' + (isSuccess ? 'success-state' : 'error-state');
        elements.feedbackStatusTitle.textContent = title;
        elements.feedName.textContent = name;
        elements.feedAffiliation.textContent = affiliation || (isSuccess ? "Control de asistencia" : "Verifique el estado o vuelva a escanear");
        
        // Icono de Lucide
        elements.feedbackIcon.innerHTML = isSuccess 
            ? '<i data-lucide="check-circle-2"></i>' 
            : '<i data-lucide="shield-alert"></i>';
        
        lucide.createIcons();
        
        // Mostrar
        elements.feedbackBanner.classList.remove('hidden');
        
        // Auto-ocultar después de 6 segundos
        const bannerTimeout = setTimeout(() => {
            hideFeedback();
        }, 6000);
        
        // Guardar el id del timeout en el elemento para poder cancelarlo si lo cierran antes
        elements.feedbackBanner.dataset.timeoutId = bannerTimeout;
    }

    function hideFeedback() {
        const timeoutId = elements.feedbackBanner.dataset.timeoutId;
        if (timeoutId) clearTimeout(parseInt(timeoutId));
        
        elements.feedbackBanner.classList.add('hidden');
    }

    // Actualizar Panel Lateral (Último Registro)
    function updateRecentScanSidebar(record) {
        if (!record) {
            elements.sidebarRecentContent.innerHTML = `
                <div class="empty-recent-state">
                    <i data-lucide="qr-code"></i>
                    <p>No se ha escaneado ningún QR en esta sesión.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        const syncBadgeClass = record.syncStatus === 'success' ? 'synced' : 'pending';
        const syncBadgeText = record.syncStatus === 'success' ? 'Sincronizado' : 'Pendiente Offline';

        elements.sidebarRecentContent.innerHTML = `
            <div class="recent-scanned-card">
                <div class="card-head">
                    <span class="time-stamp"><i data-lucide="clock"></i> ${record.displayTime}</span>
                    <span class="sync-badge ${syncBadgeClass}" id="sidebarSyncBadge_${record.id}">${syncBadgeText}</span>
                </div>
                <div class="assistant-info-block">
                    <span class="label-tag">Nombre Completo</span>
                    <h5>${record.name}</h5>
                    <span class="label-tag">Afiliación / Institución</span>
                    <p>${record.affiliation}</p>
                </div>
                <div class="method-badge ${record.method === 'QR' ? 'qr' : 'manual'}" style="align-self: flex-start;">
                    MÉTODO: ${record.method.toUpperCase()}
                </div>
            </div>
        `;
        lucide.createIcons();
    }

    function updateRecentScanSidebarStatus(id, status) {
        const badge = document.getElementById(`sidebarSyncBadge_${id}`);
        if (!badge) return;

        if (status === 'enviando') {
            badge.className = 'sync-badge pending';
            badge.textContent = 'Enviando...';
        } else if (status === 'success') {
            badge.className = 'sync-badge synced';
            badge.textContent = 'Sincronizado';
        } else {
            badge.className = 'sync-badge pending';
            badge.textContent = 'Pendiente Offline';
        }
    }

    // Guardar historial
    function saveHistoryToLocalStorage() {
        localStorage.setItem('qr_attendance_history', JSON.stringify(appState.history));
    }

    // Renderizar Tabla de Historial
    function renderHistory() {
        if (appState.history.length === 0) {
            elements.historyTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-table-state">
                        <i data-lucide="inbox"></i>
                        <p>Aún no hay asistencias registradas en esta sesión.</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            updateOfflineBadge();
            return;
        }

        elements.historyTableBody.innerHTML = '';
        
        appState.history.forEach(record => {
            const tr = document.createElement('tr');
            
            const isSynced = record.syncStatus === 'success';
            const statusClass = isSynced ? 'sync-ok' : 'sync-pending';
            const statusText = isSynced ? 'Sincronizado' : 'Pendiente';
            const statusIcon = isSynced ? 'check' : 'cloud-off';

            const methodClass = record.method === 'QR' ? 'qr' : 'manual';
            
            tr.innerHTML = `
                <td><strong>${record.displayTime}</strong></td>
                <td>${record.name}</td>
                <td>${record.affiliation}</td>
                <td><span class="method-badge ${methodClass}">${record.method}</span></td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i data-lucide="${statusIcon}" style="width:14px; height:14px;"></i>
                        <span>${statusText}</span>
                    </span>
                </td>
            `;
            elements.historyTableBody.appendChild(tr);
        });

        lucide.createIcons();
        updateOfflineBadge();
    }

    // Actualizar badges e iconos de pendientes
    function updateOfflineBadge() {
        const pendingCount = appState.history.filter(rec => rec.syncStatus === 'pending').length;
        if (pendingCount > 0 && !appState.simulatorMode) {
            elements.offlineBadge.textContent = pendingCount;
            elements.offlineBadge.classList.remove('hidden');
            elements.btnSyncOffline.classList.remove('hidden');
        } else {
            elements.offlineBadge.classList.add('hidden');
            elements.btnSyncOffline.classList.add('hidden');
        }
    }

    // Actualizar estado de registro individual en caliente
    function updateRecordStatus(id, status) {
        const record = appState.history.find(rec => rec.id === id);
        if (record) {
            record.syncStatus = status;
        }
        saveHistoryToLocalStorage();
        renderHistory();
        
        // Actualizar también el panel lateral si corresponde
        updateRecentScanSidebarStatus(id, status);
    }

    // Limpiar historial
    function clearHistory() {
        if (confirm("¿Estás seguro de que deseas limpiar el historial local de esta sesión? Esto borrará el registro de pantalla (los datos guardados en Google Sheets no se verán afectados).")) {
            appState.history = [];
            saveHistoryToLocalStorage();
            renderHistory();
            updateRecentScanSidebar(null);
            showInstantFeedback("Historial Borrado", "El registro en este dispositivo ha sido limpiado.", true);
            playSuccessSound();
        }
    }

    // 11. DETECCION DE RED Y SINCRONIZACIÓN AUTOMÁTICA
    function handleOnlineStatus() {
        appState.isOffline = false;
        updateConnectionUI();
        
        // Al volver a estar en línea, disparar la sincronización en segundo plano de manera silenciosa
        if (!appState.simulatorMode) {
            syncOfflineRecords();
        }
    }

    function handleOfflineStatus() {
        appState.isOffline = true;
        updateConnectionUI();
        showInstantFeedback("Sin Conexión a Internet", "El dispositivo ha perdido conexión. Los escaneos se guardarán localmente de forma segura y se subirán al recuperar la red.", false);
        playErrorSound();
    }

    function updateConnectionUI() {
        if (appState.isOffline) {
            elements.connectionStatus.innerHTML = `
                <span class="status-indicator offline"></span>
                <span class="status-text">Sin conexión</span>
            `;
            elements.connectionStatus.title = "Las lecturas se almacenarán de forma local en el navegador temporalmente";
        } else {
            elements.connectionStatus.innerHTML = `
                <span class="status-indicator online"></span>
                <span class="status-text">En línea</span>
            `;
            elements.connectionStatus.title = "Conexión activa a internet";
        }
    }

    // Ejecutar inicialización
    init();
});
