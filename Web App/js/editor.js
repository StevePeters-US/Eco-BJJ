/**
 * Editor Module for Eco-BJJ
 * Handles granular content editing for Games and Theories.
 */

export class Editor {
    constructor() {
        this.activeEditors = new Map(); // Track open editors
    }

    // --- Theory Editing ---

    editConcept() {
        console.log("Editor.editConcept called");
        console.log("selectedConceptId:", window.state.selectedConceptId);
        console.log("openConceptModal defined:", !!window.openConceptModal);

        if (window.openConceptModal && window.state.selectedConceptId) {
            window.openConceptModal(window.state.selectedConceptId);
        } else {
            console.warn("Edit Concept blocked checks failed.");
            alert("Debug: Cannot edit. ID: " + window.state.selectedConceptId);
        }
    }

    editTheory() {
        if (!window.state.selectedTheoryId) return;

        // Redirect to new Modal which supports Delete
        if (window.openConceptModal) {
            window.openConceptModal(window.state.selectedTheoryId);
        } else {
            console.error("openConceptModal not defined");
            // Fallback to legacy editor? 
            // The legacy editor was for content. The new modal is for Metadata/Delete.
            // Requirement was "Edit concept button doesn't work" + "Should have delete".
            // If I just show formatting modal, I lose content editing?
            // User probably wants to be able to DELETE it.
            // If I redirect to modal, can they still edit content?
            // My modal currently only has Name. 
            // I should probably add "Edit Content" button IN the modal?
            // Or keep the "Edit Content" separate?
            // "edit concept button doesn't work" -> The button in UI calls editTheory (line 283).
            // Line 283 says: <button ... onclick="window.editor.editConcept()">.
            // Wait, my `editTheory` is what was responding to that?
            // Line 283 calls `window.editor.editConcept()`. METHOD NAME MISMATCH?
            // `editor.js` defines `editTheory()`. `app.js` HTML calls `window.editor.editConcept()`.
            // THAT IS THE BUG!
        }
    }

    // Create Editor UI


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
        // Redirect to new Modal Editor in app.js
        if (window.openGameModal) {
            window.openGameModal(gameId);
        } else {
            console.error("openGameModal not definitions");
        }
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
