class BiodiversityApp {
    constructor() {
        this.version = '1.0.3'; // UPDATE THIS VERSION IN sw.js TOO!
        this.initialized = false;
        this.updateCheckInterval = null;
        this.lastUpdateCheck = null;
        this.updateAvailable = false;
        this.init();
    }

    async init() {
        if (this.initialized) return;

        console.log(`🌿 Biodiversity Explorer v${this.version} initializing...`);

        try {
            await this.waitForDependencies();
            this.setupErrorHandling();
            this.setupNetworkMonitoring();
            this.initializeApp();
            this.initialized = true;

            console.log('✅ App initialized successfully');
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.showInitializationError();
        }
    }

    async waitForDependencies() {
        const maxWait = 5000; // 5 seconds
        const checkInterval = 100;
        let waited = 0;

        while (waited < maxWait) {
            if (window.api && window.locationManager && window.speciesManager) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }

        throw new Error('Required dependencies not loaded');
    }

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleError(event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason);
        });
    }

    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            console.log('📶 Network connection restored');
            this.showNetworkStatus('online');
            this.retryFailedOperations();
        });

        window.addEventListener('offline', () => {
            console.log('📵 Network connection lost');
            this.showNetworkStatus('offline');
        });
    }

    initializeApp() {
        this.setupAppEventListeners();
        this.initializeSharing();
        this.setupServiceWorkerListeners();
        this.checkForUpdates();
        this.startPeriodicUpdateChecks();

        if (window.locationManager) {
            console.log('🌍 Location manager ready');
        }

        if (window.speciesManager) {
            console.log('🐦 Species manager ready');
        }
    }

    setupAppEventListeners() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onAppHidden();
            } else {
                this.onAppVisible();
                // Check for updates when app becomes visible
                this.checkForUpdates();
            }
        });

        window.addEventListener('beforeunload', () => {
            this.onAppUnload();
        });

        const refreshBtn = document.querySelector('[data-action="refresh"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }
    }

    setupServiceWorkerListeners() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event.data);
            });
        }
    }

    handleServiceWorkerMessage(data) {
        console.log('SW message received:', data);

        switch (data.type) {
            case 'SW_UPDATE_AVAILABLE':
                console.log('🔄 Service Worker update available');
                this.updateAvailable = true;
                this.showUpdateNotification();
                break;
            case 'SW_UPDATE_COMPLETE':
                console.log('✅ Service Worker update complete');
                this.hideUpdateNotification();
                break;
        }
    }

    startPeriodicUpdateChecks() {
        // Check for updates every hour
        this.updateCheckInterval = setInterval(() => {
            if (!document.hidden) {
                this.checkForUpdates();
            }
        }, 60 * 60 * 1000); // 1 hour
    }

    initializeSharing() {
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                this.shareLocation();
            });
        }
    }


    async shareLocation() {
        const currentUrl = window.location.href;
        const locationName = window.locationManager?.getCurrentLocation()?.name || 'Unknown Location';
        const shareText = `Check out the biodiversity in ${locationName}!`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Biodiversity Explorer',
                    text: shareText,
                    url: currentUrl
                });
                console.log('📤 Shared successfully via Web Share API');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Share failed:', error);
                    this.fallbackShare(currentUrl);
                }
            }
        } else {
            this.fallbackShare(currentUrl);
        }
    }

    fallbackShare(url) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                this.showNotification('URL copied to clipboard!');
            }).catch(() => {
                this.showShareModal(url);
            });
        } else {
            this.showShareModal(url);
        }
    }

    showShareModal(url) {
        const modal = document.getElementById('share-modal');
        const shareUrl = document.getElementById('share-url');
        const copyBtn = document.getElementById('copy-url');

        if (modal && shareUrl) {
            shareUrl.textContent = url;

            // Use unified modal manager
            if (window.modalManager) {
                window.modalManager.openModal(modal);
            } else {
                modal.style.display = 'flex';
            }

            if (copyBtn) {
                copyBtn.onclick = () => {
                    this.copyToClipboard(url);
                };
            }
        }
    }


    async copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            this.showNotification('URL copied to clipboard!');
        } catch (error) {
            console.error('Copy failed:', error);
            this.showNotification('Copy failed. Please copy manually.');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    showNetworkStatus(status) {
        const statusMessage = status === 'online' ?
            'Connection restored' :
            'You are offline';

        const statusType = status === 'online' ? 'success' : 'warning';
        this.showNotification(statusMessage, statusType);
    }

    async retryFailedOperations() {
        if (window.speciesManager && !window.speciesManager.currentSpecies.length) {
            console.log('🔄 Retrying species data load...');
            await window.speciesManager.loadSpecies();
        }
    }

    async refreshData() {
        console.log('🔄 Refreshing data...');

        try {
            if (window.speciesManager) {
                await window.speciesManager.loadSpecies();
            }

            // Data refreshed silently
        } catch (error) {
            console.error('Refresh failed:', error);
            this.showNotification('Refresh failed. Please try again.', 'error');
        }
    }

    handleError(error) {
        console.error('App error:', error);

        if (navigator.onLine) {
            this.showNotification('An error occurred. Please refresh the page.', 'error');
        } else {
            this.showNotification('You appear to be offline.', 'warning');
        }
    }

    showInitializationError() {
        const appEl = document.getElementById('app');
        if (appEl) {
            appEl.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 2rem; text-align: center;">
                    <h1 style="color: #d32f2f; margin-bottom: 1rem;">App Failed to Load</h1>
                    <p style="color: #666; margin-bottom: 2rem;">There was a problem starting the application. Please refresh the page.</p>
                    <button onclick="window.location.reload()" style="background: #2E7D32; color: white; border: none; padding: 1rem 2rem; border-radius: 0.5rem; cursor: pointer;">
                        Reload App
                    </button>
                </div>
            `;
        }
    }

    onAppVisible() {
        if (this.initialized && navigator.onLine) {
            const timeSinceLastUpdate = Date.now() - (this.lastUpdateTime || 0);
            const updateInterval = 5 * 60 * 1000; // 5 minutes

            if (timeSinceLastUpdate > updateInterval) {
                this.refreshData();
            }
        }
    }

    onAppHidden() {
        this.lastUpdateTime = Date.now();
    }

    onAppUnload() {
        console.log('👋 App unloading');

        if (window.api) {
            const stats = window.api.getRequestStats();
            console.log('📊 API request stats:', stats);
        }
    }

    async checkForUpdates() {
        if ('serviceWorker' in navigator) {
            try {
                this.lastUpdateCheck = new Date();
                const registration = await navigator.serviceWorker.getRegistration();

                if (registration) {
                    // Force update check
                    await registration.update();

                    // Listen for new worker
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    this.updateAvailable = true;
                                    this.showUpdateNotification();
                                }
                            });
                        }
                    });
                }

            } catch (error) {
                console.error('Update check failed:', error);
            }
        }
    }

    async manualUpdateCheck() {
        this.showUpdateCheckingIndicator();

        try {
            await this.checkForUpdates();

            setTimeout(() => {
                this.hideUpdateCheckingIndicator();
                if (!this.updateAvailable) {
                    this.showNoUpdateMessage();
                }
            }, 1000);
        } catch (error) {
            this.hideUpdateCheckingIndicator();
            this.showUpdateError();
        }
    }

    showUpdateNotification() {
        this.hideUpdateNotification(); // Remove any existing notification

        const updateNotification = document.createElement('div');
        updateNotification.id = 'update-notification';
        updateNotification.innerHTML = `
            <div class="update-notification">
                <div class="update-message">
                    <strong data-i18n="update.available">New version available!</strong>
                    <br><small data-i18n="update.description">Click Update to reload with the latest features</small>
                </div>
                <button id="update-btn" class="update-btn-primary" data-i18n="update.button">Update Now</button>
                <button id="dismiss-update" class="update-btn-dismiss" aria-label="Dismiss">&times;</button>
            </div>
        `;

        document.body.appendChild(updateNotification);

        // Apply i18n to the dynamically created content
        if (window.i18n) {
            window.i18n.translatePage();
        }

        // Add event listeners
        document.getElementById('update-btn').addEventListener('click', () => {
            this.applyUpdate();
        });

        document.getElementById('dismiss-update').addEventListener('click', () => {
            this.hideUpdateNotification();
        });

    }

    hideUpdateNotification() {
        const notification = document.getElementById('update-notification');
        if (notification) {
            notification.remove();
        }
    }

    async applyUpdate() {
        try {
            // Show updating indicator
            this.showUpdatingIndicator();
            
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && registration.waiting) {
                // Tell the waiting service worker to take over
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });

                // Listen for the activation and reload
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('🔄 Service worker updated, reloading...');
                    window.location.reload();
                });
                
                // Fallback: reload after timeout if controllerchange doesn't fire
                setTimeout(() => {
                    console.log('🔄 Fallback reload after update');
                    window.location.reload();
                }, 3000);
            } else {
                // No waiting worker, just reload
                console.log('🔄 No waiting worker, reloading...');
                window.location.reload();
            }
        } catch (error) {
            console.error('Update application failed:', error);
            window.location.reload();
        }
    }

    showUpdatingIndicator() {
        // Hide the update notification and show updating indicator
        this.hideUpdateNotification();
        
        const indicator = document.createElement('div');
        indicator.id = 'updating-indicator';
        indicator.innerHTML = `
            <div class="update-checking">
                <span data-i18n="update.updating">Updating app... Please wait.</span>
            </div>
        `;
        document.body.appendChild(indicator);
        
        // Apply i18n to the dynamically created content
        if (window.i18n) {
            window.i18n.translatePage();
        }
    }

    showUpdateCheckingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'update-checking';
        indicator.innerHTML = `
            <div class="update-checking">
                <span data-i18n="update.checking">Checking for updates...</span>
            </div>
        `;
        document.body.appendChild(indicator);
        
        // Apply i18n to the dynamically created content
        if (window.i18n) {
            window.i18n.translatePage();
        }
    }

    hideUpdateCheckingIndicator() {
        const indicator = document.getElementById('update-checking');
        if (indicator) {
            indicator.remove();
        }
    }

    showNoUpdateMessage() {
        const message = document.createElement('div');
        message.id = 'no-update-message';
        message.innerHTML = `
            <div class="no-update-message">
                <span data-i18n="update.none">You have the latest version!</span>
            </div>
        `;
        document.body.appendChild(message);
        
        // Apply i18n to the dynamically created content
        if (window.i18n) {
            window.i18n.translatePage();
        }

        setTimeout(() => {
            message.remove();
        }, 3000);
    }

    showUpdateError() {
        const error = document.createElement('div');
        error.id = 'update-error';
        error.innerHTML = `
            <div class="update-error">
                <span data-i18n="update.error">Update check failed. Please try again.</span>
            </div>
        `;
        document.body.appendChild(error);
        
        // Apply i18n to the dynamically created content
        if (window.i18n) {
            window.i18n.translatePage();
        }

        setTimeout(() => {
            error.remove();
        }, 3000);
    }

    getAppInfo() {
        return {
            version: this.version,
            initialized: this.initialized,
            online: navigator.onLine,
            lastUpdateTime: this.lastUpdateTime,
            lastUpdateCheck: this.lastUpdateCheck,
            updateAvailable: this.updateAvailable
        };
    }
}

class ModalManager {
    constructor() {
        this.openModals = new Set();
        this.init();
    }

    init() {
        this.setupGlobalEventListeners();
    }

    setupGlobalEventListeners() {
        // Global click handler for closing modals when clicking outside
        document.addEventListener('click', (e) => {
            // Find if the click was on a modal backdrop
            const modal = e.target.closest('.species-modal, .location-modal, .share-modal, .help-modal, .taxon-modal');
            if (modal && e.target === modal) {
                this.closeModal(modal);
            }
        });

        // Global escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeTopModal();
            }
        });
    }

    openModal(modal) {
        if (modal) {
            modal.style.display = 'flex';
            this.openModals.add(modal);
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.style.display = 'none';
            this.openModals.delete(modal);

            // Clear search input and results if present
            const searchInput = modal.querySelector('input[type="text"]');
            if (searchInput) {
                searchInput.value = '';
            }

            const resultsContainer = modal.querySelector('.location-results, .taxon-results');
            if (resultsContainer) {
                resultsContainer.innerHTML = '';
            }
        }
    }

    closeTopModal() {
        // Close the most recently opened modal
        if (this.openModals.size > 0) {
            const modalsArray = Array.from(this.openModals);
            const topModal = modalsArray[modalsArray.length - 1];
            this.closeModal(topModal);
        }
    }

    closeAllModals() {
        this.openModals.forEach(modal => {
            this.closeModal(modal);
        });
    }

    isModalOpen() {
        return this.openModals.size > 0;
    }
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .notification-success {
        background: #4CAF50 !important;
    }
    
    .notification-warning {
        background: #FF9800 !important;
    }
    
    .notification-error {
        background: #f44336 !important;
    }
`;
document.head.appendChild(style);

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new BiodiversityApp();
        window.modalManager = new ModalManager();
    });
} else {
    window.app = new BiodiversityApp();
    window.modalManager = new ModalManager();
}