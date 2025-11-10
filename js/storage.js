/**
 * Storage utility with IndexedDB fallback
 * Tries localStorage first, falls back to IndexedDB if quota exceeded or unavailable
 */
class StorageManager {
    constructor() {
        this.dbName = 'biodiversity-storage';
        this.storeName = 'keyval';
        this.dbVersion = 1;
        this.db = null;
        this.useIndexedDB = false;
    }

    /**
     * Initialize IndexedDB connection for fallback
     * @returns {Promise<void>}
     */
    async init() {
        // Try to open IndexedDB for fallback
        try {
            this.db = await this.openDB();
        } catch (error) {
            console.warn('IndexedDB initialization failed:', error);
        }
    }

    /**
     * Open IndexedDB database
     * @returns {Promise<IDBDatabase>} The opened database
     */
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    }

    /**
     * Store a value with automatic fallback to IndexedDB if localStorage fails
     * @param {string} key - The key to store the value under
     * @param {string} value - The value to store
     * @returns {Promise<void>}
     */
    async setItem(key, value) {
        // Try localStorage first
        if (!this.useIndexedDB) {
            try {
                localStorage.setItem(key, value);
                return;
            } catch (error) {
                // Quota exceeded or localStorage unavailable
                console.warn('localStorage.setItem failed, falling back to IndexedDB:', error);
                this.useIndexedDB = true;
            }
        }

        // Fallback to IndexedDB
        if (!this.db) {
            await this.init();
        }

        if (!this.db) {
            throw new Error('Both localStorage and IndexedDB are unavailable');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(value, key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Retrieve a value with automatic fallback to IndexedDB if localStorage fails
     * @param {string} key - The key to retrieve
     * @returns {Promise<string|null>} The stored value or null if not found
     */
    async getItem(key) {
        // Try localStorage first
        if (!this.useIndexedDB) {
            try {
                return localStorage.getItem(key);
            } catch (error) {
                console.warn('localStorage.getItem failed, falling back to IndexedDB:', error);
                this.useIndexedDB = true;
            }
        }

        // Fallback to IndexedDB
        if (!this.db) {
            await this.init();
        }

        if (!this.db) {
            return null;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove a value with automatic fallback to IndexedDB if localStorage fails
     * @param {string} key - The key to remove
     * @returns {Promise<void>}
     */
    async removeItem(key) {
        // Try localStorage first
        if (!this.useIndexedDB) {
            try {
                localStorage.removeItem(key);
                return;
            } catch (error) {
                console.warn('localStorage.removeItem failed, falling back to IndexedDB:', error);
                this.useIndexedDB = true;
            }
        }

        // Fallback to IndexedDB
        if (!this.db) {
            await this.init();
        }

        if (!this.db) {
            throw new Error('Both localStorage and IndexedDB are unavailable');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.storageManager = new StorageManager();
    // Initialize asynchronously
    window.storageManager.init().catch(err => {
        console.warn('StorageManager initialization failed:', err);
    });
}
