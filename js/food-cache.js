// Food Search Cache Service
// Uses IndexedDB to cache API search results for faster retrieval
// Cache expires after 30 days, max size ~100MB

const DB_NAME = 'meal-e-food-cache';
const DB_VERSION = 1;
const STORE_NAME = 'search-results';
const CACHE_EXPIRY_DAYS = 30;
const MAX_CACHE_SIZE_MB = 100;
const MAX_CACHE_SIZE_BYTES = MAX_CACHE_SIZE_MB * 1024 * 1024;

let db = null;

/**
 * Initialize IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('IndexedDB opened successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            // Create object store if it doesn't exist
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                objectStore.createIndex('source', 'source', { unique: false });
                console.log('Created object store:', STORE_NAME);
            }
        };
    });
}

/**
 * Normalize query for cache key (lowercase, trimmed)
 * @param {string} query - Search query
 * @param {string} source - API source ('usda' or 'openfoodfacts')
 * @param {number} maxResults - Maximum results
 * @returns {string} Cache key
 */
function getCacheKey(query, source, maxResults = 10) {
    const normalized = query.toLowerCase().trim();
    return `${source}:${normalized}:${maxResults}`;
}

/**
 * Check if cache entry is expired
 * @param {number} timestamp - Entry timestamp
 * @returns {boolean} True if expired
 */
function isExpired(timestamp) {
    const expiryTime = timestamp + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    return Date.now() > expiryTime;
}

/**
 * Get cached search results
 * @param {string} query - Search query
 * @param {string} source - API source ('usda' or 'openfoodfacts')
 * @param {number} maxResults - Maximum results
 * @returns {Promise<Array|null>} Cached results or null if not found/expired
 */
export async function getCachedResults(query, source, maxResults = 10) {
    try {
        const database = await initDB();
        const key = getCacheKey(query, source, maxResults);
        
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                
                if (!result) {
                    console.log('Cache miss:', key);
                    resolve(null);
                    return;
                }

                // Check if expired
                if (isExpired(result.timestamp)) {
                    console.log('Cache expired:', key);
                    // Delete expired entry
                    deleteCachedResult(key).catch(console.error);
                    resolve(null);
                    return;
                }

                console.log('Cache hit:', key, 'age:', Math.round((Date.now() - result.timestamp) / (1000 * 60 * 60)), 'hours');
                resolve(result.data);
            };

            request.onerror = () => {
                console.error('Error reading from cache:', request.error);
                resolve(null); // Return null on error, don't block the app
            };
        });
    } catch (error) {
        console.error('Error getting cached results:', error);
        return null; // Return null on error, don't block the app
    }
}

/**
 * Store search results in cache
 * @param {string} query - Search query
 * @param {string} source - API source ('usda' or 'openfoodfacts')
 * @param {Array} results - Search results to cache
 * @param {number} maxResults - Maximum results
 * @returns {Promise<void>}
 */
export async function setCachedResults(query, source, results, maxResults = 10) {
    try {
        // Don't cache empty results
        if (!results || results.length === 0) {
            return;
        }

        const database = await initDB();
        const key = getCacheKey(query, source, maxResults);
        
        const cacheEntry = {
            key: key,
            query: query.toLowerCase().trim(),
            source: source,
            data: results,
            timestamp: Date.now(),
            size: JSON.stringify(results).length
        };

        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(cacheEntry);

            request.onsuccess = async () => {
                console.log('Cached results:', key, 'size:', Math.round(cacheEntry.size / 1024), 'KB');
                
                // Check cache size and clean up if needed
                await cleanupCacheIfNeeded();
                resolve();
            };

            request.onerror = () => {
                console.error('Error writing to cache:', request.error);
                resolve(); // Don't reject, caching failure shouldn't break the app
            };
        });
    } catch (error) {
        console.error('Error setting cached results:', error);
        // Don't throw, caching failure shouldn't break the app
    }
}

/**
 * Delete a specific cached result
 * @param {string} key - Cache key
 * @returns {Promise<void>}
 */
async function deleteCachedResult(key) {
    try {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onsuccess = () => {
                console.log('Deleted cache entry:', key);
                resolve();
            };

            request.onerror = () => {
                console.error('Error deleting cache entry:', request.error);
                resolve(); // Don't reject
            };
        });
    } catch (error) {
        console.error('Error deleting cached result:', error);
    }
}

/**
 * Get total cache size and entry count
 * @returns {Promise<{size: number, count: number}>}
 */
async function getCacheStats() {
    try {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const entries = request.result;
                const totalSize = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
                resolve({
                    size: totalSize,
                    count: entries.length
                });
            };

            request.onerror = () => {
                console.error('Error getting cache stats:', request.error);
                resolve({ size: 0, count: 0 });
            };
        });
    } catch (error) {
        console.error('Error getting cache stats:', error);
        return { size: 0, count: 0 };
    }
}

/**
 * Clean up expired entries and enforce size limit
 * @returns {Promise<void>}
 */
async function cleanupCacheIfNeeded() {
    try {
        const database = await initDB();
        const stats = await getCacheStats();
        
        // Check if we need to clean up
        const needsCleanup = stats.size > MAX_CACHE_SIZE_BYTES;
        const now = Date.now();
        
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = async () => {
                const entries = request.result;
                
                // First, remove expired entries
                const validEntries = entries.filter(entry => !isExpired(entry.timestamp));
                const expiredCount = entries.length - validEntries.length;
                
                if (expiredCount > 0) {
                    console.log('Removing', expiredCount, 'expired cache entries');
                    for (const entry of entries) {
                        if (isExpired(entry.timestamp)) {
                            await deleteCachedResult(entry.key);
                        }
                    }
                }

                // If still over size limit, remove oldest entries
                if (needsCleanup) {
                    const sortedEntries = validEntries
                        .map(entry => ({ ...entry, size: entry.size || JSON.stringify(entry.data).length }))
                        .sort((a, b) => a.timestamp - b.timestamp); // Oldest first
                    
                    let currentSize = sortedEntries.reduce((sum, entry) => sum + entry.size, 0);
                    let removedCount = 0;
                    
                    for (const entry of sortedEntries) {
                        if (currentSize <= MAX_CACHE_SIZE_BYTES * 0.8) { // Keep at 80% of max
                            break;
                        }
                        await deleteCachedResult(entry.key);
                        currentSize -= entry.size;
                        removedCount++;
                    }
                    
                    if (removedCount > 0) {
                        console.log('Removed', removedCount, 'oldest cache entries to stay under size limit');
                    }
                }
                
                resolve();
            };

            request.onerror = () => {
                console.error('Error during cache cleanup:', request.error);
                resolve(); // Don't reject
            };
        });
    } catch (error) {
        console.error('Error cleaning up cache:', error);
    }
}

/**
 * Clear all cached results
 * @returns {Promise<void>}
 */
export async function clearCache() {
    try {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('Cache cleared');
                resolve();
            };

            request.onerror = () => {
                console.error('Error clearing cache:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Error clearing cache:', error);
        throw error;
    }
}

/**
 * Get cache statistics for debugging
 * @returns {Promise<Object>}
 */
export async function getCacheInfo() {
    try {
        const stats = await getCacheStats();
        return {
            sizeMB: Math.round((stats.size / (1024 * 1024)) * 100) / 100,
            count: stats.count,
            maxSizeMB: MAX_CACHE_SIZE_MB,
            expiryDays: CACHE_EXPIRY_DAYS
        };
    } catch (error) {
        console.error('Error getting cache info:', error);
        return { sizeMB: 0, count: 0, maxSizeMB: MAX_CACHE_SIZE_MB, expiryDays: CACHE_EXPIRY_DAYS };
    }
}

// Initialize DB on module load
initDB().catch(error => {
    console.error('Failed to initialize cache database:', error);
});

