/**
 * Eco-BJJ Class Creator Logic
 */

// Data State
let state = {
    content: null,
    selectedTheoryId: null,
    classStructure: []
};

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

        renderTheorySelect();
        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Error loading content. Please ensure python http server is running.');
    }
}

function renderTheorySelect() {
    const select = document.getElementById('concept-select');
    if (!state.content.theories) return;

    state.content.theories.forEach(theory => {
        const option = document.createElement('option');
        option.value = theory.id;
        option.textContent = theory.title;
        select.appendChild(option);
    });
}

function setupEventListeners() {
    const select = document.getElementById('concept-select');
    select.addEventListener('change', (e) => {
        state.selectedTheoryId = e.target.value;
        generateClassStructure();
    });

    document.getElementById('print-btn').addEventListener('click', () => {
        window.print();
    });
}

function generateClassStructure() {
    const theory = state.content.theories.find(t => t.id === state.selectedTheoryId);
    if (!theory) return;

    // Show panels
    document.getElementById('preview-panel').classList.remove('hidden');
    document.getElementById('class-meta').classList.remove('hidden');

    // Update Meta
    // Update Meta - Sidebar cleared as per user request
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
            // Inject Theory Content here
            contentHtml = `
                <div class="theory-content">
                    ${markedParse(theory.content || theory.description || 'No content available.')}
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

// Global Game Picker handler
window.openGamePicker = (segmentId, slotIndex) => {
    // Ideally this would be a modal
    // For MVP, let's just prompt or show a crude list
    // A premium app needs a modal. Let's create one dynamically or used a pre-built dialog.

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
                    <div class="category-group">
                        <div class="category-header">
                            ${markedParse(cat.description || `<h3>${cat.title}</h3>`)}
                        </div>
                        <div class="category-games">
                            ${renderGameOptions(catGames, segmentId, slotIndex)}
                        </div>
                    </div>
                    <hr class="category-divider">
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
                <button onclick="this.closest('.modal-overlay').remove()">×</button>
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
                    <button class="remove-btn" onclick="clearSlot('${segmentId}', ${slotIndex})">×</button>
                </div>
                <div class="game-details">
                    <p><strong>Goal:</strong> ${game.goals || 'N/A'}</p>
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

// Auto init
init();
