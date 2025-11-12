/**
 * Global namespace for the Biodiversity PWA
 * Reduces global pollution by centralizing all app components in one namespace
 *
 * Backwards compatibility: Direct window properties (window.api, window.app, etc.)
 * are maintained via getters that proxy to the App namespace
 */

// Initialize the global App namespace
window.App = window.App || {};

/**
 * Setup backwards-compatible accessors for legacy code
 * This allows old code using window.api to still work while we transition to App.api
 */
(function setupBackwardsCompatibility() {
    const legacyGlobals = [
        'api',
        'app',
        'i18n',
        'speciesManager',
        'locationManager',
        'modalManager',
        'cacheService',
        'qrManager',
        'notificationService',
        'updateService'
    ];

    legacyGlobals.forEach(globalName => {
        // Only create the proxy if it doesn't already exist as a direct assignment
        if (!window.hasOwnProperty(globalName)) {
            Object.defineProperty(window, globalName, {
                get() {
                    return window.App[globalName];
                },
                set(value) {
                    window.App[globalName] = value;
                },
                configurable: true
            });
        }
    });
})();

// Log namespace initialization in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🔧 App namespace initialized with backwards compatibility');
}
