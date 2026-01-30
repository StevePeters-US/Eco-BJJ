/**
 * Utility functions for Eco-BJJ
 */

// Simple markdown parser for description
export function markedParse(text) {
    if (!text) return '';
    return text
        .replace(/^# (.*$)/gim, '<h4>$1</h4>')
        .replace(/^## (.*$)/gim, '<h5>$1</h5>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\n/gim, '<br>');
}
