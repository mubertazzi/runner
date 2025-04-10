// creaPiano.js - VERSIONE FINALE FUNZIONANTE
let editorPopup = null;
let currentPlan = {
    nome: "Personalizzato",
    allenamento: []
};

// Inizializzazione garantita della lista piani
if (!window.mockJsonFiles) {
    window.mockJsonFiles = [];
    // Carica eventuale piano salvato in localStorage
    const savedPlan = localStorage.getItem('customPlan');
    if (savedPlan) {
        window.mockJsonFiles.unshift({
            file: `custom-plan-${Date.now()}.json`,
            nome: "Personalizzato",
            data: JSON.parse(savedPlan)
        });
    }
}

function initEditor() {
    editorPopup = document.createElement('div');
    editorPopup.id = 'editorPopup';
    editorPopup.className = 'popup';
    editorPopup.style.display = 'none';
    
    editorPopup.innerHTML = `
        <div class="popup-content" style="max-width: 600px;">
            <h3>Crea Piano <span style="color: #6200ea;">(Personalizzato)</span></h3>
            
            <div class="editor-section">
                <h4>Fasi dell'allenamento:</h4>
                <div id="phasesContainer" style="max-height: 300px; overflow-y: auto; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 5px; padding: 5px;"></div>
                <button id="addPhase" class="editor-button">+ Aggiungi Fase</button>
            </div>
            
            <div class="editor-buttons" style="justify-content: center;">
                <button id="cancelEdit" class="popup-button cancel">Annulla</button>			
                <button id="savePlan" class="popup-button confirm">Salva</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(editorPopup);
    
    document.getElementById('addPhase').addEventListener('click', addPhase);
    document.getElementById('savePlan').addEventListener('click', savePlan);
    document.getElementById('cancelEdit').addEventListener('click', hideEditor);
}

function showEditor() {
    if (!editorPopup) initEditor();
    
    currentPlan = {
        nome: "Personalizzato",
        allenamento: []
    };
    
    renderPhases();
    editorPopup.style.display = 'flex';
}

function hideEditor() {
    editorPopup.style.display = 'none';
}

function addPhase() {
    currentPlan.allenamento.push({
        tempo: 5,
        velocita: 5,
        descrizione: "Fase " + (currentPlan.allenamento.length + 1)
    });
    renderPhases();
}

function renderPhases() {
    const container = document.getElementById('phasesContainer');
    container.innerHTML = currentPlan.allenamento.length === 0 ? 
        '<p class="empty-message">Nessuna fase aggiunta</p>' : '';
    
    currentPlan.allenamento.forEach((phase, index) => {
        const phaseDiv = document.createElement('div');
        phaseDiv.className = 'phase-item';
        phaseDiv.innerHTML = `
            <div class="phase-header">
                <span><strong>Fase ${index + 1}:</strong> ${phase.descrizione}</span>
                <div>
                    <button class="edit-phase" data-index="${index}">✏️</button>
                    <button class="delete-phase" data-index="${index}">🗑️</button>
                </div>
            </div>
            <div class="phase-details">
                <span>⏱️ ${phase.tempo} min</span>
                <span>🏃 ${phase.velocita} km/h</span>
            </div>
        `;
        container.appendChild(phaseDiv);
    });

    // Aggiungi event listeners
    document.querySelectorAll('.edit-phase').forEach(btn => {
        btn.addEventListener('click', (e) => editPhase(parseInt(e.target.dataset.index)));
    });
    
    document.querySelectorAll('.delete-phase').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentPlan.allenamento.splice(parseInt(e.target.dataset.index), 1);
            renderPhases();
        });
    });
}

function editPhase(index) {
    const phase = currentPlan.allenamento[index];
    const editPopup = document.createElement('div');
    editPopup.className = 'popup';
    editPopup.style.display = 'flex';
    editPopup.id = 'editPhasePopup';
    editPopup.innerHTML = `
        <div class="popup-content" style="text-align: center;">
            <h3>Modifica Fase</h3>
            <div class="form-group">
                <label>Descrizione:</label>
                <input type="text" id="editDesc" value="${phase.descrizione}" class="styled-input">
            </div>
            <div class="form-group">
                <label>Tempo (min):</label>
                <input type="number" id="editTime" value="${phase.tempo}" min="0.1" step="0.1" class="styled-input">
            </div>
            <div class="form-group">
                <label>Velocità (km/h):</label>
                <input type="number" id="editSpeed" value="${phase.velocita}" min="0.5" max="20" step="0.1" class="styled-input">
            </div>
            <div class="editor-buttons" style="display: flex; justify-content: center; gap: 10px;">
                <button id="cancelEditPhase" class="popup-button cancel">Annulla</button>
                <button id="saveEdit" class="popup-button confirm">Salva</button>
            </div>
        </div>
    `;

    document.body.appendChild(editPopup);

    document.getElementById('saveEdit').addEventListener('click', () => {
        phase.descrizione = document.getElementById('editDesc').value;
        phase.tempo = parseInt(document.getElementById('editTime').value);
        phase.velocita = parseFloat(document.getElementById('editSpeed').value);
        closeEditPopup();
        renderPhases();
    });

    document.getElementById('cancelEditPhase').addEventListener('click', closeEditPopup);
}

// Aggiungi questa funzione per chiudere la popup
function closeEditPopup() {
    const editPopup = document.getElementById('editPhasePopup');
    if (editPopup) {
        document.body.removeChild(editPopup);
    }
}

function savePlan() {
    if (currentPlan.allenamento.length === 0) return;

    const customPlan = {
        file: `custom-plan-${Date.now()}.json`,
        nome: "Personalizzato",
        data: JSON.parse(JSON.stringify(currentPlan))
    };

    // 1. Sincronizza con la lista globale
    window.mockJsonFiles = window.mockJsonFiles.filter(p => p.nome !== "Personalizzato");
    window.mockJsonFiles.unshift(customPlan);

    // 2. Aggiornamento DOM garantito
    const dropdown = document.getElementById('planDropdown');
    if (dropdown) {
        // Rimuovi duplicati
        Array.from(dropdown.options).forEach(opt => {
            if (opt.text === "Personalizzato") opt.remove();
        });
        
        // Aggiungi nuovo piano
        const option = new Option("Personalizzato", customPlan.file);
        dropdown.add(option, 0);
        dropdown.value = customPlan.file;
    }

    // 3. Salva in localStorage per persistenza
    localStorage.setItem('customPlan', JSON.stringify(customPlan.data));

    hideEditor();
    document.getElementById('planSelectionPopup').style.display = 'flex';
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    initEditor();
    window.showPlanEditor = showEditor;
});
