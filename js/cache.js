class CacheService {
    constructor() {
        this.memoryCache = new Map();
        this.db = null;
        this.dbName = 'BiodiversityCache';
        this.dbVersion = 2;
        this.cacheExpiry = window.APP_CONFIG.cacheExpiry;
        this.initIndexedDB();
    }

    async initIndexedDB() {
        try {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('IndexedDB failed to open');
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ CacheService: IndexedDB initialized');
                this.loadFromIndexedDB();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('speciesCache')) {
                    const store = db.createObjectStore('speciesCache', { keyPath: 'cacheKey' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('locationCache')) {
                    const store = db.createObjectStore('locationCache', { keyPath: 'locationKey' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        } catch (error) {
            console.error('CacheService: IndexedDB initialization failed:', error);
        }
    }

    async loadFromIndexedDB() {
        if (!this.db) return;
        
        try {
            const transaction = this.db.transaction(['speciesCache'], 'readonly');
            const store = transaction.objectStore('speciesCache');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const records = request.result;
                const now = Date.now();
                
                records.forEach(record => {
                    if (now - record.timestamp < this.cacheExpiry) {
                        this.memoryCache.set(record.cacheKey, {
                            data: record.data,
                            timestamp: record.timestamp
                        });
                    }
                });
                
                console.log(`📦 CacheService: Loaded ${this.memoryCache.size} cache entries`);
                this.cleanupExpired();
            };
        } catch (error) {
            console.error('CacheService: Failed to load from IndexedDB:', error);
        }
    }

    async set(key, data, storeName = 'speciesCache') {
        const cacheEntry = {
            data: data,
            timestamp: Date.now()
        };
        
        // Save to memory cache
        this.memoryCache.set(key, cacheEntry);
        
        // Save to IndexedDB
        if (this.db) {
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                
                const record = {
                    cacheKey: key,
                    data: data,
                    timestamp: cacheEntry.timestamp
                };
                
                store.put(record);
            } catch (error) {
                console.error('CacheService: Failed to save to IndexedDB:', error);
            }
        }
        
        return cacheEntry;
    }

    get(key) {
        const cached = this.memoryCache.get(key);
        
        if (!cached) return null;
        
        // Check if cache is still valid
        const age = Date.now() - cached.timestamp;
        if (age > this.cacheExpiry) {
            this.memoryCache.delete(key);
            this.deleteFromIndexedDB(key);
            return null;
        }
        
        return cached.data;
    }

    has(key) {
        const data = this.get(key);
        return data !== null;
    }

    delete(key) {
        this.memoryCache.delete(key);
        this.deleteFromIndexedDB(key);
    }

    async deleteFromIndexedDB(key, storeName = 'speciesCache') {
        if (!this.db) return;
        
        try {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            store.delete(key);
        } catch (error) {
            console.error('CacheService: Failed to delete from IndexedDB:', error);
        }
    }

    clear(storeName = null) {
        if (storeName) {
            // Clear specific store
            const keysToDelete = [];
            this.memoryCache.forEach((value, key) => {
                if (key.includes(storeName)) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => this.delete(key));
        } else {
            // Clear all
            this.memoryCache.clear();
            this.clearIndexedDB();
        }
    }

    async clearIndexedDB() {
        if (!this.db) return;
        
        try {
            const storeNames = ['speciesCache', 'locationCache'];
            const availableStores = storeNames.filter(name => 
                this.db.objectStoreNames.contains(name)
            );
            
            if (availableStores.length === 0) return;
            
            const transaction = this.db.transaction(availableStores, 'readwrite');
            
            availableStores.forEach(storeName => {
                const store = transaction.objectStore(storeName);
                store.clear();
            });
        } catch (error) {
            console.error('CacheService: Failed to clear IndexedDB:', error);
        }
    }

    async cleanupExpired() {
        if (!this.db) return;
        
        const now = Date.now();
        const cutoff = now - this.cacheExpiry;
        
        // Clean memory cache
        const keysToDelete = [];
        this.memoryCache.forEach((value, key) => {
            if (value.timestamp < cutoff) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => this.memoryCache.delete(key));
        
        // Clean IndexedDB - only access stores that exist
        try {
            const storeNames = ['speciesCache', 'locationCache'];
            const availableStores = storeNames.filter(name => 
                this.db.objectStoreNames.contains(name)
            );
            
            if (availableStores.length === 0) return;
            
            const transaction = this.db.transaction(availableStores, 'readwrite');
            
            availableStores.forEach(storeName => {
                const store = transaction.objectStore(storeName);
                const index = store.index('timestamp');
                const range = IDBKeyRange.upperBound(cutoff);
                const request = index.openCursor(range);
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        store.delete(cursor.primaryKey);
                        cursor.continue();
                    }
                };
            });
        } catch (error) {
            console.error('CacheService: Failed to cleanup IndexedDB:', error);
        }
    }

    getCacheKey(location, filter) {
        if (!location) return null;
        return `${JSON.stringify(location)}_${filter}`;
    }

    markLocationCached(location) {
        if (!location) return;
        
        const cacheKey = `cached_location_${location.lat}_${location.lng}_${location.radius}`;
        const cacheData = {
            timestamp: Date.now(),
            location: location,
            cached: true
        };
        
        try {
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('CacheService: Failed to mark location as cached:', error);
        }
    }

    isLocationCached(location) {
        if (!location) return false;
        
        const cacheKey = `cached_location_${location.lat}_${location.lng}_${location.radius}`;
        
        try {
            const cacheData = localStorage.getItem(cacheKey);
            if (cacheData) {
                const parsed = JSON.parse(cacheData);
                const cacheAge = Date.now() - parsed.timestamp;
                return cacheAge < this.cacheExpiry;
            }
        } catch (error) {
            console.warn('CacheService: Failed to check cache status:', error);
        }
        
        return false;
    }

    getStats() {
        return {
            memoryCacheSize: this.memoryCache.size,
            cacheExpiry: this.cacheExpiry,
            dbConnected: this.db !== null
        };
    }
}

// Initialize cache service
window.cacheService = new CacheService();