/**
 * ChatSaver class
 * Utility for saving, loading, and managing chat history using localStorage
 */
class ChatSaver {
    constructor() {
        this.storageKey = 'hatchat_saved_chats';
    }
    
    /**
     * Get all saved chats from localStorage
     * @returns {Array} Array of saved chat objects
     */
    getSavedChats() {
        const savedChats = localStorage.getItem(this.storageKey);
        return savedChats ? JSON.parse(savedChats) : [];
    }
    
    /**
     * Save a chat to localStorage
     * @param {Object} chatData Chat data object
     */
    saveChat(chatData) {
        const savedChats = this.getSavedChats();
        savedChats.push(chatData);
        localStorage.setItem(this.storageKey, JSON.stringify(savedChats));
    }
    
    /**
     * Get a specific chat by index
     * @param {number} index Index of the chat to retrieve
     * @returns {Object|null} Chat data object or null if not found
     */
    getChat(index) {
        const savedChats = this.getSavedChats();
        return savedChats[index] || null;
    }
    
    /**
     * Delete a chat by index
     * @param {number} index Index of the chat to delete
     * @returns {boolean} True if deleted, false if not found
     */
    deleteChat(index) {
        const savedChats = this.getSavedChats();
        if (index < 0 || index >= savedChats.length) {
            return false;
        }
        
        savedChats.splice(index, 1);
        localStorage.setItem(this.storageKey, JSON.stringify(savedChats));
        return true;
    }
    
    /**
     * Delete all saved chats
     */
    deleteAllChats() {
        localStorage.removeItem(this.storageKey);
    }
    
    /**
     * Export all chats as a JSON file
     */
    exportChats() {
        const savedChats = this.getSavedChats();
        const dataStr = JSON.stringify(savedChats, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'hatchat_export_' + new Date().toISOString().slice(0, 10) + '.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }
    
    /**
     * Import chats from a JSON file
     * @param {string} jsonString JSON string containing chats to import
     * @returns {boolean} True if import was successful
     */
    importChats(jsonString) {
        try {
            const chats = JSON.parse(jsonString);
            if (!Array.isArray(chats)) {
                throw new Error('Invalid format');
            }
            
            localStorage.setItem(this.storageKey, jsonString);
            return true;
        } catch (error) {
            console.error('Error importing chats:', error);
            return false;
        }
    }
}
