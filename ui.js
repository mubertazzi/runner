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
let allenamentoInterval = null; //intervallo usato in avviaAllenamento

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

    stopAll(); // Ferma tutto e invia il comando 0x08
});

function stopAll() {
    sendStopCommand(); // Invia il comando di stop (0x08)
    stopElapsedTime(); // Ferma il timer

    // Resetta le variabili globali
    distance = 0; // Azzera i km percorsi
    tempoRimanente = 0; // Resetta il conto alla rovescia
    startTime = null; // Resetta il timer
    pausedTime = 0; // Resetta il tempo in pausa
    currentSetSpeed = 0;

    // Imposta la textbox della velocità a 0
    document.getElementById('speedInput').value = "0.0";

    if (isAutoMode) {
        // Gestisci la modalità automatica
        clearInterval(allenamentoInterval);
        clearInterval(elapsedTimeInterval);
        clearInterval(contoAllaRovesciaInterval);
        pianoPiatto = []; // Resetta il piano di allenamento
        document.getElementById('plan-info').innerHTML = ''; // Pulisci l'interfaccia
        document.getElementById('plan-info').style.display = 'none'; // Nascondi la sezione
        document.getElementById('auto').style.display = 'inline-block'; // Ripristina il pulsante AUTO
        document.getElementById('pause').style.display = 'inline-block'; // Mostra nuovamente il pulsante "Pausa"
        isAutoMode = false; // Disabilita la modalità automatica
    }
}

// ==================== PULSANTE PAUSA/RIPRENDI ====================
document.getElementById('pause').addEventListener('click', () => {
    if (!isConnected) {
        alert("Collegati prima al dispositivo!");
        return;
    }

    const pauseButton = document.getElementById('pause');

    if (pausedSpeed === null) {
        // Pausa
        pausedSpeed = currentSetSpeed;
        setSpeed(0);
        clearInterval(elapsedTimeInterval);
        pausedTime = Date.now() - startTime;

        // Aggiungi la classe per il lampeggiamento
        pauseButton.classList.add('pausa-lampeggiante');
    } else {
        // Riprendi
        setSpeed(pausedSpeed);
        currentSetSpeed = pausedSpeed;
        document.getElementById('speedInput').value = pausedSpeed.toFixed(1);
        pausedSpeed = null;
        startElapsedTime();

        // Rimuovi la classe per il lampeggiamento
        pauseButton.classList.remove('pausa-lampeggiante');
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
    // elapsedTimeInterval = setInterval(updateElapsedTime, 1000); // Disabilitato
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
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const formattedTime = `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
    document.getElementById('elapsedTime').textContent = formattedTime;

    // Calcola la distanza totale
    let totalDistance = 0;

    if (isAutoMode && pianoPiatto.length > 0 && faseCorrente < pianoPiatto.length) {
        // Modalità automatica
        // 1. Distanza delle fasi precedenti (anche per faseCorrente = 0, sarà 0)
        for (let i = 0; i < faseCorrente; i++) {
            const fase = pianoPiatto[i];
            totalDistance += (fase.velocita * fase.tempo) / 60; // km = velocità (km/h) * tempo (min) / 60
        }

        // 2. Distanza della fase corrente
        const currentFase = pianoPiatto[faseCorrente];
        const faseTotalSeconds = currentFase.tempo * 60; // Tempo totale della fase in secondi
        const elapsedFaseSeconds = Math.min(elapsedSeconds, faseTotalSeconds); // Usa elapsedSeconds per la prima fase, limitato al totale
        const elapsedFaseHours = elapsedFaseSeconds / 3600; // Converti in ore
        totalDistance += currentFase.velocita * elapsedFaseHours;
    } else {
        // Modalità manuale
        totalDistance = (currentSpeedValue * elapsedMilliseconds) / 3600000;
    }

    document.getElementById('distance').textContent = totalDistance.toFixed(3);
}

function padZero(num) {
    return num < 10 ? `0${num}` : num;
}

// ==================== GESTIONE DELLA MODALITÀ AUTO ====================
const autoButton = document.getElementById('auto');
autoButton.addEventListener('click', function autoClickHandler() {
//    if (!isConnected) {
//        alert("Collegati prima al dispositivo!");
//        return;
//    }	
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            caricaPianoAllenamento(file); // Carica il piano di allenamento

            // Nascondi il pulsante "Pausa"
            document.getElementById('pause').style.display = 'none';
        }
    };
    input.click();
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
            document.getElementById('distance').textContent = distance.toFixed(3); // Aggiorna l'interfaccia
            document.getElementById('elapsedTime').textContent = "00:00:00"; // Resetta il timer

            // Trasforma il JSON in array piatto
            trasformaInArrayPiatto(piano);
            console.log("Piano di allenamento caricato:", pianoPiatto);

            // Visualizza il piano con il nome
            const nomePianoAllenamento = piano.nome || "Piano di allenamento";
            visualizzaPiano(pianoPiatto, nomePianoAllenamento);

            // Imposta la modalità automatica
            isAutoMode = true;
            autoButton.style.display = 'none'; // Nascondi il pulsante AUTO
            document.getElementById('plan-info').style.display = 'block'; // Mostra la sezione
            const closeButton = document.querySelector('.close-button');
            if (closeButton) {
                closeButton.style.display = 'block'; // Mostra la X quando il piano è visibile
            }

            // Evidenzia automaticamente la prima fase
            evidenziaBarraAttiva(0); // Evidenzia la prima fase (indice 0)
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

    // Prima riga: Titolo e parametri
    const titleRow = document.createElement('div');
    titleRow.classList.add('plan-row');
    titleRow.innerHTML = `
        <span class="plan-title">ALLENAMENTO: ${nomePianoAllenamento}</span>
        <span class="plan-params">Tempo: <span id="tempo-totale">0 min</span> - Distanza: <span id="distanza-totale">0.00 km</span></span>
    `;
    planInfoDiv.appendChild(titleRow);

    // Calcola durata e distanza totale
    let durataTotale = 0;
    let distanzaTotale = 0;

    pianoPiatto.forEach(fase => {
        durataTotale += fase.tempo;
        distanzaTotale += fase.velocita * (fase.tempo / 60);
    });

    // Aggiorna i valori dei parametri
    document.getElementById('tempo-totale').textContent = `${durataTotale} min`;
    document.getElementById('distanza-totale').textContent = `${distanzaTotale.toFixed(2)} km`;

    // Seconda riga: Nome della fase e conto alla rovescia
    const faseAttualeDiv = document.createElement('div');
    faseAttualeDiv.classList.add('fase-attuale');
    faseAttualeDiv.innerHTML = `
        <span class="nome-fase">FASE 1: ${pianoPiatto[0].descrizione}</span>
        <span class="conto-alla-rovescia">${formattaTempo(pianoPiatto[0].tempo * 60)}</span>
    `;
    planInfoDiv.appendChild(faseAttualeDiv);

    // Inizializza tempoRimanente con il tempo totale della prima fase
    tempoRimanente = pianoPiatto[0].tempo * 60; // Imposta il tempo iniziale in secondi

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

    // Aggiunge la X come elemento figlio di plan-info, posizionata fuori a destra
    const closeButton = document.createElement('button');
    closeButton.classList.add('close-button');
    closeButton.textContent = '×';
	closeButton.addEventListener('click', () => {
		stopAll(); // Ferma tutto e resetta lo stato

		// Mostra nuovamente il pulsante "Pausa"
		document.getElementById('pause').style.display = 'inline-block';
	});
    planInfoDiv.appendChild(closeButton);
}

// Funzione per creare una barra dell'istogramma
function creaBarra(tempo, velocita, currentTime, durataTotale, index) {
    const bar = document.createElement('div');
    bar.classList.add('bar');
    bar.style.width = `${(tempo / durataTotale) * 100}%`;
    bar.style.height = `${velocita * 10}px`;
    bar.style.left = `${(currentTime / durataTotale) * 100}%`;
    bar.style.backgroundColor = `hsl(200, 100%, ${85 - velocita * 5}%)`; // Scuriamo il colore
    // Nota: Ho cambiato 100 a 85 per scurire ulteriormente il colore

    // Aggiungi un identificatore univoco per la barra
    bar.dataset.index = index;

    // Aggiungi un event listener per il clic sulla barra
    bar.addEventListener('click', () => {
        if (isAutoMode && pianoPiatto.length > 0) {
            // Cambia alla fase corrispondente
            faseCorrente = index; // Imposta l'indice della fase corrente
            caricaFaseCorrente(); // Carica la fase selezionata
        }
    });

    // Aggiunge etichette
    const timeLabel = document.createElement('div');
    timeLabel.classList.add('time-label');
    timeLabel.textContent = `${tempo}`; // Solo il valore, senza unità di misura
    bar.appendChild(timeLabel);

    const speedLabel = document.createElement('div');
    speedLabel.classList.add('speed-label');
    speedLabel.textContent = `${velocita}`; // Solo il valore, senza unità di misura
    bar.appendChild(speedLabel);

    return bar;
}

// Funzione per evidenziare la barra della fase attiva
function evidenziaBarraAttiva(indiceFase) {
    const bars = document.querySelectorAll('.plan-histogram .bar');
    bars.forEach((bar, index) => {
        const timeLabel = bar.querySelector('.time-label');
        const speedLabel = bar.querySelector('.speed-label');

        if (index === indiceFase) {
            // Evidenzia la barra attiva
            bar.classList.remove('completata'); // Rimuovi la classe completata
            bar.classList.add('active');
            bar.style.borderBottom = '3px solid #ff9800';
            bar.style.boxShadow = '0 0 10px rgba(255, 152, 0, 0.7)';
            bar.style.zIndex = '1';

            // Aggiungi le unità di misura
            if (timeLabel && speedLabel) {
                timeLabel.textContent = `${pianoPiatto[indiceFase].tempo} min`; // Aggiungi "min"
                speedLabel.textContent = `${pianoPiatto[indiceFase].velocita} Km/h`; // Aggiungi "Km/h"
            }
        } else if (index < indiceFase) {
            // Fase completata
            bar.classList.remove('active');
            bar.classList.add('completata');
            bar.style.borderBottom = 'none';
            bar.style.boxShadow = 'none';
            bar.style.zIndex = '0';

            // Rimuovi la classe .progress per ripristinare il colore originale
            const progressBar = bar.querySelector('.progress');
            if (progressBar) {
                progressBar.remove(); // Rimuovi la barra di progresso
            }

            // Rimuovi le unità di misura
            if (timeLabel && speedLabel) {
                timeLabel.textContent = `${pianoPiatto[index].tempo}`;
                speedLabel.textContent = `${pianoPiatto[index].velocita}`;
            }
        } else {
            // Fase futura
            bar.classList.remove('active', 'completata');
            bar.style.borderBottom = 'none';
            bar.style.boxShadow = 'none';
            bar.style.zIndex = '0';

            // Rimuovi le unità di misura
            if (timeLabel && speedLabel) {
                timeLabel.textContent = `${pianoPiatto[index].tempo}`;
                speedLabel.textContent = `${pianoPiatto[index].velocita}`;
            }
        }
    });
}

// Funzione per avviare l'allenamento automatico
function avviaAllenamento() {
    if (pianoPiatto.length === 0 || faseCorrente >= pianoPiatto.length) {
        console.log("Nessun piano caricato o allenamento già completato.");
        return;
    }

    if (faseCorrente === 0) {
        // Invia il comando 0x07 SOLO per la prima fase
        sendStartCommand();

        // Imposta startTime prima del ritardo per iniziare a contare subito
        startTime = Date.now(); // Inizializza startTime subito
        pausedTime = 0; // Resetta pausedTime

        // Imposta la velocità e avvia il timer dopo 5 secondi
        setTimeout(() => {
			// Carica la fase corrente
			caricaFaseCorrente();			
            setSpeed(currentSetSpeed);
            startElapsedTime(); // Avvia il timer (già sincronizzato con startTime)
            // Avvia l'aggiornamento della fase
            avviaAggiornamentoFase(pianoPiatto[faseCorrente]);
        }, 5000); // Ritardo di 5 secondi
    } else {
		// Carica la fase corrente
		caricaFaseCorrente();		
        // Per le fasi successive, imposta direttamente la velocità e avvia il timer
        setSpeed(currentSetSpeed);
        startElapsedTime(); // Avvia il timer
        // Avvia l'aggiornamento della fase
        avviaAggiornamentoFase(pianoPiatto[faseCorrente]);
    }
}

// Funzione ausiliaria per avviare l'aggiornamento della fase
function avviaAggiornamentoFase(fase) {
    let tempoTrascorso = 0;

    // Cancella eventuali intervalli precedenti
    clearInterval(allenamentoInterval);

    // Avvia un nuovo intervallo per la fase corrente
    allenamentoInterval = setInterval(() => {
        tempoTrascorso++;
        if (tempoTrascorso >= fase.tempo * 60) {
            clearInterval(allenamentoInterval);
            faseCorrente++;
            if (faseCorrente < pianoPiatto.length) {
                caricaFaseCorrente(); // Passa alla fase successiva
            } else {
                // Allenamento completato
                console.log("Allenamento completato!");
                setSpeed(0);
                mostraMessaggioCompletamento();
                stopAll();
            }
        }
    }, 1000);
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

    // Usa la sezione della fase attuale esistente
    let faseAttualeDiv = planInfoDiv.querySelector('.fase-attuale');
    if (!faseAttualeDiv) {
        faseAttualeDiv = document.createElement('div');
        faseAttualeDiv.classList.add('fase-attuale');
        planInfoDiv.appendChild(faseAttualeDiv);
    }

    // Aggiorna il nome della fase con il numero progressivo
    const numeroFase = faseCorrente + 1;
    faseAttualeDiv.innerHTML = `
        FASE ${numeroFase}: ${nomeFase} <span class="conto-alla-rovescia">${formattaTempo(tempoIniziale)}</span>
    `;

    // Inizializza variabili per il conto alla rovescia e il progresso
    let tempoRimanente = tempoIniziale; // Tempo in secondi
    let tempoTrascorso = 0;

    // Avvia l'intervallo per aggiornare il conto alla rovescia e il progresso
    clearInterval(contoAllaRovesciaInterval); // Resetta eventuali intervalli precedenti
    contoAllaRovesciaInterval = setInterval(() => {
        tempoRimanente--;
        tempoTrascorso++;

        if (tempoRimanente >= 0) {
            // Aggiorna il conto alla rovescia
            faseAttualeDiv.querySelector('.conto-alla-rovescia').textContent = formattaTempo(tempoRimanente);

            // Emetti un bip di 1 secondo quando mancano 5 secondi
            if ((tempoRimanente === 10 || tempoRimanente === 5)) {
                emettiBip(); // Emette un bip di 1 secondo
            }

            // Aggiorna il progresso della barra
            aggiornaProgressoFase(tempoTrascorso, tempoIniziale);

            // Attiva il lampeggio negli ultimi 5 secondi
            if (tempoRimanente <= 5) {
                faseAttualeDiv.querySelector('.conto-alla-rovescia').classList.add('lampeggia');
            } else {
                faseAttualeDiv.querySelector('.conto-alla-rovescia').classList.remove('lampeggia');
            }
        } else {
            clearInterval(contoAllaRovesciaInterval); // Ferma il conto alla rovescia
            faseAttualeDiv.querySelector('.conto-alla-rovescia').classList.remove('lampeggia');
        }
    }, 1000);
}

// Funzione per emettere un bip
function emettiBip() {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = 'sine'; // Tipo di suono (onda sinusoidale)
    oscillator.frequency.setValueAtTime(800, context.currentTime); // Frequenza del bip (800 Hz)
    gainNode.gain.setValueAtTime(2, context.currentTime); // Volume

    // Collega i nodi
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    // Durata del bip: 1 secondo
    oscillator.start();
    oscillator.stop(context.currentTime + 1); // Ferma dopo 1 secondo
}

// Funzione per formattare il tempo in mm:ss
function formattaTempo(secondi) {
    const minuti = Math.floor(secondi / 60);
    const sec = secondi % 60;
    return `${padZero(minuti)}:${padZero(sec)}`;
}

let kmTotaliPrecedenti = 0; // Variabile per memorizzare i km delle fasi precedenti

function aggiornaKmTotali(velocitaFaseAttuale, tempoTrascorsoFaseAttuale) {
    // Calcola i km percorsi nella fase attuale
    const kmFaseAttuale = (velocitaFaseAttuale * tempoTrascorsoFaseAttuale) / 3600; // km = velocità (km/h) * tempo (s) / 3600

    // Somma i km delle fasi precedenti e quelli della fase attuale
    const kmTotali = kmTotaliPrecedenti + kmFaseAttuale;

    // Aggiorna l'interfaccia utente con i km totali
    document.getElementById('distance').textContent = kmTotali.toFixed(3);

    return kmTotali;
}

function aggiornaProgressoFase(tempoTrascorso, durataFase) {
    const progressoPercentuale = (tempoTrascorso / durataFase) * 100;

    // Seleziona la barra attiva
    const barraAttiva = document.querySelector('.plan-histogram .bar.active');
    if (!barraAttiva) return;

    // Crea o aggiorna la barra di progresso all'interno della barra attiva
    let progressBar = barraAttiva.querySelector('.progress');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.classList.add('progress');
        barraAttiva.appendChild(progressBar);
    }

    // Imposta la larghezza della barra di progresso
    progressBar.style.width = `${progressoPercentuale}%`;
}

document.addEventListener('keydown', (event) => {
    if (isAutoMode && pianoPiatto.length > 0) { // Solo in modalità automatica
        if (event.key === 'ArrowLeft') {
            // Torna alla fase precedente
            if (faseCorrente > 0) {
                faseCorrente--;
                caricaFaseCorrente(); // Carica la fase precedente
            }
        } else if (event.key === 'ArrowRight') {
            // Passa alla fase successiva
            if (faseCorrente < pianoPiatto.length - 1) {
                faseCorrente++;
                caricaFaseCorrente(); // Carica la fase successiva
            }
        }
    }
});

function caricaFaseCorrente() {
    const fase = pianoPiatto[faseCorrente];

    // Aggiorna il nome della fase
    const faseAttualeDiv = document.querySelector('.fase-attuale');
    faseAttualeDiv.innerHTML = `
        FASE ${faseCorrente + 1}: ${fase.descrizione} <span class="conto-alla-rovescia">${formattaTempo(fase.tempo * 60)}</span>
    `;

    // Aggiorna il conto alla rovescia
    tempoRimanente = fase.tempo * 60;
    aggiornaFaseAttuale(fase.descrizione, tempoRimanente);

    // Aggiorna la barra di progresso
    evidenziaBarraAttiva(faseCorrente);

    // Aggiorna la velocità
    currentSetSpeed = fase.velocita;
    document.getElementById('speedInput').value = currentSetSpeed.toFixed(1);
    setSpeed(currentSetSpeed);

    // Aggiungi le unità di misura alle etichette della fase attiva
    const barraAttiva = document.querySelector('.plan-histogram .bar.active');
    if (barraAttiva) {
        const timeLabel = barraAttiva.querySelector('.time-label');
        const speedLabel = barraAttiva.querySelector('.speed-label');
        if (timeLabel && speedLabel) {
            timeLabel.textContent = `${fase.tempo} min`; // Aggiungi "min"
            speedLabel.textContent = `${fase.velocita} kmh`; // Aggiungi "kmh"
        }
    }

    // Riavvia l'intervallo di aggiornamento della fase
    clearInterval(allenamentoInterval); // Cancella l'intervallo precedente
    avviaAggiornamentoFase(fase); // Riavvia l'intervallo per la nuova fase
}
