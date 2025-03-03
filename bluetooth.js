let device;
let writeCharacteristic;
let readCharacteristic;
let isConnected = false;
let currentSpeedValue = 0; // Aggiunta per tenere traccia della velocità corrente

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

                // Leggi la velocità (Byte 2 e Byte 3)
                const speed = value.getUint16(2, true) / 100;

                // Aggiorna la velocità corrente
                currentSpeedValue = speed;

                // Aggiorna l'interfaccia utente
                document.getElementById('currentSpeed').textContent = speed.toFixed(1) + " km/h";
                document.getElementById('speedInput').value = currentSetSpeed.toFixed(1);

                // Stampa i byte per debug
                console.log("Valore grezzo (Treadmill Data):", value);
                for (let i = 0; i < value.byteLength; i++) {
                    console.log(`Byte ${i}:`, value.getUint8(i));
                }
            });
        })
        .catch(error => {
            console.error("Errore abilitazione notifiche Treadmill Data:", error);
        });

    // Abilita notifiche per Training Status
    device.gatt.getPrimaryService(serviceUuid)
        .then(service => service.getCharacteristic("00002ad3-0000-1000-8000-00805f9b34fb"))
        .then(trainingStatusCharacteristic => {
            trainingStatusCharacteristic.startNotifications()
                .then(() => {
                    console.log("Notifiche Training Status abilitate, in ascolto...");

                    trainingStatusCharacteristic.addEventListener('characteristicvaluechanged', event => {
                        const value = event.target.value;
                        const status = new TextDecoder().decode(value); // Decodifica il valore come stringa

                        console.log("Training Status:", status);
                        updateUIBasedOnTrainingStatus(status); // Aggiorna l'UI
                    });
                })
                .catch(error => {
                    console.error("Errore abilitazione notifiche Training Status:", error);
                });
        });
}

function sendStartCommand() {
    sendCommand(0x07); // Invia il comando 0x07 per avviare l'allenamento
    console.log("Comando START (0x07) inviato");
}

function sendStopCommand() {
    setSpeed(0); // Imposta la velocità a 0
    setTimeout(() => {
        sendCommand(0x08); // Invia il comando 0x08 per arrestare l'allenamento        
    }, 500); // Piccolo ritardo per garantire che la velocità sia impostata a 0
    console.log("Comando STOP (0x08) inviato");
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

    if (isNaN(speed) || speed < 0 || speed > 20) {  // Modifica il range secondo le specifiche del tapis
        alert("Velocità non valida (0-20 km/h)");
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