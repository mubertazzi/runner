let pausedSpeed = null;
let currentSetSpeed = 1.0;
let startTime = null;
let elapsedTimeInterval = null;
let distance = 0;
let pausedTime = 0;
let isAutoMode = false;
let faseCorrente = 0; // Indice della fase corrente
let pianoPiatto = []; // Array piatto per memorizzare le fasi
let tempoRimanente = 0; // Tempo rimanente per la fase corrente (in secondi)
let contoAllaRovesciaInterval = null; // Intervallo per aggiornare il conto alla rovescia

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

    // Invia il comando 0x07 per predisporre il tapis
    sendStartCommand();

    if (isAutoMode && pianoPiatto.length > 0) {
        // Modalità automatica: avvia il piano di allenamento
        avviaAllenamento();
    } else {
        // Modalità manuale: imposta la velocità manuale dopo 5 secondi
        setTimeout(() => {
            setSpeed(currentSetSpeed);
            startElapsedTime(); // Avvia il timer
        }, 5000); // Ritardo di 5 secondi
    }
});

document.getElementById('stop').addEventListener('click', () => {
    if (!isConnected) {
        alert("Collegati prima al dispositivo!");
        return;
    }
    stopAll(); // Ferma tutto e invia il comando 0x08
    distance = 0;
    document.getElementById('distance').textContent = distance.toFixed(2);
});

function stopAll() {
    sendStopCommand(); // Invia il comando di stop (0x08)
    stopElapsedTime();
    distance = 0; // Azzera i km percorsi
    document.getElementById('distance').textContent = distance.toFixed(2); // Aggiorna l'interfaccia
    document.getElementById('elapsedTime').textContent = "00:00:00"; // Azzera il timer

    if (isAutoMode) {
        pianoPiatto = [];
        document.getElementById('plan-info').innerHTML = '';
        document.getElementById('plan-info').style.display = 'none';
        document.getElementById('auto').textContent = 'AUTO';
        isAutoMode = false;
    }
}

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
        pausedTime = Date.now() - startTime;
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

// ==================== GESTIONE DEL TEMPO ====================
function startElapsedTime() {
    if (!startTime) {
        startTime = Date.now() - pausedTime; // Inizializza startTime solo se non è già stato impostato
    }
    elapsedTimeInterval = setInterval(updateElapsedTime, 1000);
}

function stopElapsedTime() {
    clearInterval(elapsedTimeInterval);
    startTime = null;
    pausedTime = 0;
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
    const kmPercorsi = (currentSpeedValue * elapsedMilliseconds) / 3600000; // Velocità (km/h) * tempo (ore)
    document.getElementById('distance').textContent = kmPercorsi.toFixed(3); // Mostra 3 decimali
}

function padZero(num) {
    return num < 10 ? `0${num}` : num;
}

// ==================== GESTIONE DELLA MODALITÀ AUTO ====================
const autoButton = document.getElementById('auto');
autoButton.addEventListener('click', function autoClickHandler() {
    if (autoButton.textContent === 'AUTO') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                caricaPianoAllenamento(file); // Carica il piano di allenamento
            }
        };
        input.click();
    } else if (autoButton.textContent === 'ANNULLA') {
        // Annulla il piano
        pianoPiatto = [];
        document.getElementById('plan-info').innerHTML = '';
        document.getElementById('plan-info').style.display = 'none';
        autoButton.textContent = 'AUTO';
        isAutoMode = false;
    }
});

// Funzione per caricare il piano di allenamento e trasformarlo in array piatto
function caricaPianoAllenamento(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const piano = JSON.parse(e.target.result);

            // Resetta lo stato del piano precedente
            pianoPiatto = []; // Resetta l'array piatto
            faseCorrente = 0; // Resetta l'indice della fase corrente
            distance = 0; // Resetta la distanza percorsa
            document.getElementById('distance').textContent = distance.toFixed(2); // Aggiorna l'interfaccia
            document.getElementById('elapsedTime').textContent = "00:00:00"; // Resetta il timer

            // Trasforma il JSON in array piatto
            trasformaInArrayPiatto(piano);
            console.log("Piano di allenamento caricato:", pianoPiatto);

            // Visualizza il piano con il nome
            const nomePianoAllenamento = piano.nome || "Piano di allenamento";
            visualizzaPiano(pianoPiatto, nomePianoAllenamento);

            // Imposta la modalità automatica
            isAutoMode = true;
            autoButton.textContent = 'ANNULLA';
            document.getElementById('plan-info').style.display = 'block'; // Mostra la sezione
        } catch (error) {
            console.error("Errore durante il caricamento del JSON:", error);
        }
    };
    reader.readAsText(file); // Legge il file come testo
}

// Funzione per trasformare il JSON in array piatto
function trasformaInArrayPiatto(piano) {
    pianoPiatto = []; // Resetta l'array piatto
    piano.allenamento.forEach(fase => {
        if (fase.tempo) {
            // Aggiunge una fase singola
            pianoPiatto.push({
                tempo: fase.tempo,
                velocita: fase.velocita,
                descrizione: fase.descrizione
            });
        } else if (fase.ripetizioni && fase.serie) {
            // Aggiunge le serie ripetute
            for (let i = 0; i < fase.ripetizioni; i++) {
                fase.serie.forEach(serie => {
                    pianoPiatto.push({
                        tempo: serie.tempo,
                        velocita: serie.velocita,
                        descrizione: serie.descrizione
                    });
                });
            }
        }
    });
}

// Funzione per visualizzare il piano di allenamento
function visualizzaPiano(pianoPiatto, nomePianoAllenamento) {
    const planInfoDiv = document.getElementById('plan-info');
    planInfoDiv.innerHTML = ''; // Pulisce il contenuto precedente

    // Crea un contenitore per il titolo e i parametri
    const headerContainer = document.createElement('div');
    headerContainer.classList.add('header-container'); // Aggiungi la classe
    headerContainer.style.display = 'flex';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.marginBottom = '0.5rem'; // Aggiunge spazio sotto il titolo e i parametri

    // Aggiunge il nome del piano (se presente)
    const nomePiano = document.createElement('h3');
    nomePiano.textContent = nomePianoAllenamento || "Piano di allenamento"; // Usa il nome del piano o un valore predefinito
    nomePiano.style.color = 'orange';
    nomePiano.style.margin = '0'; // Rimuove il margine predefinito
    nomePiano.style.marginRight = '1rem'; // Aggiunge spazio tra il titolo e i parametri
    headerContainer.appendChild(nomePiano);

    // Calcola durata e distanza totale
    let durataTotale = 0;
    let distanzaTotale = 0;

    pianoPiatto.forEach(fase => {
        durataTotale += fase.tempo;
        distanzaTotale += fase.velocita * (fase.tempo / 60);
    });

    // Aggiunge durata e distanza totale
    const infoContainer = document.createElement('div');
    infoContainer.innerHTML = `
        <span>Durata: ${durataTotale} minuti - Distanza: ${distanzaTotale.toFixed(2)} km</span>
    `;
    infoContainer.style.color = 'darkblue';
    infoContainer.style.fontSize = '1em'; // Riduci il font dei parametri
    headerContainer.appendChild(infoContainer);

    // Aggiunge il contenitore del titolo e dei parametri alla sezione
    planInfoDiv.appendChild(headerContainer);

    // Aggiunge il nome della fase e il conto alla rovescia subito sotto il titolo
    const faseAttualeDiv = document.createElement('div');
    faseAttualeDiv.classList.add('fase-attuale');
    faseAttualeDiv.innerHTML = `
        <span class="nome-fase"></span>
        <span class="conto-alla-rovescia"></span>
    `;
    planInfoDiv.appendChild(faseAttualeDiv);

    // Aggiunge l'istogramma
    const histogramDiv = document.createElement('div');
    histogramDiv.classList.add('plan-histogram');
    let currentTime = 0;

    pianoPiatto.forEach((fase, index) => {
        const bar = creaBarra(fase.tempo, fase.velocita, currentTime, durataTotale, index);
        histogramDiv.appendChild(bar);
        currentTime += fase.tempo;
    });

    planInfoDiv.appendChild(histogramDiv);
}

// Funzione per creare una barra dell'istogramma
function creaBarra(tempo, velocita, currentTime, durataTotale, index) {
    const bar = document.createElement('div');
    bar.classList.add('bar');
    bar.style.width = `${(tempo / durataTotale) * 100}%`;
    bar.style.height = `${velocita * 10}px`;
    bar.style.left = `${(currentTime / durataTotale) * 100}%`;
    bar.style.backgroundColor = `hsl(200, 100%, ${100 - velocita * 5}%)`;

    // Aggiunge etichette
    const timeLabel = document.createElement('div');
    timeLabel.classList.add('time-label');
    timeLabel.textContent = `${tempo}`;
    bar.appendChild(timeLabel);

    const speedLabel = document.createElement('div');
    speedLabel.classList.add('speed-label');
    speedLabel.textContent = `${velocita}`;
    bar.appendChild(speedLabel);

    // Aggiunge un identificatore univoco per la barra
    bar.dataset.index = index;

    return bar;
}

// Funzione per evidenziare la barra della fase attiva
function evidenziaBarraAttiva(indiceFase) {
    const bars = document.querySelectorAll('.plan-histogram .bar');
    bars.forEach((bar, index) => {
        if (index === indiceFase) {
            // Evidenzia la barra attiva con un colore di sfondo diverso
            bar.style.backgroundColor = '#ff9800'; // Colore arancione vivace
            bar.style.boxShadow = '0 0 10px rgba(255, 152, 0, 0.7)'; // Aggiungi un'ombra per un effetto più carino
            bar.style.zIndex = '1'; // Metti la barra attiva in primo piano
        } else {
            // Ripristina il colore di sfondo originale per le altre barre
            const velocita = parseFloat(bar.querySelector('.speed-label').textContent);
            bar.style.backgroundColor = `hsl(200, 100%, ${100 - velocita * 5}%)`; // Colore originale basato sulla velocità
            bar.style.boxShadow = 'none'; // Rimuovi l'ombra
            bar.style.zIndex = '0'; // Riporta le altre barre in secondo piano
        }
    });
}

// Funzione per avviare l'allenamento automatico
function avviaAllenamento() {
    // Se non c'è un piano caricato o è già stato completato, esci
    if (pianoPiatto.length === 0 || faseCorrente >= pianoPiatto.length) {
        console.log("Nessun piano caricato o allenamento già completato.");
        return;
    }

    const fase = pianoPiatto[faseCorrente];
    console.log(`Avvio fase ${faseCorrente + 1}: ${fase.descrizione} (${fase.tempo} minuti a ${fase.velocita} km/h)`);

    // Evidenzia la barra della fase attiva
    evidenziaBarraAttiva(faseCorrente);

    // Se è la prima fase, invia il comando di avvio (0x07) e attendi 5 secondi
    if (faseCorrente === 0) {
        sendStartCommand();
        setTimeout(() => {
            // Imposta la velocità del tapis roulant
            setSpeed(fase.velocita);

            // Avvia il timer e l'aggiornamento dei km percorsi
            startElapsedTime();

            // Aggiorna la visualizzazione della fase attuale
            aggiornaFaseAttuale(fase.descrizione, fase.tempo * 60); // Converti minuti in secondi

            // Avvia l'aggiornamento della fase
            let tempoTrascorso = 0;
            const interval = setInterval(() => {
                tempoTrascorso++;
                if (tempoTrascorso >= fase.tempo * 60) {
                    clearInterval(interval);
                    faseCorrente++;
                    if (faseCorrente < pianoPiatto.length) {
                        avviaAllenamento(); // Passa alla fase successiva
                    } else {
                        // Allenamento completato
                        console.log("Allenamento completato!");
                        setSpeed(0);
                        mostraMessaggioCompletamento(); // Mostra il messaggio di completamento
                        stopAll();
                    }
                }
            }, 1000);
        }, 5000); // Ritardo di 5 secondi
    } else {
        // Se non è la prima fase, imposta direttamente la velocità e avvia il timer
        setSpeed(fase.velocita);

        // Avvia il timer e l'aggiornamento dei km percorsi
        startElapsedTime();

        // Aggiorna la visualizzazione della fase attuale
        aggiornaFaseAttuale(fase.descrizione, fase.tempo * 60); // Converti minuti in secondi

        // Avvia l'aggiornamento della fase
        let tempoTrascorso = 0;
        const interval = setInterval(() => {
            tempoTrascorso++;
            if (tempoTrascorso >= fase.tempo * 60) {
                clearInterval(interval);
                faseCorrente++;
                if (faseCorrente < pianoPiatto.length) {
                    avviaAllenamento(); // Passa alla fase successiva
                } else {
                    // Allenamento completato
                    console.log("Allenamento completato!");
                    setSpeed(0);
                    mostraMessaggioCompletamento(); // Mostra il messaggio di completamento
                    stopAll();
                }
            }
        }, 1000);
    }
}

// Funzione per mostrare il messaggio di completamento
function mostraMessaggioCompletamento() {
    const completionMessage = document.getElementById('completionMessage');
    completionMessage.style.display = 'block'; // Mostra il messaggio

    // Nascondi il messaggio dopo 5 secondi
    setTimeout(() => {
        completionMessage.style.display = 'none';
    }, 5000); // Durata del messaggio: 5 secondi
}

// Funzione per aggiornare la fase attuale e il conto alla rovescia
function aggiornaFaseAttuale(nomeFase, tempoIniziale) {
    const planInfoDiv = document.getElementById('plan-info');

    // Crea o aggiorna la sezione della fase attuale
    let faseAttualeDiv = planInfoDiv.querySelector('.fase-attuale');
    if (!faseAttualeDiv) {
        faseAttualeDiv = document.createElement('div');
        faseAttualeDiv.classList.add('fase-attuale');
        planInfoDiv.appendChild(faseAttualeDiv);
    }

    // Aggiorna il nome della fase
    faseAttualeDiv.innerHTML = `
        <span class="nome-fase">${nomeFase}</span>
        <span class="conto-alla-rovescia">${formattaTempo(tempoIniziale)}</span>
    `;

    // Avvia il conto alla rovescia
    tempoRimanente = tempoIniziale;
    clearInterval(contoAllaRovesciaInterval); // Resetta l'intervallo precedente
    contoAllaRovesciaInterval = setInterval(() => {
        tempoRimanente--;
        if (tempoRimanente >= 0) {
            faseAttualeDiv.querySelector('.conto-alla-rovescia').textContent = formattaTempo(tempoRimanente);
        } else {
            clearInterval(contoAllaRovesciaInterval); // Ferma il conto alla rovescia
        }
    }, 1000);
}

// Funzione per formattare il tempo in mm:ss
function formattaTempo(secondi) {
    const minuti = Math.floor(secondi / 60);
    const sec = secondi % 60;
    return `${padZero(minuti)}:${padZero(sec)}`;
}
