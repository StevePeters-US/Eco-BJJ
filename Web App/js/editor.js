/**
 * Editor Module for Eco-BJJ
 * Handles granular content editing for Games and Theories.
 */

export class Editor {
    constructor() {
        this.activeEditors = new Map(); // Track open editors
    }

    // --- Theory Editing ---

    editTheory() {
        if (!window.state.selectedTheoryId) return;
        const theory = window.state.content.theories.find(t => t.id === window.state.selectedTheoryId);
        if (!theory) return;

        const container = document.getElementById('theory-content-display');
        if (!container) return;

        // Check if already editing
        if (this.activeEditors.has('theory')) return;

        // Save original HTML to restore on cancel
        const originalHtml = container.innerHTML;
        this.activeEditors.set('theory', originalHtml);

        // Create Editor UI
        const wrapper = document.createElement('div');
        wrapper.className = 'editor-wrapper';

        const textarea = document.createElement('textarea');
        textarea.className = 'editor-textarea';
        textarea.value = theory.content || '';
        textarea.style.minHeight = '400px';

        const controls = document.createElement('div');
        controls.className = 'editor-controls';
        controls.innerHTML = `
            <button class="btn primary" onclick="window.editor.saveTheory()">Save Concept</button>
            <button class="btn secondary" onclick="window.editor.cancelEdit('theory', 'theory-content-display')">Cancel</button>
        `;

        wrapper.appendChild(textarea);
        wrapper.appendChild(controls);

        container.innerHTML = '';
        container.appendChild(wrapper);
    }

    async saveTheory() {
        const container = document.getElementById('theory-content-display');
        const textarea = container.querySelector('textarea');
        const newContent = textarea.value;

        const theory = window.state.content.theories.find(t => t.id === window.state.selectedTheoryId);

        await this.saveToFile(theory.path, newContent, () => {
            // Update State
            theory.content = newContent;

            // Update UI
            // Re-render discussion content (description + images)
            // Ideally we should re-use app.js rendering logic or just simple parse
            // Let's assume images haven't changed for now, or re-render them if we can access them
            let imagesHtml = '';
            if (theory.images && theory.images.length > 0) {
                imagesHtml = `<div class="theory-images">
                    ${theory.images.map(img => `<img src="${img}" alt="Theory Image" loading="lazy">`).join('')}
                </div>`;
            }

            container.innerHTML = `
                ${window.markedParse(newContent)}
                ${imagesHtml}
            `;

            this.activeEditors.delete('theory');
        });
    }

    // --- Game Editing ---

    editGame(gameId, segmentId, slotIndex) {
        const game = window.state.content.games.find(g => g.id === gameId);
        if (!game) return;

        const containerId = `game-content-${segmentId}-${slotIndex}`;
        const container = document.getElementById(containerId);
        if (!container) return;

        const editorKey = `game-${segmentId}-${slotIndex}`;
        if (this.activeEditors.has(editorKey)) return;

        this.activeEditors.set(editorKey, container.innerHTML);

        // Create Editor
        const wrapper = document.createElement('div');
        wrapper.className = 'editor-wrapper';

        const textarea = document.createElement('textarea');
        textarea.className = 'editor-textarea';
        // We allow editing the 'description' (body of the markdown)
        // If we want to edit goals, we might need separate fields or parse them back?
        // For simplicity now, let's just edit the body 'description'.
        // Wait, the 'game' object has 'description' (from body) and 'goals' (from generic parsing).
        // If we want to edit everything, we should edit the RAW FILE CONTENT?
        // But we don't have the raw full file content in the JSON easily mapable back if it was split?
        // Actually, 'description' in our new parser IS the body.
        textarea.value = game.description || '';
        textarea.style.minHeight = '200px';

        const controls = document.createElement('div');
        controls.className = 'editor-controls';
        controls.innerHTML = `
            <button class="btn primary" onclick="window.editor.saveGame('${gameId}', '${editorKey}', '${containerId}')">Save Game</button>
            <button class="btn secondary" onclick="window.editor.cancelEdit('${editorKey}', '${containerId}')">Cancel</button>
        `;

        wrapper.appendChild(textarea);
        wrapper.appendChild(controls);

        container.innerHTML = '';
        container.appendChild(wrapper);
    }

    async saveGame(gameId, editorKey, containerId) {
        const game = window.state.content.games.find(g => g.id === gameId);
        const container = document.getElementById(containerId);
        const textarea = container.querySelector('textarea');
        const newContent = textarea.value;

        // Note: This saves the BODY. We need to preserve Frontmatter!
        // The server API just overwrites the file. 
        // Logic: We need to reconstruct the file content (Frontmatter + New Body).
        // Or updated server to handle "update body only"?
        // Let's handle it client side? We don't have the frontmatter here.
        // We should fetch the raw file first? 
        // Or assume we only update the body and the server preserves headers?
        // Configuring server.py to handle partial updates is hard.

        // Strategy: We changed the parser to put the Body into 'description'.
        // So we can reconstruct the file if we have the metadata.
        // But we might lose comments or formatting in frontmatter if we generated it.

        // Better: We send the new body, and the SERVER merges it?
        // Let's update server.py to support a "body update" mode?
        // Or simpler: We just fetch the file content here using fetch(), replace the body, and send back.

        try {
            // 1. Read current file to get Frontmatter
            // We can't easily read local file from browser... oh wait, we have a server!
            // But we don't have a GET /file endpoint. 
            // We can rely on the fact that we have the data in `game`. 
            // We can Re-construct the Frontmatter from `game` properties.

            const frontmatter = `---
title: ${game.title}
category: ${game.category}
players: ${game.players || 2}
---

`;
            const fullContent = frontmatter + newContent;

            await this.saveToFile(game.path, fullContent, () => {
                // Update State
                game.description = newContent;

                // Update UI
                // Only update the description part, but our container includes goals...
                // Actually containerId points to 'game-content-...' which contains Goal + Description
                // Let's rebuild it.
                container.innerHTML = `
                    <p><strong>Goal:</strong> ${game.goals || 'N/A'}</p>
                    <div class="game-description">${window.markedParse(newContent)}</div>
                `;

                this.activeEditors.delete(editorKey);
            });

        } catch (e) {
            console.error(e);
            alert("Error constructing save: " + e.message);
        }
    }

    // --- Utilities ---

    cancelEdit(key, containerId) {
        if (this.activeEditors.has(key)) {
            const original = this.activeEditors.get(key);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = original;
            }
            this.activeEditors.delete(key);
        }
    }

    async saveToFile(path, content, onSuccess) {
        try {
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: path,
                    content: content
                })
            });

            if (response.ok) {
                // Success - Execute callback for UI update
                if (onSuccess) onSuccess();
            } else {
                alert("Server Error: " + await response.text());
            }
        } catch (e) {
            alert("Network Error: " + e.message);
        }
    }
}
