let pausedSpeed = null;
let currentSetSpeed = 1.0;
let startTime = null;
let elapsedTimeInterval = null;
let distance = 0;
let pausedTime = 0; // Tempo trascorso in pausa

// ==================== INTERRUTTORE COLLEGA/DISCONNETTI ====================
document.getElementById('connectSwitch').addEventListener('change', async () => {
    if (document.getElementById('connectSwitch').checked) {
        connectDevice();
    } else {
        disconnectDevice();
    }
});

function updateConnectionStatus() {
    const connectionStatus = document.getElementById('connectionStatus');
    if (isConnected) {
        connectionStatus.textContent = "Connesso";
        connectionStatus.classList.add('connected');
    } else {
        connectionStatus.textContent = "Disconnesso";
        connectionStatus.classList.remove('connected');
    }
}

// ==================== PULSANTI + E - ====================
document.getElementById('increaseSpeed').addEventListener('click', () => {
    if (!isConnected) {
        alert("Collegati prima al dispositivo!");
        return;
    }
    currentSetSpeed = parseFloat(document.getElementById('speedInput').value) + 0.1;
    document.getElementById('speedInput').value = currentSetSpeed.toFixed(1);
    setSpeed(currentSetSpeed);
});

document.getElementById('decreaseSpeed').addEventListener('click', () => {
    if (!isConnected) {
        alert("Collegati prima al dispositivo!");
        return;
    }
    currentSetSpeed = Math.max(0, parseFloat(document.getElementById('speedInput').value) - 0.1);
    document.getElementById('speedInput').value = currentSetSpeed.toFixed(1);
    setSpeed(currentSetSpeed);
});

// ==================== PULSANTI START E STOP ====================
document.getElementById('start').addEventListener('click', () => {
    if (!isConnected) {
        alert("Collegati prima al dispositivo!");
        return;
    }
    sendStartCommand();
    startElapsedTime();
});

document.getElementById('stop').addEventListener('click', () => {
    if (!isConnected) {
        alert("Collegati prima al dispositivo!");
        return;
    }
    sendStopCommand();
    stopElapsedTime();
    distance = 0;
    document.getElementById('distance').textContent = distance.toFixed(2);
});

// ==================== PULSANTE PAUSA/RIPRENDI ====================
document.getElementById('pause').addEventListener('click', () => {
    if (!isConnected) {
        alert("Collegati prima al dispositivo!");
        return;
    }
    if (pausedSpeed === null) {
        // Pausa
        pausedSpeed = currentSetSpeed;
        setSpeed(0);
        document.getElementById('pause').textContent = "RIPRENDI";
        clearInterval(elapsedTimeInterval);
        pausedTime = Date.now() - startTime; // Registra il tempo in pausa
    } else {
        // Riprendi
        setSpeed(pausedSpeed);
        currentSetSpeed = pausedSpeed;
        document.getElementById('speedInput').value = pausedSpeed.toFixed(1);
        pausedSpeed = null;
        document.getElementById('pause').textContent = "PAUSA";
        startElapsedTime();
    }
});

// ==================== PALLINI VELOCITÀ ====================
const speedDots = document.querySelectorAll('.speed-dots .dot');
speedDots.forEach(dot => {
    dot.addEventListener('click', () => {
        if (!isConnected) {
            alert("Collegati prima al dispositivo!");
            return;
        }
        const speed = parseInt(dot.dataset.speed);
        currentSetSpeed = speed;
        document.getElementById('speedInput').value = speed.toFixed(1);
        setSpeed(speed);
    });
});

function startElapsedTime() {
    startTime = Date.now() - pausedTime; // Tieni conto del tempo in pausa
    elapsedTimeInterval = setInterval(updateElapsedTime, 1000);
}

function stopElapsedTime() {
    clearInterval(elapsedTimeInterval);
    startTime = null;
    pausedTime = 0; // Resetta il tempo in pausa
}

function updateElapsedTime() {
    if (!startTime) return;
    const elapsedMilliseconds = Date.now() - startTime;
    const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
    const hours = Math.floor((elapsedSeconds / 3600));
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const formattedTime = `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
    document.getElementById('elapsedTime').textContent = formattedTime;

    // Calcola la distanza percorsa in km
    distance += (currentSpeedValue / 3600);
    document.getElementById('distance').textContent = distance.toFixed(2);
}

function padZero(num) {
    return num < 10 ? `0${num}` : num;
}

function updateUIBasedOnTrainingStatus(status) {
    if (status === "Idle") {
        document.getElementById('start').disabled = false;
        document.getElementById('stop').disabled = true;
    } else if (status === "Manual Mode (Quick Start)") {
        document.getElementById('start').disabled = true;
        document.getElementById('stop').disabled = false;
    } else if (status === "Pre-Workout") {
        document.getElementById('start').disabled = true;
        document.getElementById('stop').disabled = true;
    }
}

function disconnectDevice() {
    if (device && device.gatt.connected) {
        device.gatt.disconnect();
    }
    isConnected = false;
    updateConnectionStatus();
    stopElapsedTime();
    distance = 0;
    document.getElementById('distance').textContent = distance.toFixed(2);
}

updateConnectionStatus();