/**
 * Eco-BJJ Class Creator Logic
 */

import { markedParse } from './utils.js';

// Default Structure
const DEFAULT_STRUCTURE = [
    { id: 'warmups', title: 'Warm Ups', targetDuration: 10, type: 'standing' },
    { id: 'recap', title: 'Recap', targetDuration: 15, type: 'game' },
    { id: 'takedowns', title: 'Takedowns', targetDuration: 15, type: 'takedown' },
    { id: 'discussion', title: 'Concept Discussion', targetDuration: 5, type: 'discussion' },
    { id: 'applications', title: 'Concept Applications', targetDuration: 30, type: 'game' },
    { id: 'review', title: 'Review', targetDuration: 5, type: 'review' },
    { id: 'rolling', title: 'Free Roll', targetDuration: 15, type: 'rolling' }
];

// Data State
let state = {
    content: null,
    selectedConceptId: null,
    classTitle: "",
    segments: {}, // { segmentId: [ { gameId: '...', ... } ] }
    structure: JSON.parse(JSON.stringify(DEFAULT_STRUCTURE)), // Clone default
    expandedCards: new Set(), // Track expanded state: "segmentId-index"
    collapsedSections: new Set() // Track collapsed state: "segmentId" (Default Open)
};

// Expose state globally for event handlers
window.state = state;

async function init() {
    try {
        const response = await fetch('data/content.json?v=' + Date.now()); // Cache bust
        if (!response.ok) throw new Error('Failed to load content');

        state.content = await response.json();
        console.log('Content loaded:', state.content);

        renderConceptSelect(); // Renamed

        // Init Date
        const dateInput = document.getElementById('class-date-input');
        if (dateInput) {
            dateInput.valueAsDate = new Date();
        }

        setupEventListeners();
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Error loading content. Please ensure python http server is running.');
    }
}

function getFormattedTitle() {
    const dateInput = document.getElementById('class-date-input');
    let dateStr = '';
    if (dateInput && dateInput.value) {
        const parts = dateInput.value.split('-');
        if (parts.length === 3) {
            dateStr = ` ${parts[1]}/${parts[2]}/${parts[0].substring(2)}`;
        }
    }
    return `${state.classTitle || 'My Class'}${dateStr}`;
}

function updateAppTitle() {
    const fullTitle = getFormattedTitle();
    document.title = fullTitle;

    // Also update on-page header if generated
    const titleDisplay = document.getElementById('class-title');
    if (titleDisplay) {
        let content = fullTitle;
        const concept = state.content && state.content.concepts ? state.content.concepts.find(t => t.id === state.selectedConceptId) : null;
        if (concept) {
            content += `<div class="concept-subtitle">${concept.title}</div>`;
        }

        // Calculate Global Time
        let globalCurrent = 0;
        let globalTarget = 0;

        if (state.structure) {
            state.structure.forEach(segment => {
                globalTarget += (parseFloat(segment.targetDuration) || 0);

                let segmentDuration = 0;
                // If fixed duration (Discussion, Review, Free Roll, Custom Fixed), "current" is just the target/slider value
                const isFixed = segment.type === 'discussion' || segment.type === 'review' || segment.type === 'rolling' || segment.type === 'fixed';

                if (isFixed) {
                    segmentDuration = (parseFloat(segment.targetDuration) || 0);
                } else {
                    // Start with 0 for games
                    if (state.segments[segment.id]) {
                        state.segments[segment.id].forEach(g => {
                            const gameMeta = state.content.games.find(x => x.id === g.gameId);
                            if (gameMeta) {
                                let rt = parseFloat(gameMeta.duration) || 5;
                                let p = parseInt(gameMeta.players) || 2;
                                let t = gameMeta.type || 'Continuous';
                                if (t === 'Round Switching') segmentDuration += (rt * p);
                                else segmentDuration += rt;
                            } else {
                                segmentDuration += 5;
                            }
                        });
                    }
                }

                globalCurrent += segmentDuration;
            });
        }

        // Format
        // We need formatDuration. It is attached to window but safer to use if available or define helper.
        // It is defined in app.js later. We can rely on hoisting? No, it's assigned to window.
        // Let's use window.formatDuration if available, else simple fallback.
        const format = (v) => window.formatDuration ? window.formatDuration(v) : v + "m";

        const formattedCurrent = format(globalCurrent);
        const formattedTarget = format(globalTarget);

        content += `
            <div style="font-size: 0.6em; color: #4caf50; margin-top: 5px; font-weight: normal;">
                Total Time: ${formattedCurrent} / ${formattedTarget}
            </div>
        `;

        titleDisplay.innerHTML = content;
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
    titleInput.addEventListener('input', (e) => {
        state.classTitle = e.target.value;
        updateAppTitle();
    });
}

const dateInput = document.getElementById('class-date-input');
if (dateInput) {
    dateInput.addEventListener('change', () => {
        updateAppTitle();
    });

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
    // 1. Get Title and Date
    const name = state.classTitle;
    const dateInput = document.getElementById('class-date-input');
    const dateStr = dateInput ? dateInput.value : '';

    if (!name || name.trim() === "") {
        alert("Please enter a Class Title before saving.");
        return;
    }

    // Construct Filename: Title_Date
    const fileName = getFormattedTitle().replace(/[\/\\?%*:|"<>]/g, '-'); // Sanitize slightly

    // 2. Build Data Payload from State
    const classData = {
        title: name,
        date: dateStr,
        conceptId: state.selectedConceptId,
        segments: state.segments, // Maps segmentId -> array of game objects
        structure: state.structure, // Save dynamic structure
        displayState: {
            collapsedSections: Array.from(state.collapsedSections),
            expandedCards: Array.from(state.expandedCards)
        }
    };

    console.log("Saving class:", classData);

    try {
        const response = await fetch('/api/save_class', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: fileName,
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
            try {
                const selectedName = document.getElementById('load-class-select').value;
                console.log("Attempting to load:", selectedName);
                if (selectedName) {
                    // Load it
                    const res = await fetch('/api/load_class', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: selectedName })
                    });

                    if (res.ok) {
                        const result = await res.json();
                        console.log("Load result:", result);
                        const loadedData = result.data;

                        // Restore State
                        state.classTitle = loadedData.title || selectedName;
                        state.selectedConceptId = loadedData.conceptId;
                        state.segments = loadedData.segments || {};
                        state.structure = loadedData.structure || JSON.parse(JSON.stringify(DEFAULT_STRUCTURE));

                        // Restore Display State
                        if (loadedData.displayState) {
                            state.collapsedSections = new Set(loadedData.displayState.collapsedSections || []);
                            state.expandedCards = new Set(loadedData.displayState.expandedCards || []);
                        } else {
                            state.collapsedSections = new Set();
                            state.expandedCards = new Set();
                        }

                        // Update UI
                        const titleInput = document.getElementById('class-title-input');
                        if (titleInput) titleInput.value = state.classTitle;

                        const conceptSelect = document.getElementById('concept-select');
                        if (conceptSelect) conceptSelect.value = state.selectedConceptId;

                        const dateInput = document.getElementById('class-date-input');
                        if (dateInput && loadedData.date) {
                            dateInput.value = loadedData.date;
                        }

                        // Re-render
                        generateClassStructure();

                        document.querySelector('.modal-overlay').remove();
                    } else {
                        const errText = await res.text();
                        console.error("Error loading class:", errText);
                        alert("Error loading class: " + errText);
                    }
                }
            } catch (error) {
                console.error("Exception in load class handler:", error);
                alert("Exception loading class: " + error.message);
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

    // Update Class Header (Title + Date + Concept)
    const titleDisplay = document.getElementById('class-title'); // Fixed ID from class-title-display
    if (titleDisplay) {
        updateAppTitle();
        // let dateStr = '';
        // const dateInput = document.getElementById('class-date-input');
        // if (dateInput && dateInput.value) {
        //     // Format YYYY-MM-DD -> MM/DD/YY
        //     const parts = dateInput.value.split('-');
        //     if (parts.length === 3) {
        //         // parts[0] is year (2026), parts[1] is month, parts[2] is day
        //         const shortYear = parts[0].substring(2);
        //         dateStr = `, ${parts[1]}/${parts[2]}/${shortYear}`;
        //     }
        // }

        // let headerHtml = `${state.classTitle || 'My Class'}${dateStr}`;
        // if (concept) {
        //     headerHtml += `<div class="concept-subtitle">${concept.title}</div>`;
        // }
        // titleDisplay.innerHTML = headerHtml;
    }

    // Render Timeline
    const timeline = document.getElementById('class-timeline');
    timeline.innerHTML = '';

    // Render Timeline Controls
    const controlsHtml = `
        <div class="timeline-controls" style="margin-bottom: 20px; display: flex; justify-content: flex-end;">
            <button class="btn secondary" onclick="window.addSection()">+ Add Section</button>
        </div>
    `;
    // We can append controls at bottom, but let's iterate first

    state.structure.forEach((segment, index) => {
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
                let roundTime = parseFloat(gameMeta.duration);
                if (isNaN(roundTime)) roundTime = 5;
                let players = parseInt(gameMeta.players) || 2;
                let type = gameMeta.type || 'Continuous';

                if (type === 'Round Switching') {
                    // Total = Round Time * Players
                    totalDuration += (roundTime * players);
                } else {
                    // Continuous AND Switch on Win fall here
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
                <details class="game-card" open>
                    <summary class="game-card-summary">
                        <div class="game-header-left">
                           <span class="game-title">${concept.title}</span>
                        </div>
                         <div class="game-card-actions">
                            <button class="icon-btn edit-btn" title="Edit Concept" onclick="window.openConceptModal(window.state.selectedConceptId)">✎</button>
                        </div>
                    </summary>
                    <div class="game-card-content">
                        <div class="theory-content" id="theory-content-display" style="border: none; padding: 0; background: transparent;">
                            ${markedParse(concept.content || concept.description || 'No content available.')}
                            ${imagesHtml}
                        </div>
                    </div>
                </details>
            `;
        } else if (segment.type === 'review') {
            contentHtml = `<p class="segment-note">Review Concepts. Students should discuss what worked for them and what didn't.</p>`;
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
                    let rt = parseFloat(gameMeta.duration);
                    if (isNaN(rt)) rt = 5;
                    let p = parseInt(gameMeta.players) || 2;
                    let t = gameMeta.type || 'Continuous';
                    let intensity = gameMeta.intensity || '';
                    let difficulty = gameMeta.difficulty || '';

                    let totalGameTime = (t === 'Round Switching') ? (rt * p) : rt;

                    if (totalGameTime < 1) {
                        durationTxt = `${Math.round(totalGameTime * 60)}s`;
                    } else {
                        // Remove trailing zeros if integer
                        durationTxt = `${parseFloat(totalGameTime.toFixed(2))}m`;
                    }

                    metaTags = `
                        <span class="meta-tag">⏱ ${durationTxt}</span>
                        <span class="meta-tag">👥 ${p}</span>
                        <span class="meta-tag">${t}</span>
                        ${intensity ? `<span class="meta-tag intensity-${intensity.toLowerCase()}">${intensity}</span>` : ''}
                        <span class="meta-tag difficulty-${(difficulty || 'none').toLowerCase()}">${difficulty || 'None'}</span>
                    `;

                }

                // Build summary line for collapsed view
                const summaryLine = goals ? goals : (purpose ? purpose : 'No description');

                // Escape IDs for onclick handlers (Legacy/Fallback, now using indices)
                const safeGameId = g.gameId.replace(/'/g, "\\'");
                const safeSegmentId = segment.id.replace(/'/g, "\\'");

                // Unique key for expansion state
                const cardKey = `${segment.id}-${index}`;
                const isExpanded = state.expandedCards.has(cardKey);

                // Reordering Helpers
                const isFirst = index === 0;
                const isLast = index === currentGames.length - 1;

                // DYNAMIC VARIANT NAMING LOGIC
                // If it's a variation, construct title: "ParentName (VariationName)"
                let displayTitle = title;
                if (gameMeta && gameMeta.parentId) {
                    const parent = state.content.games.find(p => p.id === gameMeta.parentId);
                    if (parent) {
                        let varName = gameMeta.variationName;
                        if (!varName) {
                            // Fallback: Parse from stored title "Parent (Variation)"
                            const match = title.match(/\(([^)]+)\)$/);
                            if (match) varName = match[1];
                            else varName = 'Variation';
                        }
                        displayTitle = `${parent.title} (${varName})`;
                    }
                }

                return `
                        <details class="game-card" ${isExpanded ? 'open' : ''} ontoggle="window.toggleCard('${cardKey}', this.open)">
                    <summary class="game-card-summary">
                        <div class="game-header-left">
                            <span class="game-title">${displayTitle}</span>
                            <span class="game-meta-inline">${metaTags}</span>
                        </div>
                        <div class="game-card-actions">
                            <button class="icon-btn xs-btn" ${isFirst ? 'disabled style="opacity:0.3"' : ''} onclick="window.handleMoveGame(event, '${segment.id}', ${index}, -1)" title="Move Up">↑</button>
                            <button class="icon-btn xs-btn" ${isLast ? 'disabled style="opacity:0.3"' : ''} onclick="window.handleMoveGame(event, '${segment.id}', ${index}, 1)" title="Move Down">↓</button>
                            <button class="icon-btn" title="Duplicate" onclick="window.handleDuplicateGame(event, '${segment.id}', ${index})">⧉</button>
                            <button class="icon-btn edit-btn" title="Edit Game" onclick="window.handleEditGame(event, '${segment.id}', ${index})">✎</button>
                            <button class="icon-btn remove-btn" title="Remove" onclick="window.handleRemoveGame(event, '${segment.id}', ${index})">×</button>
                        </div>
                    </summary>
                    <div class="game-card-content">
                        ${goals ? `<div class="game-info-row"><strong>Goals:</strong> ${goals}</div>` : ''}
                        ${purpose ? `<div class="game-info-row"><strong>Learning Objectives:</strong> ${purpose}</div>` : ''}
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
                </div >
                `;

            contentHtml = gamesHtml;
        }

        // Determine segment category (Fixed Duration vs Game Container)
        const isFixedDuration = segment.type === 'discussion' || segment.type === 'review' || segment.type === 'rolling' || segment.type === 'fixed';

        // Time Badge Logic
        // Slider value = targetDuration
        // Display = [Current] / [Target]

        let sliderValue = segment.targetDuration;

        // Color logic based on difference from target
        // Yellow if under time (more than 30s under)
        // Green if within 30 seconds of desired time
        // Red if over (more than 30s over)

        let timeColor = '#888';

        const diff = totalDuration - segment.targetDuration;

        if (totalDuration === 0 && !isFixedDuration) {
            timeColor = '#888'; // Grey if empty container
        } else if (isFixedDuration) {
            timeColor = '#4caf50'; // Always Green for fixed
        } else {
            if (diff < -0.5) timeColor = '#fbc02d'; // Yellow (Under > 30s)
            else if (diff > 0.5) timeColor = '#f44336'; // Red (Over > 30s)
            else timeColor = '#4caf50'; // Green (Within 30s)
        }

        const formattedTime = formatDuration(totalDuration); // Current sum of games
        const targetFormatted = formatDuration(segment.targetDuration);

        // Conditional Formatting
        const displayText = isFixedDuration ? targetFormatted : `${formattedTime} / ${targetFormatted}`;
        const onInputScript = isFixedDuration ?
            `document.getElementById('display-${segment.id}').innerText = window.formatDuration(this.value)` :
            `document.getElementById('display-${segment.id}').innerText = '${formattedTime} / ' + window.formatDuration(this.value)`;


        const timeDisplay = `
        <span style="display: inline-flex; align-items: center; margin-left: 10px; gap: 8px;">
            <input type="range"
                min="0.25" max="30" step="0.25"
                value="${sliderValue}"
                style="width: 100px; accent-color: ${timeColor};"
                oninput="${onInputScript}"
                onchange="updateSectionDuration('${segment.id}', this.value)"
                onclick="event.stopPropagation()"
            />
            <span id="display-${segment.id}" 
                  style="color: ${timeColor}; font-family: monospace; font-size: 0.9rem; min-width: 90px; cursor: pointer;"
                  title="Double-click to set time manually"
                  ondblclick="const val = prompt('Enter target duration (min):', '${segment.targetDuration}'); if(val) window.updateSectionDuration('${segment.id}', val); event.stopPropagation();"
            >
                ${displayText}
            </span>
        </span>
        `;


        // Section Controls
        const isFirst = index === 0;
        const isLast = index === state.structure.length - 1;

        const controls = `
            <div class="section-controls" style="display: inline-flex; gap: 5px; margin-left: 10px;" onclick="event.preventDefault(); event.stopPropagation();">
                 <button class="icon-btn" ${isFirst ? 'disabled style="opacity:0.3"' : ''} onclick="window.moveSection(${index}, -1)" title="Move Up">↑</button>
                 <button class="icon-btn" ${isLast ? 'disabled style="opacity:0.3"' : ''} onclick="window.moveSection(${index}, 1)" title="Move Down">↓</button>
                 <button class="icon-btn" onclick="window.deleteSection(${index})" title="Delete Section" style="color: #f44336;">×</button>
            </div>
        `;

        const isOpen = !state.collapsedSections.has(segment.id);

        segmentEl.innerHTML = `
                <details class="section-collapsible" ${isOpen ? 'open' : ''} ontoggle="window.toggleSection('${segment.id}', this.open)">
                <summary class="section-summary">
                    <span class="section-header-content">
                        <span class="section-title" contenteditable="true" 
                            onblur="window.updateSectionTitle(${index}, this.innerText)"
                            onkeydown="if(event.key==='Enter'){this.blur(); event.preventDefault();}"
                            onclick="event.stopPropagation(); event.preventDefault();"
                            style="cursor: text; border-bottom: 1px dashed #666; min-width: 100px; display: inline-block;">${segment.title}</span>
                        ${timeDisplay}
                    </span>
                    ${controls}
                </summary>
                <div class="section-content">
                    ${contentHtml}
                </div>
            </details >
                `;

        timeline.appendChild(segmentEl);
    });

    // Append Add Section Button at the bottom
    const addBtnDiv = document.createElement('div');
    addBtnDiv.className = 'add-section-container';
    addBtnDiv.style.textAlign = 'center';
    addBtnDiv.style.marginTop = '20px';
    addBtnDiv.innerHTML = `<button class="btn secondary" onclick="window.addSection()" style="width: 100%; border: 2px dashed #444; padding: 15px;">+ Add New Section</button>`;
    timeline.appendChild(addBtnDiv);

    setupDragAndDrop();
}

// Section Management Helpers
window.addSection = () => {
    const title = prompt("Enter new section title:", "New Section");
    if (title) {
        // Simple confirm for type
        const isFixed = confirm("Is this a Fixed Duration section (e.g. Discussion, Review)?\n\nOK = Yes (Fixed Time)\nCancel = No (Sum of Games)");

        const newId = 'section-' + Date.now();
        state.structure.push({
            id: newId,
            title: title,
            targetDuration: 10,
            type: isFixed ? 'fixed' : 'game'
        });
        generateClassStructure();
    }
};

window.deleteSection = (index) => {
    if (confirm("Are you sure you want to delete this section? Games within it will be removed from the plan.")) {
        const section = state.structure[index];
        // Clean up segments data
        delete state.segments[section.id];
        // Remove from structure
        state.structure.splice(index, 1);
        generateClassStructure();
    }
};

window.moveSection = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < state.structure.length) {
        const temp = state.structure[index];
        state.structure[index] = state.structure[newIndex];
        state.structure[newIndex] = temp;
        generateClassStructure();
    }
};

window.updateSectionTitle = (index, newTitle) => {
    if (newTitle && newTitle.trim() !== "") {
        state.structure[index].title = newTitle;
        // No need to re-render entire structure if we just update title, 
        // but re-rendering ensures state consistency and is safest.
        // We'll rely on onblur or Enter key to trigger this.
    }
};

// Card State Management
window.toggleCard = (key, isOpen) => {
    if (isOpen) {
        state.expandedCards.add(key);
    } else {
        state.expandedCards.delete(key);
    }
};

window.toggleSection = (id, isOpen) => {
    if (isOpen) {
        state.collapsedSections.delete(id);
    } else {
        state.collapsedSections.add(id);
    }
};

window.handleEditGame = (event, segmentId, index) => {
    event.preventDefault();
    event.stopPropagation();
    // Debug logging
    console.log('handleEditGame called', { segmentId, index });

    if (!state.segments[segmentId]) {
        console.error(`Segment ${segmentId} not found in state`);
        return;
    }

    const gameData = state.segments[segmentId][index];
    console.log('Game Data found:', gameData);

    if (gameData) {
        window.openGameModal(gameData.gameId, null, null, segmentId);
    } else {
        console.error(`Game data at index ${index} in segment ${segmentId} is undefined`);
    }
};

window.handleDuplicateGame = (event, segmentId, index) => {
    event.preventDefault();
    event.stopPropagation();
    const games = state.segments[segmentId];
    if (games && games[index]) {
        // Deep clone
        const newGame = JSON.parse(JSON.stringify(games[index]));
        // Insert after
        games.splice(index + 1, 0, newGame);
        generateClassStructure();
    }
};

window.handleMoveGame = (event, segmentId, index, direction) => {
    event.preventDefault();
    event.stopPropagation();

    const games = state.segments[segmentId];
    if (!games) return;

    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < games.length) {
        // Swap
        const temp = games[index];
        games[index] = games[newIndex];
        games[newIndex] = temp;

        // Also swap expansion states if we want to be fancy, but simple re-render is fine.
        // Actually, if we swap, the indices change, so the "expandedCards" set (which uses index) might get desynced visually vs content.
        // Let's try to swap the keys in expandedCards too for a perfect experience.
        const key1 = `${segmentId}-${index}`;
        const key2 = `${segmentId}-${newIndex}`;
        const has1 = state.expandedCards.has(key1);
        const has2 = state.expandedCards.has(key2);

        if (has1) state.expandedCards.delete(key1);
        if (has2) state.expandedCards.delete(key2);

        if (has1) state.expandedCards.add(key2);
        if (has2) state.expandedCards.add(key1);

        generateClassStructure();
    }
};

window.handleRemoveGame = (event, segmentId, index) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeGame(segmentId, index);
};

// Helper to format minutes (float) to MM:SS
window.formatDuration = (val) => {
    let floatVal = parseFloat(val);
    if (isNaN(floatVal)) return "0:00";
    let minutes = Math.floor(floatVal);
    let seconds = Math.round((floatVal - minutes) * 60);
    if (seconds === 60) {
        minutes += 1;
        seconds = 0;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Handler for manual time update
// Handler for manual time update
window.updateSectionDuration = (segmentId, value) => {
    // Find segment
    const segment = state.structure.find(s => s.id === segmentId);
    if (segment) {
        segment.targetDuration = parseFloat(value);
        generateClassStructure();
    }
};

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
        `<option value="${c.title}" ${c.title === filterCategory ? 'selected' : ''}> ${c.title}</option>`
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
                <div class="modal modal-lg">
            <div class="modal-header">
                <h3>Select Game</h3>
                <div class="modal-actions">
                    <button class="btn-small secondary" onclick="createGame('${filterCategory || ''}', '${segmentId}')">+ New Game</button>
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
        </div >
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
        </div >
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
window.openGameModal = (gameId = null, preselectedCategory = null, templateGame = null, segmentId = null) => {
    console.log('openGameModal called', { gameId, preselectedCategory, segmentId });

    // Remove existing modal
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let game = null;
    let isEdit = false;
    let parentGame = null;

    if (gameId) {
        game = window.state.content.games.find(g => g.id === gameId);
        if (game) {
            isEdit = true;
            if (game.parentId) {
                parentGame = window.state.content.games.find(g => g.id === game.parentId);
            }
        } else {
            console.error(`Game with ID ${gameId} not found in state.content.games`, window.state.content.games.map(g => g.id));
            alert(`Error: Game data for ID "${gameId}" not found. It might have been deleted from the source content.`);
            return;
        }
    } else if (templateGame) {
        // Create Variation
        parentGame = templateGame;
        game = {
            parentId: parentGame.id,
            category: parentGame.category,
            title: parentGame.title + ' (Variation)'
        };
    }

    // Initialize Draft Overrides
    window.draftOverrides = {};
    if (game && parentGame) {
        // Pre-populate draft overrides with current game values if they exist
        ['difficulty', 'intensity', 'goals', 'purpose', 'focus', 'description', 'players', 'duration', 'gameType', 'initiation'].forEach(field => {
            if (game[field] !== undefined && game[field] !== '') {
                // For DOM IDs, we need to map field names to IDs potentially, or just key by ID in toggleField
                // Let's store by field name for simplicity if we canMap? 
                // Actually toggleField uses element ID.
                // Let's just rely on toggleField to save when unchecked. 
                // But wait, if we load an existing variation, we want "draft" to have the value SO THAT if they uncheck and recheck, it's there?
                // No, if they uncheck, we save the CURRENT value to draft.
                // If they recheck, we restore from draft.
                // So we don't need to pre-populate draftOverrides unless we want to support "Uncheck -> Recheck" returning to the *original* variation value immediately.
                // Yes, that is desired.

                // Map field to ID
                let id = `new-game-${field}`;
                if (field === 'description') id = 'new-game-desc';

                window.draftOverrides[id] = game[field];
            }
        });
    }

    // Helper to get value: Child -> Parent -> Default
    const getVal = (field, def = '') => {
        // DYNAMIC TITLE LOGIC FOR VARIATIONS
        if (field === 'title' && parentGame) {
            let varName = 'Variation';

            if (game && game.variationName) {
                varName = game.variationName;
            } else if (game && game.title) {
                // Fallback parse
                const match = game.title.match(/\(([^)]+)\)$/);
                if (match) varName = match[1];
            }
            return `${parentGame.title} (${varName})`;
        }

        // Treat null as inherit (for fields saved as null in variations)
        if (game && game[field] !== undefined && game[field] !== null && game[field] !== '') return game[field];
        if (parentGame && parentGame[field]) return parentGame[field];
        return def;
    };

    // Helper to check if overridden
    const isOverridden = (field) => {
        if (!parentGame) return true; // No parent = always editable
        // Treat null or undefined as NOT overridden
        return (game && game[field] !== undefined && game[field] !== null && game[field] !== '');
    };

    // Helper to render fields with toggle
    const renderField = (label, id, value, type = 'text', rows = 1, opts = [], isParent = false, step = null) => {
        const override = isOverridden(id.replace('new-game-', '').replace('desc', 'description'));
        const fieldName = id.replace('new-game-', '').replace('desc', 'description');

        const toggleHtml = parentGame ? `
            <label class="switch" style="margin-left: 10px; transform: scale(0.8);">
                <input type="checkbox" id="toggle-${fieldName}" ${override ? 'checked' : ''} 
                    onchange="toggleField('${id}', this.checked)">
                <span class="slider round"></span>
            </label>
        ` : '';

        let inputHtml = '';
        const disabled = (parentGame && !override) ? 'disabled' : '';
        const style = disabled ? 'opacity: 0.7; cursor: not-allowed;' : '';

        if (type === 'textarea') {
            inputHtml = `<textarea id="${id}" class="editor-textarea" rows="${rows}" ${disabled} style="${style}" spellcheck="true">${value}</textarea>`;
        } else if (type === 'select') {
            inputHtml = `<select id="${id}" class="editor-textarea" ${disabled} style="${style} height: auto;">
                ${opts.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}
             </select>`;
        } else {
            // Escape double quotes for input value attribute
            const safeValue = String(value).replace(/"/g, '&quot;');
            const stepAttr = step ? `step="${step}"` : '';
            inputHtml = `<input type="${type}" id="${id}" class="editor-textarea" value="${safeValue}" ${disabled} ${stepAttr} style="${style} height: auto;" spellcheck="true">`;
        }

        return `
            <div class="form-group">
                <label style="display: flex; align-items: center;">
                    ${label}
                    ${toggleHtml}
                </label>
                ${inputHtml}
            </div>
        `;
    };

    // Global toggle handler
    window.toggleField = (elemId, checked) => {
        const el = document.getElementById(elemId);
        if (el) {
            el.disabled = !checked;
            el.style.opacity = checked ? '1' : '0.7';
            el.style.cursor = checked ? 'text' : 'not-allowed';

            if (!checked && parentGame) {
                // Save current value to draft before overwriting
                if (!window.draftOverrides) window.draftOverrides = {};
                window.draftOverrides[elemId] = el.value;

                // Restore parent value
                const fieldName = elemId.replace('new-game-', '').replace('desc', 'description');
                let val = parentGame[fieldName] || '';
                if (fieldName === 'difficulty') window.updateDifficultyColor(el);
                if (fieldName === 'intensity') window.updateIntensityColor(el);
                el.value = val;
            } else if (checked && parentGame) {
                // Restore from draft if exists
                if (window.draftOverrides && window.draftOverrides[elemId] !== undefined) {
                    el.value = window.draftOverrides[elemId];
                    const fieldName = elemId.replace('new-game-', '').replace('desc', 'description');
                    if (fieldName === 'difficulty') window.updateDifficultyColor(el);
                    if (fieldName === 'intensity') window.updateIntensityColor(el);
                }
            }
        }
    };

    const categories = window.state.content.categories || [];
    const optionsHtml = categories.map(c =>
        `<option value="${c.title}" ${c.title === (game ? game.category : preselectedCategory) ? 'selected' : ''}>${c.title}</option>`
    ).join('');

    overlay.innerHTML = `
                <div class="modal modal-lg">
            <div class="modal-header">
                <h3>${isEdit ? 'Edit Game' : 'Create New Game'}</h3>
                <button onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <input type="hidden" id="game-edit-id" value="${game ? game.id : ''}">
                <input type="hidden" id="game-parent-id" value="${parentGame ? parentGame.id : ''}">
                <input type="hidden" id="game-segment-id" value="${segmentId || ''}">

                ${renderField('Game Title', 'new-game-title', getVal('title'), 'text', 1, [], false)}

                ${parentGame ? (() => {
            // Extract variation name from title: "Parent Title (Variation)" -> "Variation"
            let varName = 'Variation';
            const currentTitle = getVal('title');
            const parentTitle = parentGame.title;
            if (currentTitle && currentTitle.startsWith(parentTitle) && currentTitle.includes('(')) {
                const match = currentTitle.match(/\(([^)]+)\)$/);
                if (match) varName = match[1];
            }

            return `
                    <div class="form-group">
                        <label>Variation Name</label>
                        <input type="text" id="new-game-variation-name" class="editor-textarea" value="${varName}" style="height: auto;"
                            oninput="window.updateVariationTitle('${parentGame.id}')">
                    </div>
                    `;
        })() : ''}


                 <div class="form-group">
                    <label>Category</label>
                    <select id="new-game-category">
                        <option value="" disabled ${!game && !preselectedCategory ? 'selected' : ''}>Select Category...</option>
                        ${optionsHtml}
                    </select>
                </div>

                <div class="form-row" style="display: flex; gap: 10px;">
                    <div style="flex: 1">
                        ${renderField('Players', 'new-game-players', getVal('players', '2'), 'number')}
                    </div>
                     <div style="flex: 1">
                        ${(() => {
            const dVal = parseFloat(getVal('duration', '3'));
            const mins = Math.floor(dVal);
            const secs = Math.round((dVal - mins) * 60);
            return `
                            <div class="form-group">
                                <label>Round Time</label>
                                <div style="display: flex; gap: 5px; align-items: center;">
                                    <input type="number" id="new-game-duration-mins" class="editor-textarea" value="${mins}" style="height: auto; width: 70px;" min="0" placeholder="Min">
                                    <span>m</span>
                                    <input type="number" id="new-game-duration-secs" class="editor-textarea" value="${secs}" style="height: auto; width: 70px;" min="0" max="60" step="5" placeholder="Sec">
                                    <span>s</span>
                                </div>
                            </div>
                            `;
        })()}
                    </div>
                </div>
                
                 <div class="form-row" style="display: flex; gap: 10px;">
                     <div style="flex: 1">
                         <div class="form-group">
                             <label style="display: flex; align-items: center;">
                                Difficulty
                                ${parentGame ? `<label class="switch" style="margin-left:10px; transform:scale(0.8)"><input type="checkbox" ${isOverridden('difficulty') ? 'checked' : ''} onchange="toggleField('new-game-difficulty', this.checked)"><span class="slider round"></span></label>` : ''}
                             </label>
                             <select id="new-game-difficulty" class="editor-textarea" style="height: auto; ${parentGame && !isOverridden('difficulty') ? 'opacity:0.7;cursor:not-allowed' : ''}" 
                                     onchange="window.updateDifficultyColor(this)" ${parentGame && !isOverridden('difficulty') ? 'disabled' : ''}>
                                 <option value="">None</option>
                                 ${['Beginner', 'Intermediate', 'Advanced'].map(t =>
            `<option value="${t}" ${getVal('difficulty', 'Beginner') === t ? 'selected' : ''}>${t}</option>`
        ).join('')}
                             </select>
                        </div>
                    </div>
                     <div style="flex: 1">
                          <div class="form-group">
                             <label style="display: flex; align-items: center;">
                                Intensity
                                ${parentGame ? `<label class="switch" style="margin-left:10px; transform:scale(0.8)"><input type="checkbox" ${isOverridden('intensity') ? 'checked' : ''} onchange="toggleField('new-game-intensity', this.checked)"><span class="slider round"></span></label>` : ''}
                             </label>
                             <select id="new-game-intensity" class="editor-textarea" style="height: auto; ${parentGame && !isOverridden('intensity') ? 'opacity:0.7;cursor:not-allowed' : ''}" 
                                     onchange="window.updateIntensityColor(this)" ${parentGame && !isOverridden('intensity') ? 'disabled' : ''}>
                                 ${['Flow', 'Cooperative', 'Adversarial'].map(t =>
            `<option value="${t}" ${getVal('intensity') === t ? 'selected' : ''}>${t}</option>`
        ).join('')}
                             </select>
                        </div>
                    </div>
                     <div style="flex: 1">
                         ${renderField('Type', 'new-game-type', getVal('type', 'Continuous'), 'select', 1, ['Continuous', 'Switch on Win', 'Round Switching'])}
                    </div>
                </div>

                ${renderField('Game Initiation Conditions', 'new-game-initiation', getVal('initiation'), 'select', 1, ['Static', 'Inertial', 'Separated'])}
                
                ${renderField('Goals', 'new-game-goals', getVal('goals'), 'textarea', 2)}
                ${renderField('Focus of Attention', 'new-game-focus', getVal('focus'), 'textarea', 2)}
                ${renderField('Description', 'new-game-desc', getVal('description'), 'textarea', 4)}
                ${renderField('Learning Objectives', 'new-game-purpose', getVal('purpose'), 'textarea', 2)}
                <div class="editor-controls" style="justify-content: space-between;">
                    <div style="display: flex; gap: 5px;">
                        ${isEdit ? `<button class="btn remove-btn" onclick="window.deleteGame('${game.id}')" style="background: #d32f2f; color: white;">Delete</button>` : ''}
                        ${isEdit ? `<button class="btn secondary" onclick="window.createVariation('${game.id}', '${segmentId || ''}')" style="background: #1976d2; color: white;">Variation</button>` : ''}
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                        <button class="btn primary" onclick="submitGameForm(${isEdit})">${isEdit ? 'Save Changes' : 'Create Game'}</button>
                    </div>
                </div>
            </div>
        </div>
                `;

    document.body.appendChild(overlay);
    // Init Difficulty Color
    const diffSelect = document.getElementById('new-game-difficulty');
    if (diffSelect) window.updateDifficultyColor(diffSelect);

    // Init Intensity Color
    const intSelect = document.getElementById('new-game-intensity');
    if (intSelect) window.updateIntensityColor(intSelect);

    if (parentGame) {
        // Init Variation Title update if applicable
        // We need to pass parent ID to the function, or just call it if we know context?
        // We can just call it with the ID we have in scope.
        window.updateVariationTitle(parentGame.id);
    }

    if (!isEdit) setTimeout(() => {
        if (document.getElementById('new-game-variation-name')) {
            document.getElementById('new-game-variation-name').focus();
        } else {
            document.getElementById('new-game-title').focus();
        }
    }, 100);
};

window.updateDifficultyColor = (select) => {
    select.classList.remove('difficulty-beginner', 'difficulty-intermediate', 'difficulty-advanced');
    const val = select.value.toLowerCase();
    if (val) {
        select.classList.add(`difficulty-${val}`);
    }
}

window.updateIntensityColor = (select) => {
    select.classList.remove('intensity-flow', 'intensity-cooperative', 'intensity-adversarial');
    const val = select.value.toLowerCase();
    if (val) {
        select.classList.add(`intensity-${val}`);
    }
}

window.updateVariationTitle = (parentId) => {
    const parentGame = window.state.content.games.find(g => g.id === parentId);
    if (!parentGame) return;

    const varNameInput = document.getElementById('new-game-variation-name');
    if (!varNameInput) return;

    const varName = varNameInput.value;
    const titleInput = document.getElementById('new-game-title');
    // Ensure we don't double escape or anything, just simple concatenation
    titleInput.value = parentGame.title + ' (' + varName + ')';
}

// Redirect old createGame calls
window.createGame = (cat, segmentId) => window.openGameModal(null, cat, null, segmentId);

window.createVariation = (gameId, segmentId) => {
    const game = window.state.content.games.find(g => g.id === gameId);
    if (!game) return;
    window.openGameModal(null, game.category, game, segmentId);
};

window.submitGameForm = async (isEdit) => {
    let category = document.getElementById('new-game-category').value;
    const catSelect = document.getElementById('new-game-category');
    if (!category && catSelect.disabled) {
        category = catSelect.options[catSelect.selectedIndex].value;
    }
    const gameParentId = document.getElementById('game-parent-id').value;

    const getFieldVal = (id, fieldName) => {
        const el = document.getElementById(id);
        if (!el) return null;
        if (gameParentId && el.disabled) return null;
        return el.value;
    }

    const name = document.getElementById('new-game-title').value;

    // VARIATION NAME LOGIC
    let variationName = null;
    if (gameParentId) {
        const varNameInput = document.getElementById('new-game-variation-name');
        if (varNameInput) {
            variationName = varNameInput.value;
        } else {
            // Fallback parse if input missing (shouldn't happen in new UI)
            const match = name.match(/\(([^)]+)\)$/);
            if (match) variationName = match[1];
        }
    }

    // Explicitly grab all fields
    const goals = getFieldVal('new-game-goals', 'goals');
    const purpose = getFieldVal('new-game-purpose', 'purpose');
    const focus = getFieldVal('new-game-focus', 'focus');
    const description = getFieldVal('new-game-desc', 'description');
    const players = getFieldVal('new-game-players', 'players');

    // Duration from split fields
    const dMins = parseFloat(document.getElementById('new-game-duration-mins').value) || 0;
    const dSecs = parseFloat(document.getElementById('new-game-duration-secs').value) || 0;
    const duration = dMins + (dSecs / 60);

    const gameType = getFieldVal('new-game-type', 'gameType');
    const intensity = getFieldVal('new-game-intensity', 'intensity');
    const difficulty = getFieldVal('new-game-difficulty', 'difficulty');
    const initiation = getFieldVal('new-game-initiation', 'initiation');

    if (!category || !name) {
        alert('Category and Title are required.');
        return;
    }

    const performSave = async (allowOverwrite) => {
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
                difficulty: difficulty,
                initiation: initiation,
                overwrite: allowOverwrite // Use passed flag
            };

            const response = await fetch('/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 409) {
                if (confirm("A game with this name already exists. Overwrite it?")) {
                    await performSave(true); // Retry with overwrite
                    return;
                } else {
                    return; // Cancelled
                }
            }

            if (response.ok) {
                const result = await response.json();

                // DELETE OLD FILE IF WE ARE MOVING CATEGORIES
                if (isEdit) {
                    const editId = document.getElementById('game-edit-id').value;
                    const originalGame = window.state.content.games.find(g => g.id === editId);
                    if (originalGame && (originalGame.category !== category || originalGame.title !== name)) {
                        try {
                            await fetch('/api/delete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ path: originalGame.path })
                            });
                            console.log("Deleted old file on move:", originalGame.path);
                        } catch (e) {
                            console.error("Failed to delete old file:", e);
                        }
                    }
                }

                const newId = (category + '-' + name).toLowerCase().replace(/[\s\/]/g, '-');

                const gameData = {
                    id: newId,
                    title: name,
                    category: category,
                    description: description,
                    path: result.path,
                    goals: goals,
                    purpose: purpose,
                    focus: focus,
                    players: players,
                    duration: duration,
                    difficulty: difficulty,
                    initiation: initiation,
                    parentId: gameParentId || null,
                    variationName: variationName
                };

                if (isEdit) {
                    const editId = document.getElementById('game-edit-id').value;
                    const idx = window.state.content.games.findIndex(g => g.id === editId);
                    if (idx !== -1) {
                        window.state.content.games[idx] = { ...window.state.content.games[idx], ...gameData };
                    }
                    alert('Game updated!');
                } else {
                    window.state.content.games.push(gameData);
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

                const overlay = document.querySelector('.modal-overlay');
                if (overlay) overlay.remove();

                // Force reload of content to ensure everything is synced
                const contentRes = await fetch('data/content.json?v=' + Date.now());
                state.content = await contentRes.json();

                generateClassStructure();

            } else {
                alert('Error saving: ' + await response.text());
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    // Initial call: Allow overwrite if it's an EDIT mode (implicit), otherwise false
    await performSave(isEdit);
};

// Concept Creation Modal
// Implement deleteGame
window.deleteGame = async (gameId) => {
    if (!confirm("Are you sure you want to delete this game? This cannot be undone.")) return;

    const game = window.state.content.games.find(g => g.id === gameId);
    if (!game) return;

    try {
        const response = await fetch('/api/delete', {
            method: 'POST',
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
// Concept Creation/Edit Modal - MOVED TO BOTTOM (Unified)

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
                <div class="modal modal-lg">
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
                    <textarea id="new-concept-desc" class="editor-textarea" rows="20" placeholder="Describe the concept...">${contentBody}</textarea>
                </div>
                
                <div class="editor-controls" style="justify-content: space-between;">
                     ${isEdit ? `<button class="btn remove-btn" onclick="window.deleteConcept('${concept.id}')" style="background: #d32f2f; color: white;">Delete Concept</button>` : '<div></div>'}
                    <div style="display: flex; gap: 10px;">
                        <button class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                        <button class="btn secondary" onclick="submitConceptForm(${isEdit})">${isEdit ? 'Save Changes' : 'Create Concept'}</button>
                    </div>
                </div>
            </div>
        </div >
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

    const performSave = async (allowOverwrite) => {
        try {
            const response = await fetch('/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'concept',
                    name: name,
                    description: description,
                    overwrite: allowOverwrite
                })
            });

            if (response.status === 409) {
                if (confirm("A concept with this name already exists. Overwrite it?")) {
                    await performSave(true);
                    return;
                } else {
                    return;
                }
            }

            if (response.ok) {
                const overlay = document.querySelector('.modal-overlay');
                if (overlay) overlay.remove();

                // Fetch updated content without reload
                const contentRes = await fetch('data/content.json?v=' + Date.now());
                window.state.content = await contentRes.json();

                // Update Category Dropdown in Game Editor if open
                const catSelect = document.getElementById('new-game-category');
                if (catSelect) {
                    const currentVal = catSelect.value;
                    const newValue = (!isEdit && !currentVal) ? name : currentVal; // Auto-select new concept if creating

                    // Re-render options
                    const categories = window.state.content.categories || [];
                    catSelect.innerHTML = `
                        <option value="" disabled ${!newValue ? 'selected' : ''}>Select Category...</option>
                        ${categories.map(c => `<option value="${c.title}" ${c.title === newValue ? 'selected' : ''}>${c.title}</option>`).join('')}
                     `;
                }

                // Update Main Concept Dropdown (Setup Panel)
                const mainConceptSelect = document.getElementById('concept-select');
                if (mainConceptSelect) {
                    const currentVal = mainConceptSelect.value;
                    // If isEdit, preserve selection. If new, maybe select it? 
                    // Let's just refresh the list and preserve selection.
                    const concepts = window.state.content.concepts || [];
                    mainConceptSelect.innerHTML = `
                        <option value="" disabled ${!currentVal ? 'selected' : ''}>Select a Concept...</option>
                        ${concepts.map(c => `<option value="${c.id}" ${c.id === currentVal ? 'selected' : ''}>${c.title}</option>`).join('')}
                     `;
                }

                alert(isEdit ? 'Concept updated!' : 'Concept created!');
            } else {
                alert('Error creating: ' + await response.text());
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    await performSave(isEdit);
}

// Redirect createConcept
window.createConcept = window.openConceptModal;

// Init App
init().then(() => {
    // Init Editor after content load
    window.editor = new Editor();
});
