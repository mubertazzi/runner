let pausedSpeed = null;
let currentSetSpeed = 1.0;
let startTime = null;
let distance = 0;
let pausedTime = 0;
let isAutoMode = false;
let faseCorrente = 0; // Indice della fase corrente
let pianoAllenamento = []; // Array piatto per memorizzare le fasi
let tempoTrascorso = 0;

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
    if (isAutoMode && pianoAllenamento.length > 0) {
        // Modalità automatica: avvia il piano di allenamento
        avviaAllenamento();
    } else {
        // Modalità manuale: imposta la velocità manuale dopo 5 secondi
        setTimeout(() => {
            currentSetSpeed = Math.max(0, parseFloat(document.getElementById('speedInput').value));
            setSpeed(currentSetSpeed);
        }, 5000); // Ritardo di 5 secondi
    }
});

// Listener per il pulsante "Stop"
document.getElementById('stop').addEventListener('click', () => {
    // Chiama la funzione stopAll() per fermare tutto
    stopAll();

    // Ripristina il pulsante "Select Plan" alla sua icona predefinita
	ripristinaPulsantePiano();
	inizializzaPlanSection();
});

function stopAll() {
	stopMusic(); // Ferma la musica
    sendStopCommand(); // Invia il comando di stop (0x08)	
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
        pianoAllenamento = []; // Resetta il piano di allenamento
        //document.getElementById('plan-section').innerHTML = ''; // Pulisci l'interfaccia
        //document.getElementById('plan-section').style.display = 'none'; // Nascondi la sezione
        document.getElementById('selectPlan').style.display = 'inline-block'; // Ripristina il pulsante SELECT PLAN
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
        pausedTime = Date.now() - startTime;
        // Aggiungi la classe per il lampeggiamento
        pauseButton.classList.add('pausa-lampeggiante');
    } else {
        // Riprendi
        setSpeed(pausedSpeed);
        currentSetSpeed = pausedSpeed;
        document.getElementById('speedInput').value = pausedSpeed.toFixed(1);
        pausedSpeed = null;
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

function padZero(num) {
    return num < 10 ? `0${num}` : num;
}

// ==================== GESTIONE DELLA MODALITÀ AUTO ====================
const selectPlanButton = document.getElementById('selectPlan');

// Simulazione dei file JSON disponibili nella cartella "Piani"
const mockJsonFiles = [
    { file: "1-lun.json", nome: "Lunedì" },
    { file: "2-mar.json", nome: "Martedì" },
    { file: "3-mer.json", nome: "Mercoledì" },
    { file: "4-gio.json", nome: "Giovedì" },
    { file: "5-ven.json", nome: "Venerdì" },
    { file: "6-sab.json", nome: "Sabato" },
    { file: "7-dom.json", nome: "Domenica" }
];

// Pulsante edit piano
document.getElementById('editPlan').addEventListener('click', function() {
    showEditor(); // Funzione dal file creaPiano.js
    document.getElementById('planSelectionPopup').style.display = 'none';
});

// Aggiunta del listener per il nuovo pulsante UPLOAD
document.getElementById('uploadPlan').addEventListener('click', function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            caricaPianoAllenamento(file); // Carica il piano di allenamento
            // Nascondi il pulsante "Pausa"
            document.getElementById('pause').style.display = 'none';
            // Nascondi la popup
            document.getElementById('planSelectionPopup').style.display = 'none';
        }
    };
    input.click();
});

// Mostra la popup quando si clicca su "Select Plan"
document.getElementById('selectPlan').addEventListener('click', () => {
    if (isAutoMode && pianoAllenamento.length > 0) {
        // Comportamento da X - Chiudi il piano
        if (startTime && faseCorrente < pianoAllenamento.length) {
            stopAll(); // Chiamata originale a stopAll()
        } else {
            //document.getElementById('plan-section').style.display = 'none';
			document.getElementById('plan-section').innerHTML = ''; // Pulisci l'interfaccia
            isAutoMode = false;
        }
        ripristinaPulsantePiano();
		inizializzaPlanSection();

    } else {
        // Comportamento originale - Mostra selezione piano
        try {
            const files = mockJsonFiles;
            const dropdown = document.getElementById('planDropdown');
            dropdown.innerHTML = '';
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file.file;
                option.textContent = file.nome;
                dropdown.appendChild(option);
            });
            document.getElementById('planSelectionPopup').style.display = 'flex';
        } catch (error) {
            console.error("Errore durante il caricamento dei piani:", error);
            alert("Impossibile caricare i piani di allenamento.");
        }
    }
});

// Gestione del pulsante "Conferma"
document.getElementById('confirmPlanSelection').addEventListener('click', () => {
    const selectedFile = document.getElementById('planDropdown').value;
    if (!selectedFile) {
        alert("Seleziona un piano di allenamento!");
        return;
    }
    // CERCA PRIMA NEI PIANI SALVATI IN MEMORIA
    const savedPlan = window.mockJsonFiles.find(p => p.file === selectedFile);
    if (savedPlan && savedPlan.data) {
        // 1. Caso: Piano personalizzato (carica da memoria)
        caricaPianoAllenamentoFromData(savedPlan.data);
        document.getElementById('planSelectionPopup').style.display = 'none';
    } else {
        // 2. Caso: Piano predefinito (carica da file)
        const cacheBuster = Date.now();
        fetch(`/runner/Piani/${selectedFile}?cacheBuster=${cacheBuster}`)
            .then(response => {
                if (!response.ok) throw new Error("File non trovato");
                return response.json();
            })
            .then(data => {
                caricaPianoAllenamentoFromData(data);
                document.getElementById('planSelectionPopup').style.display = 'none';
            })
            .catch(error => {
                console.error("Errore:", error);
                alert("Piano non trovato o formato non valido");
            });
    }
});

// Gestione del pulsante "Annulla"
document.getElementById('cancelPlanSelection').addEventListener('click', () => {
    document.getElementById('planSelectionPopup').style.display = 'none';
});

// Funzione ausiliaria per caricare il piano da dati JSON
function caricaPianoAllenamentoFromData(piano) {
    // Resetta lo stato del piano precedente
    pianoAllenamento = [];
    faseCorrente = 0;
    distance = 0;
    document.getElementById('distance').textContent = distance.toFixed(3);
    document.getElementById('elapsedTime').textContent = "00:00:00";
    // Trasforma il JSON in array piatto
    trasformaInArrayPiatto(piano);
    // Visualizza il piano con il nome
    const nomePianoAllenamento = piano.nome || "Piano di allenamento";
    visualizzaPiano(pianoAllenamento, nomePianoAllenamento);
    // Imposta la modalità automatica
    isAutoMode = true;
    document.getElementById('plan-section').style.display = 'block';
    document.getElementById('selectPlan').innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
    `;
}

// Funzione per caricare il piano di allenamento e trasformarlo in array piatto
function caricaPianoAllenamento(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const piano = JSON.parse(e.target.result);
            // Resetta lo stato del piano precedente
            pianoAllenamento = []; // Resetta l'array piatto
            faseCorrente = 0; // Resetta l'indice della fase corrente
            distance = 0; // Resetta la distanza percorsa
            document.getElementById('distance').textContent = distance.toFixed(3); // Aggiorna l'interfaccia
            document.getElementById('elapsedTime').textContent = "00:00:00"; // Resetta il timer
            // Trasforma il JSON in array piatto
            trasformaInArrayPiatto(piano);
            console.log("Piano di allenamento caricato:", pianoAllenamento);
            // Visualizza il piano con il nome
            const nomePianoAllenamento = piano.nome || "Piano di allenamento";
            visualizzaPiano(pianoAllenamento, nomePianoAllenamento);
            // Imposta la modalità automatica
            isAutoMode = true;
            document.getElementById('plan-section').style.display = 'block'; // Mostra la sezione
        } catch (error) {
            console.error("Errore durante il caricamento del JSON:", error);
        }
    };
    reader.readAsText(file); // Legge il file come testo
    document.getElementById('selectPlan').innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
    `;
}

// Funzione per trasformare il JSON in array piatto
function trasformaInArrayPiatto(piano) {
    pianoAllenamento = []; // Resetta l'array piatto
    piano.allenamento.forEach(fase => {
        if (fase.tempo) {
            // Aggiunge una fase singola
            pianoAllenamento.push({
                tempo: fase.tempo,
                velocita: fase.velocita,
                descrizione: fase.descrizione
            });
        } else if (fase.ripetizioni && fase.serie) {
            // Aggiunge le serie ripetute
            for (let i = 0; i < fase.ripetizioni; i++) {
                fase.serie.forEach(serie => {
                    pianoAllenamento.push({
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
function visualizzaPiano(pianoAllenamento, nomePianoAllenamento) {
    const planInfoDiv = document.getElementById('plan-section');
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
    pianoAllenamento.forEach(fase => {
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
        <span class="nome-fase">FASE 1: ${pianoAllenamento[0].descrizione}</span>
        <span class="conto-alla-rovescia">${formattaTempo(pianoAllenamento[0].tempo * 60)}</span>
    `;
    planInfoDiv.appendChild(faseAttualeDiv);
    // Aggiunge l'istogramma
    const histogramDiv = document.createElement('div');
    histogramDiv.classList.add('plan-histogram');
    let currentTime = 0;
    pianoAllenamento.forEach((fase, index) => {
        const bar = creaBarra(fase.tempo, fase.velocita, currentTime, durataTotale, index);
        histogramDiv.appendChild(bar);
        currentTime += fase.tempo;
    });
    planInfoDiv.appendChild(histogramDiv);
    // Evidenzia la fase attiva
    evidenziaFaseAttiva(faseCorrente);
    // Aggiunge la X come elemento figlio di plan-section, posizionata fuori a destra
    /*
	const closeButton = document.createElement('button');
    closeButton.classList.add('close-button');
    closeButton.textContent = '×';
    closeButton.style.display = 'none';
    closeButton.addEventListener('click', () => {
        if (isAutoMode && startTime && faseCorrente < pianoAllenamento.length) {
            // Se c'è un allenamento attivo, ferma tutto e resetta lo stato
            stopAll(); // Ferma tutto e resetta lo stato
        } else {
            // Se non c'è un allenamento attivo, nascondi semplicemente la sezione
            document.getElementById('plan-section').style.display = 'none'; // Nascondi la sezione
            document.getElementById('selectPlan').style.display = 'inline-block'; // Ripristina il pulsante SELECT PLAN
            document.getElementById('pause').style.display = 'inline-block'; // Mostra nuovamente il pulsante "Pausa"
            isAutoMode = false; // Disabilita la modalità automatica
        }
        // Nascondi la X
        closeButton.style.display = 'none';
    });
    planInfoDiv.appendChild(closeButton);
	*/
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
        if (isAutoMode && pianoAllenamento.length > 0) {
            // Cambia alla fase corrispondente
            faseCorrente = index; // Imposta l'indice della fase corrente
            gestioneFasi(); // Carica la fase selezionata
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
function evidenziaFaseAttiva(indiceFase) {
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
                timeLabel.textContent = `${pianoAllenamento[indiceFase].tempo} min`; // Aggiungi "min"
                speedLabel.textContent = `${pianoAllenamento[indiceFase].velocita} Km/h`; // Aggiungi "Km/h"
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
                timeLabel.textContent = `${pianoAllenamento[index].tempo}`;
                speedLabel.textContent = `${pianoAllenamento[index].velocita}`;
            }
        } else {
            // Fase futura
            bar.classList.remove('active', 'completata');
            bar.style.borderBottom = 'none';
            bar.style.boxShadow = 'none';
            bar.style.zIndex = '0';
            // Rimuovi le unità di misura
            if (timeLabel && speedLabel) {
                timeLabel.textContent = `${pianoAllenamento[index].tempo}`;
                speedLabel.textContent = `${pianoAllenamento[index].velocita}`;
            }
        }
    });
}

// Funzione per avviare l'allenamento automatico
function avviaAllenamento() {
    if (pianoAllenamento.length === 0 || faseCorrente >= pianoAllenamento.length) {
        console.log("Nessun piano caricato o allenamento già completato.");
        return;
    }
    // Invia il comando 0x07
    sendStartCommand();
    // Imposta startTime prima del ritardo per iniziare a contare subito
    startTime = Date.now(); // Inizializza startTime subito
    pausedTime = 0; // Resetta pausedTime
    currentSetSpeed = pianoAllenamento[faseCorrente].velocita;
    // Imposta la velocità e avvia il timer dopo 5 secondi
    setTimeout(() => {
        // Carica la fase corrente
        gestioneFasi();
        setSpeed(currentSetSpeed);
    }, 5000); // Ritardo di 5 secondi
}

// Funzione per mostrare il messaggio di completamento
function mostraMessaggioCompletamento() {
    const completionMessage = document.getElementById('completionMessage');
    completionMessage.style.display = 'block'; // Mostra il messaggio
    // Aggiungi un listener per il click sul messaggio
    completionMessage.addEventListener('click', function() {
        completionMessage.style.display = 'none'; // Nascondi al click
		inizializzaPlanSection();
    });
}

function gestioneFasi() {
    document.querySelector('.conto-alla-rovescia').textContent =
        `${Math.floor(tempoRimanente / 60)}:${('0' + (tempoRimanente % 60)).slice(-2)}`;
    let fase = pianoAllenamento[faseCorrente];
    const planInfoDiv = document.getElementById('plan-section');
    let faseAttualeDiv = planInfoDiv.querySelector('.fase-attuale');
    const contoAllaRovescia = document.querySelector('.conto-alla-rovescia').textContent;
    const tempoTrascorso = (fase.tempo * 60) - tempoRimanente;

    if (tempoRimanente >= 0) {
        // Aggiorna il progresso della barra
        aggiornaProgressoFase(tempoTrascorso, fase.tempo * 60);
        // Attiva il lampeggio negli ultimi 5 secondi
        if (tempoRimanente <= 5) {
            faseAttualeDiv.querySelector('.conto-alla-rovescia').classList.add('lampeggia');
        } else {
            faseAttualeDiv.querySelector('.conto-alla-rovescia').classList.remove('lampeggia');
        }
		// Bip iniziale (inizio fase) - 
		if (tempoTrascorso === 1) {
			playMusicForSpeed(currentSetSpeed);
			playTone(1500, 1.5, 1.0);  
		}
		// Bip a 10 secondi dalla fine 
		else if (tempoRimanente === 10) {
			playTone(1300, 1, 1.0);   
		}
		// Bip a 5 secondi dalla fine 
		else if (tempoRimanente === 5) {
			playTone(1400, 1, 1.0);  
		}

        if (tempoTrascorso >= fase.tempo * 60) {
            // CAMBIO FASE!
            faseCorrente++;
            if (faseCorrente < pianoAllenamento.length) {
                // Passa alla fase successiva
                fase = pianoAllenamento[faseCorrente];
                currentSetSpeed = fase.velocita;
				playMusicForSpeed(currentSetSpeed);
                console.log("INIZIO FASE " + faseCorrente + ": " + fase.descrizione + " - velocità: " + fase.velocita + " - tempo: " + fase.tempo);
                // Aggiorna il nome della fase
                faseAttualeDiv.innerHTML = `
                    FASE ${faseCorrente + 1}: ${fase.descrizione} <span class="conto-alla-rovescia">${formattaTempo(fase.tempo * 60)}</span>
                `;
                // Aggiorna la barra di progresso
                evidenziaFaseAttiva(faseCorrente);
                // Aggiorna la velocità
                document.getElementById('speedInput').value = currentSetSpeed.toFixed(1);
                setSpeed(currentSetSpeed);
                // Aggiungi le unità di misura alle etichette della fase attiva
                const barraAttiva = document.querySelector('.plan-histogram .bar.active');
                if (barraAttiva) {
                    const timeLabel = barraAttiva.querySelector('.time-label');
                    const speedLabel = barraAttiva.querySelector('.speed-label');
                    if (timeLabel && speedLabel) {
                        timeLabel.textContent = `${fase.tempo} min`;
                        speedLabel.textContent = `${fase.velocita} kmh`;
                    }
                }
            } else {
                // Allenamento completato
                console.log("Allenamento completato!");
				ripristinaPulsantePiano();
                mostraMessaggioCompletamento();
                stopAll();
            }
        }
    } else {
        faseAttualeDiv.querySelector('.conto-alla-rovescia').classList.remove('lampeggia');
    }
}

let audioContext; // Mantieni una singola istanza globale
let isPlayingTone = false; // Flag per evitare sovrapposizioni

function playTone(frequency, duration, volume = 1.0) {
    // Evita sovrapposizioni di bip
    if (isPlayingTone) return;
    isPlayingTone = true;

    // Crea l'AudioContext solo se non esiste
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configurazione del tono
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    
    // Imposta volume massimo e fade-in istantaneo (senza click)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.001);

    // Ferma il bip dopo la durata specificata
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);

    // Resetta il flag alla fine
    oscillator.onended = () => {
        isPlayingTone = false;
    };
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
    if (isAutoMode && pianoAllenamento.length > 0) { // Solo in modalità automatica
        if (event.key === 'ArrowLeft') {
            // Torna alla fase precedente
            if (faseCorrente > 0) {
                faseCorrente--;
                gestioneFasi(); // Carica la fase precedente
            }
        } else if (event.key === 'ArrowRight') {
            // Passa alla fase successiva
            if (faseCorrente < pianoAllenamento.length - 1) {
                faseCorrente++;
                gestioneFasi(); // Carica la fase successiva
            }
        }
    }
});

function ripristinaPulsantePiano()
{
        document.getElementById('selectPlan').innerHTML = `
            <svg viewBox="0 0 26 24" width="26" height="24">
                <rect x="2" y="8" width="3" height="8" fill="currentColor"/>
                <rect x="7" y="4" width="3" height="12" fill="currentColor"/>
                <rect x="12" y="6" width="3" height="10" fill="currentColor"/>
                <rect x="17" y="2" width="3" height="14" fill="currentColor"/>
                <rect x="22" y="10" width="3" height="6" fill="currentColor"/>
            </svg>
        `;
}

function inizializzaPlanSection() {
    const planSection = document.getElementById('plan-section');
    planSection.innerHTML = `
        <div class="empty-plan-section">
            <div class="empty-plan-content">
                <span class="runner-emoji">🏃‍♂️</span>
                <div class="treadmill-container">
                    <div class="treadmill-belt"></div>
                </div>
            </div>
        </div>
    `;
    planSection.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
	inizializzaPlanSection();
});

// Variabili per la gestione della musica
let currentAudio = null;
let currentMusicCategory = null;

function playMusicForSpeed(speed) {
    // Determina la categoria in base alla velocità
    let category;
    if (speed < 6) {
        category = 'piano';
    } else if (speed >= 6 && speed < 8) {
        category = 'media';
    } else {
        category = 'forte';
    }

    // Se la categoria è cambiata, cambia musica
    if (category !== currentMusicCategory) {
        // Ferma la musica corrente se c'è
        stopMusic();

        // Scegli una canzone casuale dalla categoria
        const songNumber = Math.floor(Math.random() * 3) + 1; // 1, 2 o 3
        //const songPath = `/runner/Musica/${category}0${songNumber}.mp3`;
const songPath = 'piano01.mp3';
        // Riproduci la nuova canzone
        currentAudio = new Audio(songPath);
        currentAudio.loop = true;
        currentAudio.play().catch(e => console.log("Autoplay non permesso:", e));
        currentMusicCategory = category;
    }
}

function stopMusic() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    currentMusicCategory = null;
}
