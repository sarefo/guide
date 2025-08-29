// Centralized configuration
// When updating version, only change it here and in sw.js
const APP_CONFIG = {
    version: '1.1.7',
    buildDate: '2025-08-29 17:58',
    cacheExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
    updateCheckInterval: 8 * 60 * 60 * 1000, // 8 hours
    api: {
        baseURL: 'https://api.inaturalist.org/v1',
        minRequestInterval: 100, // ms between requests
        defaultPerPage: 50
    }
};

// Make config available globally
window.APP_CONFIG = APP_CONFIG;