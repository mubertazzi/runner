let device;
let writeCharacteristic;
let readCharacteristic;
let isConnected = false;
let currentSpeedValue = 0; // Aggiunta per tenere traccia della velocità corrente
let tempoRimanente = 0; // Tempo rimanente per la fase corrente (in secondi)

// UUID del servizio e delle caratteristiche (convertiti in formato lungo)
const serviceUuid = "00001826-0000-1000-8000-00805f9b34fb";         // Fitness Machine Service
const writeCharacteristicUuid = "00002ad9-0000-1000-8000-00805f9b34fb"; // Control Point (Scrittura)
const readCharacteristicUuid = "00002acd-0000-1000-8000-00805f9b34fb";  // Treadmill Data (Lettura)

async function connectDevice() {
    try {
        // Richiedi dispositivo Bluetooth
        device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [serviceUuid] }],
            optionalServices: [serviceUuid] // Aggiungi se necessario
        });

        // Listener per disconnessione
        device.addEventListener('gattserverdisconnected', () => {
            alert("Disconnessione effettuata.");
            document.getElementById('connectSwitch').checked = false;
            isConnected = false;
            updateConnectionStatus();
        });

        // Connetti al GATT Server
        const server = await device.gatt.connect();

        // Ottieni il servizio
        const service = await server.getPrimaryService(serviceUuid);

        // Ottieni le caratteristiche
        writeCharacteristic = await service.getCharacteristic(writeCharacteristicUuid);
        readCharacteristic = await service.getCharacteristic(readCharacteristicUuid);

        // Feedback visivo
        console.log("Connesso con successo!");

        // Avvia la lettura automatica
        startAutomaticReading();

        isConnected = true;
        updateConnectionStatus();
    } catch (error) {
        alert("Errore: " + error.message);
        console.error(error);
        document.getElementById('connectSwitch').checked = false;
        updateConnectionStatus();
    }
}

function disconnectDevice() {
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
    }
    isConnected = false;
    updateConnectionStatus();
}

function startAutomaticReading() {
    if (!readCharacteristic) {
        console.error("Nessuna caratteristica di lettura disponibile");
        return;
    }

    // Abilita notifiche per Treadmill Data
    readCharacteristic.startNotifications()
        .then(() => {
            console.log("Notifiche Treadmill Data abilitate, in ascolto...");

            // Listener per aggiornamenti in tempo reale
            readCharacteristic.addEventListener('characteristicvaluechanged', event => {
                const value = event.target.value;
				// Per loggare tutti i byte del buffer
				const bufferArray = new Uint8Array(value.buffer);
				//console.log("Buffer completo:", Array.from(bufferArray).map(b => b.toString(16).padStart(2, '0')).join(' '));
                // Leggi la velocità (Byte 2 e Byte 3)
                const speed = value.getUint16(2, true) / 100; // Velocità in km/h

                // Leggi la distanza (Byte 4 e Byte 5)
                const distance = value.getUint16(4, true) / 1000; // Distanza in km (convertita da metri)

                // Leggi il tempo (Byte 12 e Byte 13)
                const elapsedTime = value.getUint16(12, true); // Tempo in secondi

                // Formatta il tempo in hh:mm:ss
                const hours = Math.floor(elapsedTime / 3600);
                const minutes = Math.floor((elapsedTime % 3600) / 60);
                const seconds = elapsedTime % 60;
                const formattedTime = `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
				
			   // Leggi le calorie (Byte 6 e Byte 7)
			   const calories = value.getUint16(6, true) / 256; // Calorie in kilocalorie

                // Calcolo diretto del tempo rimanente 
                if (isAutoMode && pianoAllenamento.length > 0) {
                    let tempoCumulativoPrecedente = 0;
                    for (let i = 0; i < faseCorrente; i++) {
                        tempoCumulativoPrecedente += pianoAllenamento[i].tempo * 60; // Somma le durate delle fasi precedenti (in secondi)
                    }
                    const tempoTrascorsoFaseAttuale = elapsedTime - tempoCumulativoPrecedente;	
                    tempoRimanente = Math.max(0, (pianoAllenamento[faseCorrente].tempo * 60) - tempoTrascorsoFaseAttuale);					
                    gestioneFasi();			
                }
                
                // Aggiorna l'interfaccia utente
                document.getElementById('currentSpeed').textContent = speed.toFixed(1) + " km/h";
                document.getElementById('distance').textContent = distance.toFixed(3) + " km";
                document.getElementById('elapsedTime').textContent = formattedTime;
				document.getElementById('calories').textContent = calories.toFixed(0) + " kcal";

                // Aggiorna le variabili globali
                startTime = Date.now() - elapsedTime * 1000; // Sincronizza startTime con il tempo ricevuto
                pausedTime = 0; // Resetta pausedTime
            });
        })
        .catch(error => {
            console.error("Errore abilitazione notifiche Treadmill Data:", error);
        });
}

function padZero(num) {
    return num < 10 ? `0${num}` : num;
}

function sendStartCommand() {
    sendCommand(0x07); // Invia il comando 0x07 per avviare l'allenamento
    console.log("Comando START (0x07) inviato");
}

function sendStopCommand() {
    sendCommand(0x08); // Invia il comando 0x08 per arrestare l'allenamento
    console.log("Comando STOP (0x08) inviato");
}

let isWriting = false;
async function sendCommand(opcode) {
    if (isWriting) return;
    isWriting = true;
    try {
        const buffer = new ArrayBuffer(1);
        new DataView(buffer).setUint8(0, opcode);
        await writeCharacteristic.writeValue(buffer);
    } finally {
        isWriting = false;
    }
}

function setSpeed(speed) {
    if (!writeCharacteristic) {
        alert("Collegati prima al dispositivo!");
        return;
    }

    // Modifica: imposta a 0 se la velocità è inferiore a 1
    if (speed < 1) {
        speed = 0;
    }

    if (isNaN(speed) || speed < 0 || speed > 10) {  // Modifica il range secondo le specifiche del tapis
        alert("Velocità non valida (0-10 km/h)");
        return;
    }

    try {
        // Converti la velocità in centesimi di km/h
        const speedInCentesimi = Math.round(speed * 100);

        // Crea il buffer dati (esempio: opcode 0x02 + velocità in 2 byte)
        const buffer = new ArrayBuffer(3); // 1 byte per l'opcode + 2 byte per la velocità
        const view = new DataView(buffer);
        view.setUint8(0, 0x02); // Opcode
        view.setUint16(1, speedInCentesimi, true); // Velocità in centesimi di km/h (little-endian)

        // Invia i dati
        writeCharacteristic.writeValue(buffer);
        console.log(`Velocità impostata a ${speed.toFixed(1)} km/h`);

        // Aggiorna la textbox della velocità
        document.getElementById('speedInput').value = speed.toFixed(1);
    } catch (error) {
        alert("Errore scrittura: " + error.message);
        console.error(error);
    }
}

function sendCommand(opcode) {
    if (!writeCharacteristic) {
        alert("Collegati prima al dispositivo!");
        return;
    }

    try {
        const buffer = new ArrayBuffer(1);
        const view = new DataView(buffer);
        view.setUint8(0, opcode);
        writeCharacteristic.writeValue(buffer);
        console.log(`Comando inviato: ${opcode}`);
    } catch (error) {
        alert("Errore invio comando: " + error.message);
        console.error(error);
    }
}

let wakeLock = null;

// Funzione per attivare il Wake Lock
async function attivaWakeLock() {
    try {
        // Richiedi il Wake Lock per mantenere lo schermo acceso
        wakeLock = await navigator.wakeLock.request('screen');
        console.log("Wake Lock attivato: lo schermo rimarrà acceso.");
    } catch (err) {
        console.error("Errore nell'attivazione del Wake Lock:", err);
    }
}

// Funzione per rilasciare il Wake Lock
function rilasciaWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release();
        wakeLock = null;
        console.log("Wake Lock rilasciato.");
    }
}

// Attiva il Wake Lock quando la pagina è visibile
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        attivaWakeLock();
    } else {
        rilasciaWakeLock();
    }
});

// Attiva il Wake Lock all'avvio
attivaWakeLock();
