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
    { id: 'standing', title: '1. Standing', targetDuration: 10, type: 'standing' },
    { id: 'mobility', title: '2. Mobility', targetDuration: 15, type: 'game' },
    { id: 'takedowns', title: '3. Takedowns', targetDuration: 15, type: 'takedown' },
    { id: 'discussion', title: '4. Discussion', targetDuration: 5, type: 'discussion' },
    { id: 'applications', title: '5. Concept Applications', targetDuration: 30, type: 'game' },
    { id: 'review', title: '6. Review', targetDuration: 5, type: 'review' },
    { id: 'rolling', title: '7. Free Roll', targetDuration: 15, type: 'rolling' }
];

async function init() {
    try {
        const response = await fetch('data/content.json');
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
    if (!state.content.concepts) return; // Renamed key

    state.content.concepts.forEach(concept => {
        const option = document.createElement('option');
        option.value = concept.id;
        option.textContent = concept.title;
        select.appendChild(option);
    });
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

async function createConcept() {
    const name = prompt("Enter new Concept name:");
    if (!name) return;

    try {
        const response = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'concept', name: name })
        });

        if (response.ok) {
            alert('Concept created!');
            window.location.reload();
        } else {
            alert('Error creating: ' + await response.text());
        }
    } catch (e) {
        alert('Error: ' + e.message);
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
            // Find game metadata to get default duration if not overriden?
            // For now assume we store duration in the segment instance
            // Or lookup in content
            const gameMeta = state.content.games.find(x => x.id === g.gameId);
            let dur = 0;
            if (gameMeta && gameMeta.duration) {
                dur = parseInt(gameMeta.duration.replace(/[^0-9]/g, '')) || 5;
            }
            // For testing simple logic
            totalDuration += (dur || 5); // Default 5 mins if not specified
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
                    <button class="btn-small secondary edit-theory-btn" onclick="window.editor.editConcept()">✎ Edit Concept</button>
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
                const goals = gameMeta ? (gameMeta.goals || 'N/A') : 'N/A';

                return `
                    <div class="selected-game">
                        <div class="game-header">
                            <h4>${title}</h4>
                            <div class="actions">
                                <button class="icon-btn edit-btn" title="Edit Game" onclick="window.editor.editGame('${g.gameId}', '${segment.id}', ${index})">✎</button>
                                <button class="icon-btn remove-btn" title="Remove" onclick="removeGame('${segment.id}', ${index})">×</button>
                            </div>
                        </div>
                        <div class="game-details" id="game-content-${segment.id}-${index}">
                            <p><strong>Goal:</strong> ${goals}</p>
                            <div class="game-description">${markedParse(description)}</div>
                        </div>
                    </div>
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
            ? `<span style="color: ${timeColor}; margin-left: 5px;">(${totalDuration} / ${segment.targetDuration} min)</span>`
            : `<span class="time-badge">${segment.targetDuration} min</span>`;

        segmentEl.innerHTML = `
            <div class="segment-badge"></div>
            <h3>${segment.title} ${timeDisplay}</h3>
            ${contentHtml}
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
    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;

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
            el.style.left = `${initialLeft + dx}px`;
            el.style.top = `${initialTop + dy}px`;
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
                <h3>Select Activity</h3>
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
            <div style="font-size: 0.8rem; opacity: 0.7;">
                ${game.duration ? `⏱ ${game.duration}` : ''}
            </div>
            <p>${game.purpose || ''}</p>
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

window.createGame = (preselectedCategory) => {
    // Remove existing modal if any
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    // Get categories for dropdown
    const categories = window.state.content.categories || [];
    const optionsHtml = categories.map(c =>
        `<option value="${c.title}" ${c.title === preselectedCategory ? 'selected' : ''}>${c.title}</option>`
    ).join('');

    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Create New Game</h3>
                <button onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Category</label>
                    <select id="new-game-category">
                        <option value="" disabled ${!preselectedCategory ? 'selected' : ''}>Select Category...</option>
                        ${optionsHtml}
                    </select>
                </div>
                <div class="form-group">
                    <label>Game Title</label>
                    <input type="text" id="new-game-title" class="editor-textarea" style="height: auto;" placeholder="e.g. King of the Hill">
                </div>
                <div class="form-group">
                    <label>Goals</label>
                    <input type="text" id="new-game-goals" class="editor-textarea" style="height: auto;" placeholder="e.g. Take the back">
                </div>
                <div class="form-group">
                    <label>Purpose</label>
                    <input type="text" id="new-game-purpose" class="editor-textarea" style="height: auto;" placeholder="e.g. Learn control">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="new-game-desc" class="editor-textarea" rows="4" placeholder="Describe the rules..."></textarea>
                </div>
                <div class="editor-controls">
                    <button class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn primary" onclick="submitNewGame()">Create Game</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    // Focus title
    setTimeout(() => document.getElementById('new-game-title').focus(), 100);
};

window.submitNewGame = async () => {
    const category = document.getElementById('new-game-category').value;
    const name = document.getElementById('new-game-title').value;
    const goals = document.getElementById('new-game-goals').value;
    const purpose = document.getElementById('new-game-purpose').value;
    const description = document.getElementById('new-game-desc').value;

    if (!category || !name) {
        alert('Category and Title are required.');
        return;
    }

    try {
        const response = await fetch('/api/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'game',
                name: name,
                category: category,
                goals: goals,
                purpose: purpose,
                description: description
            })
        });

        if (response.ok) {
            // Optimistic Update
            const result = await response.json();
            // Use global regex to replace ALL spaces and slashes
            const newId = (category + '-' + name).toLowerCase().replace(/[\s\/]/g, '-');

            const newGame = {
                id: newId,
                title: name,
                category: category,
                description: description || `Description of ${name}.`,
                path: result.path,
                goals: goals,
                purpose: purpose
            };

            // Update State
            window.state.content.games.push(newGame);

            // Update Category State
            let catObj = window.state.content.categories.find(c => c.title === category);
            if (!catObj) {
                // Should exist if selected from dropdown, but handling edge cases
                catObj = {
                    id: category.toLowerCase().replace(/ /g, "-"),
                    title: category,
                    description: "",
                    games: []
                };
                window.state.content.categories.push(catObj);
            }
            catObj.games.push(newId);

            // Refresh UI
            // Close create modal
            document.querySelector('.modal-overlay').remove();

            if (window.lastModalArgs) {
                // Auto-select the new game in the slot we came from
                const { segmentId, slotIndex } = window.lastModalArgs;
                selectGame(newId, segmentId, slotIndex);
            } else {
                alert('Game created!');
            }

        } else {
            alert('Error creating: ' + await response.text());
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
};

// Init App
init().then(() => {
    // Init Editor after content load
    window.editor = new Editor();
});
