// Centralized configuration
// SINGLE SOURCE OF TRUTH: Only update version here!
const APP_CONFIG = {
    version: '1.1.15',
    buildDate: '2025-11-10',

    // Cache settings
    cacheExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
    updateCheckInterval: 8 * 60 * 60 * 1000, // 8 hours

    // API settings
    api: {
        baseURL: 'https://api.inaturalist.org/v1',
        minRequestInterval: 100, // ms between requests
        defaultPerPage: 50,
        requestTimeout: 15000 // 15 seconds
    },

    // UI timing constants
    timing: {
        debounceDelay: 300, // ms for search debouncing
        updateCheckDelay: 5000, // ms delay before first update check
        notificationDuration: 3000, // ms to show notifications
        loadingOverlayDelay: 300, // ms before showing loading overlay
        modalTransition: 300 // ms for modal animations
    },

    // Location settings
    location: {
        defaultRadius: 50, // km
        gpsTimeout: 15000, // ms
        gpsMaxAge: 300000, // 5 minutes
        locationCacheAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    },

    // Performance settings
    performance: {
        maxSpeciesRendered: 50,
        intersectionObserverMargin: '50px',
        virtualScrollBuffer: 10
    }
};

// Make config available globally (both browser and service worker contexts)
if (typeof window !== 'undefined') {
    window.APP_CONFIG = APP_CONFIG;
}

// Export for service worker usage
if (typeof self !== 'undefined' && self.constructor.name === 'ServiceWorkerGlobalScope') {
    self.APP_CONFIG = APP_CONFIG;
}