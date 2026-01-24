/**
 * Eco-BJJ Class Creator Logic
 */

// Data State
let state = {
    content: null,
    selectedConceptId: null, // Renamed
    classStructure: []
};
window.state = state; // Expose for Editor

// Constants based on ClassStructure.md
const CLASS_TEMPLATE = [
    { id: 'standing', title: '1. Standing', duration: '10 min', type: 'standing', count: 1 },
    { id: 'mobility', title: '2. Mobility', duration: '10-15 min', type: 'game', count: 2 },
    { id: 'takedowns', title: '3. Takedowns', duration: '10-15 min', type: 'takedown', count: 1 },
    { id: 'discussion', title: '4. Discussion', duration: '5 min', type: 'discussion', count: 0 },
    { id: 'applications', title: '5. Concept Applications', duration: '25-30 min', type: 'game', count: 4 },
    { id: 'review', title: '6. Review', duration: '5 min', type: 'review', count: 0 },
    { id: 'rolling', title: '7. Free Roll', duration: '15+ min', type: 'rolling', count: 1 }
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

    // Inject Create Concept Button if not present
    const headerParams = document.querySelector('.header-params');
    if (headerParams && !document.getElementById('create-concept-btn')) {
        const createBtn = document.createElement('button');
        createBtn.id = 'create-concept-btn';
        createBtn.className = 'icon-btn';
        createBtn.innerHTML = '+';
        createBtn.title = 'Create New Concept';
        createBtn.style.marginLeft = '10px';
        createBtn.style.border = '1px solid currentColor';
        createBtn.onclick = createConcept;
        // Insert after select
        headerParams.appendChild(createBtn);
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

    CLASS_TEMPLATE.forEach((segment, index) => {
        const segmentEl = document.createElement('div');
        segmentEl.className = 'class-segment';

        let contentHtml = '';

        if (segment.count > 0) {
            // Create slots for games
            for (let i = 0; i < segment.count; i++) {
                contentHtml += `
                    <div class="game-slot" data-segment="${segment.id}" data-index="${i}">
                        <div class="empty-slot-btn" onclick="openGamePicker('${segment.id}', ${i})">
                            + Select ${segment.type === 'game' ? 'Game' : 'Option'}
                        </div>
                    </div>
                `;
            }
        } else if (segment.type === 'discussion') {
            // Inject Concept Content here
            let imagesHtml = '';
            if (concept.images && concept.images.length > 0) {
                imagesHtml = `<div class="theory-images">
                    ${concept.images.map(img => `<img src="${img}" alt="Concept Image" loading="lazy">`).join('')}
                </div>`;
            }

            contentHtml = `
                <div class="section-header-row">
                    <!-- Header is rendered by parent usually, but we want button next to content -->
                    <button class="btn-small secondary edit-theory-btn" onclick="window.editor.editConcept()">✎ Edit Concept</button>
                </div>
                <div class="theory-content" id="theory-content-display">
                    ${markedParse(concept.content || concept.description || 'No content available.')}
                    ${imagesHtml}
                </div>
             `;
        } else {
            contentHtml = `<p class="segment-note">${segment.type === 'review' ? 'Review concepts' : 'Open mat time'}</p>`;
        }

        segmentEl.innerHTML = `
            <div class="segment-badge"></div>
            <h3>${segment.title} <span class="time-badge">${segment.duration}</span></h3>
            ${contentHtml}
        `;

        timeline.appendChild(segmentEl);
    });

    setupDragAndDrop();
}

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
window.openGamePicker = (segmentId, slotIndex) => {
    // Ideally this would be a modal
    // For MVP, let's just prompt or show a crude list
    // A premium app needs a modal. Let's create one dynamically or used a pre-built dialog.

    window.lastModalArgs = { segmentId, slotIndex }; // Store for refresh
    createModal(segmentId, slotIndex);
};

function createModal(segmentId, slotIndex) {
    // Remove existing modal if any
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    // Group games by category if categories exist, otherwise fallback
    let contentHtml = '';

    if (state.content.categories && state.content.categories.length > 0) {
        state.content.categories.forEach(cat => {
            // Find games for this category
            const catGames = state.content.games.filter(g => g.category === cat.title);

            if (catGames.length > 0) {
                contentHtml += `
                    <details class="category-group">
                        <summary class="category-header">
                            <h3>${cat.title}</h3>
                        </summary>
                        <div class="category-games">
                            ${renderGameOptions(catGames, segmentId, slotIndex)}
                        </div>
                    </details>
                `;
            }
        });
    } else {
        // Fallback for flat list
        contentHtml = renderGameOptions(state.content.games, segmentId, slotIndex);
    }

    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>Select Activity</h3>
                <div class="modal-actions">
                    <button class="btn-small secondary" onclick="createGame()">+ New Game</button>
                    <button class="icon-btn close-btn" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
            </div>
            <div class="modal-body">
                ${contentHtml}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
}

function renderGameOptions(games, segmentId, slotIndex) {
    return games.map(game => `
        <div class="game-option" onclick="selectGame('${game.id}', '${segmentId}', ${slotIndex})">
            <h4>${game.title}</h4>
            <p>${game.purpose || ''}</p>
        </div>
    `).join('');
}

window.selectGame = (gameId, segmentId, slotIndex) => {
    const game = state.content.games.find(g => g.id === gameId);
    if (!game) return;

    // Find the slot
    const slot = document.querySelector(`.game-slot[data-segment="${segmentId}"][data-index="${slotIndex}"]`);
    if (slot) {
        slot.innerHTML = `
            <div class="selected-game">
                <div class="game-header">
                    <h4>${game.title}</h4>
                    <div class="actions">
                        <button class="icon-btn edit-btn" title="Edit Game" onclick="window.editor.editGame('${game.id}', '${segmentId}', ${slotIndex})">✎</button>
                        <button class="icon-btn remove-btn" title="Remove" onclick="clearSlot('${segmentId}', ${slotIndex})">×</button>
                    </div>
                </div>
                <div class="game-details" id="game-content-${segmentId}-${slotIndex}">
                    <p><strong>Goal:</strong> ${game.goals || 'N/A'}</p>
                    <div class="game-description">${markedParse(game.description || '')}</div>
                </div>
            </div>
        `;
    }

    // Close modal
    document.querySelector('.modal-overlay').remove();
};

window.clearSlot = (segmentId, slotIndex) => {
    const slot = document.querySelector(`.game-slot[data-segment="${segmentId}"][data-index="${slotIndex}"]`);
    if (slot) {
        // Reset to empty state
        // Get segment info to restore correct label
        const segment = CLASS_TEMPLATE.find(s => s.id === segmentId);
        const typeLabel = segment.type === 'game' ? 'Game' : 'Option';

        slot.innerHTML = `
            <div class="empty-slot-btn" onclick="openGamePicker('${segmentId}', ${slotIndex})">
                + Select ${typeLabel}
            </div>
         `;
    }
}

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
            const newId = (category + '-' + name).toLowerCase().replace(' ', '-').replace('/', '-');

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
                    id: category.toLowerCase().replace(" ", "-"),
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

            // Allow time for modal to close then refresh the picker if it was open...
            // Actually, wait. createModal is the Picker. We just replaced it with the Create Modal.
            // So the Picker is GONE.
            // We need to re-open the Picker using lastModalArgs.

            if (window.lastModalArgs) {
                // Re-open picker
                createModal(window.lastModalArgs.segmentId, window.lastModalArgs.slotIndex);
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
