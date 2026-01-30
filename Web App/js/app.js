/**
 * Eco-BJJ Class Creator Logic
 */

// Data State
let state = {
    content: null,
    selectedConceptId: null,
    classTitle: "",
    segments: {} // { segmentId: [ { gameId: '...', ... } ] }
};
window.state = state; // Expose for Editor

// Constants based on ClassStructure.md
// Constants based on ClassStructure.md
const CLASS_TEMPLATE = [
    { id: 'standing', title: 'Standing', targetDuration: 10, type: 'standing' },
    { id: 'mobility', title: 'Mobility', targetDuration: 15, type: 'game' },
    { id: 'takedowns', title: 'Takedowns', targetDuration: 15, type: 'takedown' },
    { id: 'discussion', title: 'Discussion', targetDuration: 5, type: 'discussion' },
    { id: 'applications', title: 'Concept Applications', targetDuration: 30, type: 'game' },
    { id: 'review', title: 'Review', targetDuration: 5, type: 'review' },
    { id: 'rolling', title: 'Free Roll', targetDuration: 15, type: 'rolling' }
];

async function init() {
    try {
        const response = await fetch('data/content.json?v=' + Date.now()); // Cache bust
        if (!response.ok) throw new Error('Failed to load content');

        state.content = await response.json();
        console.log('Content loaded:', state.content);

        renderConceptSelect(); // Renamed
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Error loading content. Please ensure python http server is running.');
    }
}

function renderConceptSelect() {
    const select = document.getElementById('concept-select');
    if (!state.content.concepts) {
        console.error("No concepts found in state.content");
        return;
    }
    console.log("Rendering concepts:", state.content.concepts.length);

    // Clear and Populate
    select.innerHTML = '<option value="" disabled selected>Select a Concept...</option>';
    state.content.concepts.forEach(concept => {
        const option = document.createElement('option');
        option.value = concept.id;
        option.textContent = concept.title;
        select.appendChild(option);
    });

    const parent = select.parentElement;

    // Check if already wrapped (prevent duplicate wrapping on re-renders)
    if (parent.classList.contains('select-wrapper')) return;

    // Create Wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'select-wrapper';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '10px';
    wrapper.style.width = '100%';

    // Move select into wrapper
    parent.replaceChild(wrapper, select);
    wrapper.appendChild(select);

    // Create Button
    const btn = document.createElement('button');
    btn.innerText = '+';
    btn.className = 'btn secondary btn-small new-concept-btn';
    btn.title = "Create New Concept";
    // Inline styling for the button to match height or looks
    btn.style.height = '43px'; // Match standard input height roughly?
    btn.style.padding = '0 15px';
    btn.onclick = () => window.openConceptModal();

    wrapper.appendChild(btn);
}

function setupEventListeners() {
    const select = document.getElementById('concept-select');
    select.addEventListener('change', (e) => {
        state.selectedConceptId = e.target.value;
        generateClassStructure();
    });

    document.getElementById('print-btn').addEventListener('click', () => {
        window.print();
    });

    // Class Title Input
    const titleInput = document.getElementById('class-title-input');
    if (titleInput) {
        titleInput.addEventListener('input', (e) => {
            state.classTitle = e.target.value;
        });
    }

    // User requested removal of extra + button, so we remove the dynamic injection.

    // Save/Load Listeners
    const saveBtn = document.getElementById('save-class-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            console.log("Save clicked");
            saveClass();
        });
    }

    const loadBtn = document.getElementById('load-class-btn');
    if (loadBtn) {
        loadBtn.addEventListener('click', loadClass);
    }
}

async function saveClass() {
    // 1. Get Title
    const name = state.classTitle;
    if (!name || name.trim() === "") {
        alert("Please enter a Class Title before saving.");
        return;
    }

    // 2. Build Data Payload from State
    const classData = {
        title: name,
        conceptId: state.selectedConceptId,
        segments: state.segments // Maps segmentId -> array of game objects
    };

    console.log("Saving class:", classData);

    try {
        const response = await fetch('/api/save_class', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                data: classData
            })
        });

        if (response.ok) {
            alert('Class saved successfully!');
        } else {
            alert('Error saving class');
        }
    } catch (e) {
        console.error(e);
        alert('Error saving class');
    }
}

async function loadClass() {
    // Fetch list of classes
    try {
        const response = await fetch('/api/list_classes');
        const data = await response.json();
        const classes = data.classes;

        // Show modal to select
        const existing = document.querySelector('.modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const options = classes.map(c => `<option value="${c}">${c}</option>`).join('');

        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Load Class</h3>
                    <button onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <select id="load-class-select" style="width: 100%; padding: 10px; margin-bottom: 20px;">
                        ${options}
                    </select>
                    <div style="text-align: right;">
                        <button class="btn primary" id="confirm-load-btn">Load</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('confirm-load-btn').onclick = async () => {
            const selectedName = document.getElementById('load-class-select').value;
            if (selectedName) {
                // Load it
                const res = await fetch('/api/load_class', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: selectedName })
                });

                if (res.ok) {
                    const result = await res.json();
                    const loadedData = result.data;

                    // Restore State
                    state.classTitle = loadedData.title || selectedName;
                    state.selectedConceptId = loadedData.conceptId;
                    state.segments = loadedData.segments || {};

                    // Update UI
                    const titleInput = document.getElementById('class-title-input');
                    if (titleInput) titleInput.value = state.classTitle;

                    const conceptSelect = document.getElementById('concept-select');
                    if (conceptSelect) conceptSelect.value = state.selectedConceptId;

                    // Re-render
                    generateClassStructure();

                    document.querySelector('.modal-overlay').remove();
                } else {
                    alert("Error loading class");
                }
            }
        };

    } catch (e) {
        console.error(e);
        alert('Error listing classes');
    }
}



function generateClassStructure() {
    const concept = state.content.concepts.find(t => t.id === state.selectedConceptId);
    if (!concept) return;

    // Show panels
    document.getElementById('preview-panel').classList.remove('hidden');
    document.getElementById('class-meta').classList.remove('hidden');

    // Update Meta
    const metaContainer = document.getElementById('class-meta');
    metaContainer.innerHTML = '';
    metaContainer.classList.add('hidden');

    // Render Timeline
    const timeline = document.getElementById('class-timeline');
    timeline.innerHTML = '';

    CLASS_TEMPLATE.forEach((segment) => {
        // Init state for segment if needed
        if (!state.segments[segment.id]) {
            state.segments[segment.id] = [];
        }

        const currentGames = state.segments[segment.id];

        // Calculate Duration
        let totalDuration = 0;
        currentGames.forEach(g => {
            const gameMeta = state.content.games.find(x => x.id === g.gameId);
            if (gameMeta) {
                let roundTime = parseInt(gameMeta.duration) || 5;
                let players = parseInt(gameMeta.players) || 2;
                let type = gameMeta.type || 'Continuous';

                if (type === 'Round Switching') {
                    // Total = Round Time * Players
                    totalDuration += (roundTime * players);
                } else {
                    totalDuration += roundTime;
                }
            } else {
                totalDuration += 5; // Default fallback
            }
        });


        const segmentEl = document.createElement('div');
        segmentEl.className = 'class-segment';

        let contentHtml = '';

        if (segment.type === 'discussion') {
            // Inject Concept Content here
            let imagesHtml = '';
            if (concept.images && concept.images.length > 0) {
                imagesHtml = `<div class="theory-images">
                ${concept.images.map(img => `<img src="${img}" alt="Concept Image" loading="lazy">`).join('')}
                </div>`;
            }

            contentHtml = `
                <div class="section-header-row">
                    <button class="btn-small secondary edit-theory-btn" onclick="window.openConceptModal(window.state.selectedConceptId)">✎ Edit Concept</button>
                </div>
                <div class="theory-content" id="theory-content-display">
                    ${markedParse(concept.content || concept.description || 'No content available.')}
                    ${imagesHtml}
                </div>
            `;
        } else if (segment.type === 'review') {
            contentHtml = `<p class="segment-note">Review concepts</p>`;
        } else {
            // Game List
            let gamesHtml = currentGames.map((g, index) => {
                const gameMeta = state.content.games.find(x => x.id === g.gameId);
                const title = gameMeta ? gameMeta.title : 'Unknown Game';
                const description = gameMeta ? (gameMeta.description || '') : '';
                const goals = gameMeta ? (gameMeta.goals || '') : '';
                const purpose = gameMeta ? (gameMeta.purpose || '') : '';
                const focus = gameMeta ? (gameMeta.focus || '') : '';

                // Duration detail for display
                let durationTxt = '';
                let metaTags = '';
                if (gameMeta) {
                    let rt = parseInt(gameMeta.duration) || 5;
                    let p = parseInt(gameMeta.players) || 2;
                    let t = gameMeta.type || 'Continuous';
                    let intensity = gameMeta.intensity || '';

                    if (t === 'Round Switching') {
                        durationTxt = `${rt}m x ${p}p = ${rt * p}m`;
                    } else {
                        durationTxt = `${rt}m`;
                    }

                    metaTags = `
                        <span class="meta-tag">⏱ ${durationTxt}</span>
                        <span class="meta-tag">👥 ${p}</span>
                        <span class="meta-tag">${t}</span>
                        ${intensity ? `<span class="meta-tag intensity-${intensity.toLowerCase()}">${intensity}</span>` : ''}
                    `;
                }

                // Build summary line for collapsed view
                const summaryLine = goals ? goals : (purpose ? purpose : 'No description');

                return `
                <details class="game-card" open>
                    <summary class="game-card-summary">
                        <div class="game-header-left">
                            <span class="game-title">${title}</span>
                            <span class="game-meta-inline">${metaTags}</span>
                        </div>
                        <div class="game-card-actions">
                            <button class="icon-btn edit-btn" title="Edit Game" onclick="event.stopPropagation(); window.openGameModal('${g.gameId}')">✎</button>
                            <button class="icon-btn remove-btn" title="Remove" onclick="event.stopPropagation(); removeGame('${segment.id}', ${index})">×</button>
                        </div>
                    </summary>
                    <div class="game-card-content">
                        ${goals ? `<div class="game-info-row"><strong>Goals:</strong> ${goals}</div>` : ''}
                        ${purpose ? `<div class="game-info-row"><strong>Purpose:</strong> ${purpose}</div>` : ''}
                        ${focus ? `<div class="game-info-row"><strong>Focus:</strong> ${focus}</div>` : ''}
                        ${description ? `<div class="game-info-row game-description">${markedParse(description)}</div>` : ''}
                    </div>
                </details>
                `;
            }).join('');

            // Add Button
            gamesHtml += `
                <div class="add-game-row">
                    <button class="icon-btn add-btn" onclick="openGamePicker('${segment.id}')" title="Add Activity" style="width: 100%; border: 1px dashed #444; padding: 10px;">
                        +
                    </button>
                </div>
                `;

            contentHtml = gamesHtml;
        }

        // Time Badge Logic
        let timeColor = '#888';
        if (totalDuration > 0) {
            const diff = totalDuration - segment.targetDuration;
            if (Math.abs(diff) <= 2) timeColor = '#4caf50'; // Green
            else if (diff > 2) timeColor = '#f44336'; // Red (Over)
            else timeColor = '#ff9800'; // Orange (Under)
        }

        const timeDisplay = totalDuration > 0
            ? `<span style="color: ${timeColor}; margin-left: 5px;">(${totalDuration}/${segment.targetDuration} min)</span>`
            : `<span class="time-badge">${segment.targetDuration} min</span>`;

        segmentEl.innerHTML = `
            <details class="section-collapsible" open>
                <summary class="section-summary">
                    <span class="section-title">${segment.title}</span>
                    ${timeDisplay}
                </summary>
                <div class="section-content">
                    ${contentHtml}
                </div>
            </details>
            `;

        timeline.appendChild(segmentEl);
    });

    setupDragAndDrop();
}

window.removeGame = (segmentId, index) => {
    if (state.segments[segmentId]) {
        state.segments[segmentId].splice(index, 1);
        generateClassStructure();
    }
};

// Drag & Drop
let draggedImageSrc = null;

function setupDragAndDrop() {
    // Draggable Images
    const images = document.querySelectorAll('.theory-images img');
    images.forEach(img => {
        img.draggable = true;
        img.addEventListener('dragstart', (e) => {
            draggedImageSrc = e.target.src;
            e.dataTransfer.setData('text/plain', e.target.src);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    // Drop Zone (Timeline)
    const timeline = document.getElementById('class-timeline');
    // Ensure relative positioning for absolute children
    if (getComputedStyle(timeline).position === 'static') {
        timeline.style.position = 'relative';
    }

    timeline.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
        e.dataTransfer.dropEffect = 'copy';
    });

    timeline.addEventListener('drop', (e) => {
        e.preventDefault();
        const src = e.dataTransfer.getData('text/plain') || draggedImageSrc;
        if (src) {
            const rect = timeline.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            createDroppedImage(src, x, y, timeline);
        }
    });
}

function createDroppedImage(src, x, y, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'dropped-image-wrapper';
    wrapper.style.left = `${x} px`;
    wrapper.style.top = `${y} px`;

    // Resizable Image
    const img = document.createElement('img');
    img.src = src;

    // Controls
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '×';
    closeBtn.className = 'image-close-btn';
    closeBtn.onclick = () => wrapper.remove();

    wrapper.appendChild(img);
    wrapper.appendChild(closeBtn);
    container.appendChild(wrapper);

    // Draggable within timeline
    makeElementDraggable(wrapper);
}

function makeElementDraggable(el) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    el.onmousedown = (e) => {
        if (e.target.tagName === 'BUTTON') return; // Don't drag on close click
        e.preventDefault();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = el.offsetLeft;
        initialTop = el.offsetTop;

        document.onmousemove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = `${initialLeft + dx} px`;
            el.style.top = `${initialTop + dy} px`;
        };

        document.onmouseup = () => {
            isDragging = false;
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };
}

// Simple markdown parser for description
function markedParse(text) {
    if (!text) return '';
    return text
        .replace(/^# (.*$)/gim, '<h4>$1</h4>')
        .replace(/^## (.*$)/gim, '<h5>$1</h5>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\n/gim, '<br>');
}
window.markedParse = markedParse;

// Global Game Picker handler
// Global Game Picker handler
window.openGamePicker = (segmentId) => {
    window.lastModalArgs = { segmentId };
    // Default filter to selected Concept if possible, or All?
    // Let's default to All for exploration, or matching category?
    // User requested "drop down for each of the concepts".
    createModal(segmentId);
};

function createModal(segmentId, filterCategory = null) {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    // Concept Dropdown options
    const concepts = state.content.concepts || [];
    const conceptOptions = concepts.map(c =>
        `<option value="${c.title}" ${c.title === filterCategory ? 'selected' : ''}>${c.title}</option>`
    ).join('');

    // Filter Games
    let gamesToShow = state.content.games;
    if (filterCategory && filterCategory !== 'All') {
        gamesToShow = gamesToShow.filter(g => g.category === filterCategory);
    }

    let contentHtml = '';
    // Check if we should group by category if no filter selected?
    // Or just show flat list if filtered?

    if (filterCategory && filterCategory !== 'All') {
        contentHtml = renderGameOptions(gamesToShow, segmentId);
    } else {
        // Grouped View (Default)
        if (state.content.categories && state.content.categories.length > 0) {
            state.content.categories.forEach(cat => {
                const catGames = state.content.games.filter(g => g.category === cat.title);
                if (catGames.length > 0) {
                    contentHtml += `
                <details class="category-group" open>
                            <summary class="category-header">
                                <h3>${cat.title}</h3>
                            </summary>
                            <div class="category-games">
                                ${renderGameOptions(catGames, segmentId)}
                            </div>
                        </details>
                `;
                }
            });
        } else {
            contentHtml = renderGameOptions(state.content.games, segmentId);
        }
    }

    overlay.innerHTML = `
                <div class="modal">
            <div class="modal-header">
                <h3>Select Game</h3>
                <div class="modal-actions">
                    <button class="btn-small secondary" onclick="createGame('${filterCategory || ''}')">+ New Game</button>
                    <button class="icon-btn close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
            </div>
            <div class="modal-subheader" style="padding: 10px; border-bottom: 1px solid #333;">
                <select id="picker-concept-filter" onchange="window.filterPicker('${segmentId}', this.value)" style="width: 100%; padding: 8px;">
                     <option value="All">All Concepts</option>
                     ${conceptOptions}
                </select>
            </div>
            <div class="modal-body">
                ${contentHtml}
            </div>
        </div>
                `;

    document.body.appendChild(overlay);
}

window.filterPicker = (segmentId, category) => {
    createModal(segmentId, category);
};

function renderGameOptions(games, segmentId) {
    return games.map(game => `
        <div class="game-option" onclick="selectGame('${game.id}', '${segmentId}')">
            <h4>${game.title}</h4>
        </div>
    `).join('');
}

window.selectGame = (gameId, segmentId) => {
    const game = state.content.games.find(g => g.id === gameId);
    if (!game) return;

    // Add to State
    if (!state.segments[segmentId]) state.segments[segmentId] = [];

    state.segments[segmentId].push({
        gameId: game.id,
        // We could store custom duration here later if we want to override
    });

    generateClassStructure();

    // Close modal
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) overlay.remove();
};

// Removed clearSlot as we check for existence in generateClassStructure via removeGame

// Auto init logic
import { Editor } from './editor.js';


// Game Editor Modal
window.openGameModal = (gameId = null, preselectedCategory = null) => {
    // Remove existing modal
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let game = null;
    let isEdit = false;

    if (gameId) {
        game = window.state.content.games.find(g => g.id === gameId);
        if (game) isEdit = true;
    }

    const categories = window.state.content.categories || [];
    const optionsHtml = categories.map(c =>
        `<option value="${c.title}" ${c.title === (game ? game.category : preselectedCategory) ? 'selected' : ''}>${c.title}</option>`
    ).join('');

    overlay.innerHTML = `
                <div class="modal">
            <div class="modal-header">
                <h3>${isEdit ? 'Edit Game' : 'Create New Game'}</h3>
                <button onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="game-edit-id" value="${game ? game.id : ''}">
                <div class="form-group">
                    <label>Category</label>
                    <select id="new-game-category" ${isEdit ? 'disabled' : ''}> <!-- Disable category change for now to avoid move logic -->
                        <option value="" disabled ${!preselectedCategory && !game ? 'selected' : ''}>Select Category...</option>
                        ${optionsHtml}
                    </select>
                </div>
                <div class="form-group">
                    <label>Game Title</label>
                    <input type="text" id="new-game-title" class="editor-textarea" style="height: auto;" 
                           value="${game ? game.title : ''}" placeholder="e.g. King of the Hill">
                </div>
                <div class="form-row" style="display: flex; gap: 10px;">
                    <div class="form-group" style="flex: 1;">
                        <label>Players</label>
                        <input type="number" id="new-game-players" class="editor-textarea" style="height: auto;" 
                               value="${game ? (game.players || 2) : 2}" min="1">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label style="display: flex; align-items: center; gap: 5px;">
                            Round Time (mins)
                            <span class="info-icon info-popup-trigger" data-tooltip="Round length can impact the intensity and variability, with shorter rounds tending towards high intensity with little room for exploration.">ⓘ</span>
                        </label>
                        <input type="number" id="new-game-duration" class="editor-textarea" style="height: auto;" 
                               value="${game && game.duration ? parseInt(game.duration) : 5}" min="1" step="1">
                    </div>
                </div>
                <div class="form-row" style="display: flex; gap: 10px;">
                    <div class="form-group" style="flex: 1;">
                         <label>Game Type</label>
                         <select id="new-game-type" class="editor-textarea" style="height: auto;">
                             ${['Continuous', 'Alternating', 'Round Switching'].map(t =>
        `<option value="${t}" ${game && (game.type === t || game.gameType === t) ? 'selected' : ''}>${t}</option>`
    ).join('')}
                         </select>
                    </div>
                    <div class="form-group" style="flex: 1;">
                         <label>Intensity</label>
                         <select id="new-game-intensity" class="editor-textarea" style="height: auto;">
                             ${['Flow', 'Cooperative', 'Adversarial'].map(t =>
        `<option value="${t}" ${game && game.intensity === t ? 'selected' : ''}>${t}</option>`
    ).join('')}
                         </select>
                    </div>
                </div>
                <div class="form-group">
                     <label style="display: flex; align-items: center; gap: 5px;">
                         Game Initiation Conditions
                         <span class="info-icon info-popup-trigger" data-tooltip="Static – Players start from a defined position with no movement.\nInertial – Players start after a defined movement is initiated.\nSeparated – Typically standing.">ⓘ</span>
                     </label>
                     <select id="new-game-initiation" class="editor-textarea" style="height: auto;">
                         ${['Static', 'Inertial', 'Separated'].map(t =>
        `<option value="${t}" ${game && game.initiation === t ? 'selected' : ''}>${t}</option>`
    ).join('')}
                     </select>
                </div>
                
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 5px;">
                        Goals
                        <span class="info-icon info-popup-trigger" data-tooltip="What are the win conditions for each player? What happens when a player wins?\n\nExample:\n• Top – Maintain position. No win condition.\n• Bottom – Recover a guard, sweep, stand up, or submit. Flip flop on win.">ⓘ</span>
                    </label>
                    <textarea id="new-game-goals" class="editor-textarea" rows="2" 
                           placeholder="e.g. Take the back, maintain control">${game ? (game.goals || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 5px;">
                        Purpose
                        <span class="info-icon info-popup-trigger" data-tooltip="What is the point in playing this game? What principles are we trying to teach?">ⓘ</span>
                    </label>
                    <textarea id="new-game-purpose" class="editor-textarea" rows="2" 
                           placeholder="e.g. Learn pressure control and weight distribution">${game ? (game.purpose || '') : ''}</textarea>
                </div>
                 <div class="form-group">
                    <label>Focus of Intention</label>
                    <textarea id="new-game-focus" class="editor-textarea" rows="2" 
                           placeholder="e.g. Constraint led drive or Outcome based">${game ? (game.focus || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="new-game-desc" class="editor-textarea" rows="4" placeholder="Describe the rules...">${game ? (game.description || '') : ''}</textarea>
                </div>
                <div class="editor-controls" style="justify-content: space-between;">
                    ${isEdit ? `<button class="btn remove-btn" onclick="window.deleteGame('${game.id}')" style="background: #d32f2f; color: white;">Delete Game</button>` : '<div></div>'}
                    <div style="display: flex; gap: 10px;">
                        <button class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                        <button class="btn primary" onclick="submitGameForm(${isEdit})">${isEdit ? 'Save Changes' : 'Create Game'}</button>
                    </div>
                </div>
            </div>
        </div>
                `;

    document.body.appendChild(overlay);
    if (!isEdit) setTimeout(() => document.getElementById('new-game-title').focus(), 100);
};

// Redirect old createGame calls
window.createGame = (cat) => window.openGameModal(null, cat);

window.submitGameForm = async (isEdit) => {
    const category = document.getElementById('new-game-category').value;
    const name = document.getElementById('new-game-title').value;
    const goals = document.getElementById('new-game-goals').value;
    const purpose = document.getElementById('new-game-purpose').value;
    const focus = document.getElementById('new-game-focus').value;
    const description = document.getElementById('new-game-desc').value;
    const players = document.getElementById('new-game-players').value;
    const duration = document.getElementById('new-game-duration').value;
    const gameType = document.getElementById('new-game-type').value;
    const intensity = document.getElementById('new-game-intensity').value;
    const initiation = document.getElementById('new-game-initiation').value;

    if (!category || !name) {
        alert('Category and Title are required.');
        return;
    }

    try {
        const payload = {
            type: 'game',
            name: name,
            category: category,
            goals: goals,
            purpose: purpose,
            focus: focus,
            description: description,
            players: players,
            duration: duration,
            gameType: gameType,
            intensity: intensity,
            initiation: initiation,
            overwrite: isEdit // Allow overwrite if editing
        };

        const response = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            const newId = (category + '-' + name).toLowerCase().replace(/[\s\/]/g, '-');

            const gameData = {
                id: newId,
                title: name,
                category: category,
                description: description,
                path: result.path, // May change if renamed, but simple overwrite keeps path usually
                goals: goals,
                purpose: purpose,
                focus: focus,
                players: players,
                duration: duration,
                type: gameType,
                intensity: intensity,
                initiation: initiation
            };

            if (isEdit) {
                // Update existing game object in state
                const editId = document.getElementById('game-edit-id').value;
                const idx = window.state.content.games.findIndex(g => g.id === editId);
                if (idx !== -1) {
                    window.state.content.games[idx] = { ...window.state.content.games[idx], ...gameData };
                }
                alert('Game updated!');
            } else {
                // Create New
                window.state.content.games.push(gameData);
                // Update Category State
                let catObj = window.state.content.categories.find(c => c.title === category);
                if (!catObj) {
                    catObj = {
                        id: category.toLowerCase().replace(/ /g, "-"),
                        title: category,
                        description: "",
                        games: []
                    };
                    window.state.content.categories.push(catObj);
                }
                catObj.games.push(newId);

                if (window.lastModalArgs) {
                    const { segmentId, slotIndex } = window.lastModalArgs;
                    selectGame(newId, segmentId, slotIndex);
                } else {
                    alert('Game created!');
                }
            }

            document.querySelector('.modal-overlay').remove();
            // Re-render class structure to reflect changes if the game is used
            generateClassStructure();

        } else {
            alert('Error saving: ' + await response.text());
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
};

// Concept Creation Modal
// Implement deleteGame
window.deleteGame = async (gameId) => {
    if (!confirm("Are you sure you want to delete this game? This cannot be undone.")) return;

    const game = window.state.content.games.find(g => g.id === gameId);
    if (!game) return;

    try {
        const response = await fetch('/api/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: game.path })
        });

        if (response.ok) {
            alert("Game deleted.");
            window.location.reload();
        } else {
            alert("Error deleting: " + await response.text());
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
};

// Concept Creation/Edit Modal
window.openConceptModal = (conceptId = null) => {
    console.log("openConceptModal called with ID:", conceptId);
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let concept = null;
    let isEdit = false;
    if (conceptId) {
        concept = window.state.content.concepts.find(c => c.id === conceptId);
        if (concept) isEdit = true;
    }

    overlay.innerHTML = `
                <div class="modal">
            <div class="modal-header">
                <h3>${isEdit ? 'Edit Concept' : 'Create New Concept'}</h3>
                <button onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="concept-edit-id" value="${concept ? concept.id : ''}">
                <div class="form-group">
                    <label>Concept Name</label>
                    <input type="text" id="new-concept-name" class="editor-textarea" style="height: auto;" 
                           value="${concept ? concept.title : ''}" placeholder="e.g. Guard Passing">
                </div>
                
                <div class="editor-controls" style="justify-content: space-between;">
                     ${isEdit ? `<button class="btn remove-btn" onclick="window.deleteConcept('${concept.id}')" style="background: #d32f2f; color: white;">Delete Concept</button>` : '<div></div>'}
                    <div style="display: flex; gap: 10px;">
                        <button class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                        <button class="btn secondary" onclick="submitConceptForm(${isEdit})">${isEdit ? 'Save Name' : 'Create Concept'}</button>
                    </div>
                </div>
            </div>
        </div>
                `;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('new-concept-name').focus(), 100);
}

window.deleteConcept = async (conceptId) => {
    if (!confirm("Are you sure you want to delete this concept? ALL associated games and files will be deleted.")) return;

    const concept = window.state.content.concepts.find(c => c.id === conceptId);
    if (!concept) return;

    try {
        const folderPath = concept.path.substring(0, concept.path.lastIndexOf('/'));

        const response = await fetch('/api/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: folderPath })
        });

        if (response.ok) {
            alert("Concept deleted.");
            window.location.reload();
        } else {
            alert("Error deleting: " + await response.text());
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

window.openConceptModal = (conceptId = null) => {
    console.log("openConceptModal called with ID:", conceptId);
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let concept = null;
    let isEdit = false;
    let contentBody = '';

    if (conceptId) {
        concept = window.state.content.concepts.find(c => c.id === conceptId);
        if (concept) {
            isEdit = true;
            // Strip header # Title if present to just show body
            contentBody = (concept.content || '').replace(/^# .*(\r?\n|\r)+/, '');
        }
    }

    overlay.innerHTML = `
                <div class="modal">
            <div class="modal-header">
                <h3>${isEdit ? 'Edit Concept' : 'Create New Concept'}</h3>
                <button onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="concept-edit-id" value="${concept ? concept.id : ''}">
                <div class="form-group">
                    <label>Concept Name</label>
                    <input type="text" id="new-concept-name" class="editor-textarea" style="height: auto;" 
                           value="${concept ? concept.title : ''}" placeholder="e.g. Guard Passing">
                </div>
                <div class="form-group">
                    <label>Description (Template Content)</label>
                    <textarea id="new-concept-desc" class="editor-textarea" rows="6" placeholder="Describe the concept...">${contentBody}</textarea>
                </div>
                
                <div class="editor-controls" style="justify-content: space-between;">
                     ${isEdit ? `<button class="btn remove-btn" onclick="window.deleteConcept('${concept.id}')" style="background: #d32f2f; color: white;">Delete Concept</button>` : '<div></div>'}
                    <div style="display: flex; gap: 10px;">
                        <button class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                        <button class="btn secondary" onclick="submitConceptForm(${isEdit})">${isEdit ? 'Save Changes' : 'Create Concept'}</button>
                    </div>
                </div>
            </div>
        </div>
                `;
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('new-concept-name').focus(), 100);
}

window.deleteConcept = async (conceptId) => {
    if (!confirm("Are you sure you want to delete this concept? ALL associated games and files will be deleted.")) return;

    const concept = window.state.content.concepts.find(c => c.id === conceptId);
    if (!concept) return;

    try {
        // Assuming path is .../ConceptName.md, and folder is parent
        const folderPath = concept.path.substring(0, concept.path.lastIndexOf('/'));

        const response = await fetch('/api/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: folderPath })
        });

        if (response.ok) {
            alert("Concept deleted.");
            window.location.reload();
        } else {
            alert("Error deleting: " + await response.text());
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

window.submitConceptForm = async (isEdit) => {
    const name = document.getElementById('new-concept-name').value;
    const description = document.getElementById('new-concept-desc').value;

    if (!name) return;

    try {
        const response = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'concept',
                name: name,
                description: description
            })
        });

        if (response.ok) {
            alert(isEdit ? 'Concept updated!' : 'Concept created!');
            window.location.reload();
        } else {
            alert('Error creating: ' + await response.text());
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

// Redirect createConcept
window.createConcept = window.openConceptModal;

// Init App
init().then(() => {
    // Init Editor after content load
    window.editor = new Editor();
});
