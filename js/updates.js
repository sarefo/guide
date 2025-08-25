class UpdateService {
    constructor() {
        this.version = window.APP_CONFIG.version;
        this.buildDate = window.APP_CONFIG.buildDate;
        this.updateAvailable = false;
        this.updateCheckInterval = null;
        this.lastUpdateCheck = null;
        this.lastUpdateNotification = null;
        this.updateFoundListenerAdded = false;
        this.checkInterval = window.APP_CONFIG.updateCheckInterval;
        this.notificationCooldown = 60000; // 60 seconds
        
        this.init();
    }

    init() {
        if ('serviceWorker' in navigator) {
            this.setupServiceWorkerListeners();
            
            // Delay initial update check to avoid conflicts with SW installation
            setTimeout(() => {
                this.checkForUpdates();
            }, 5000);
            
            this.startPeriodicChecks();
        }
    }

    setupServiceWorkerListeners() {
        navigator.serviceWorker.addEventListener('message', (event) => {
            this.handleServiceWorkerMessage(event.data);
        });
    }

    handleServiceWorkerMessage(data) {
        switch (data.type) {
            case 'SW_UPDATE_COMPLETE':
                this.hideUpdateNotification();
                break;
            case 'SW_UPDATE_AVAILABLE':
                this.updateAvailable = true;
                this.showUpdateNotification();
                break;
        }
    }

    startPeriodicChecks() {
        this.updateCheckInterval = setInterval(() => {
            if (!document.hidden) {
                this.checkForUpdates();
            }
        }, this.checkInterval);
    }

    async checkForUpdates() {
        if (!('serviceWorker' in navigator)) return;
        
        try {
            this.lastUpdateCheck = new Date();
            const registration = await navigator.serviceWorker.getRegistration();

            if (registration) {
                await registration.update();
                
                if (!this.updateFoundListenerAdded) {
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker && navigator.serviceWorker.controller) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed') {
                                    this.updateAvailable = true;
                                    this.showUpdateNotification();
                                }
                            });
                        }
                    });
                    this.updateFoundListenerAdded = true;
                }
            }
        } catch (error) {
            console.error('Update check failed:', error);
        }
    }

    showUpdateNotification() {
        // Prevent showing notifications too frequently
        const now = Date.now();
        if (this.lastUpdateNotification && (now - this.lastUpdateNotification) < this.notificationCooldown) {
            return;
        }
        this.lastUpdateNotification = now;
        
        // Check if notification already exists
        if (document.getElementById('update-notification')) {
            return;
        }

        const updateNotification = document.createElement('div');
        updateNotification.id = 'update-notification';
        updateNotification.innerHTML = `
            <div class="update-notification">
                <div class="update-message">
                    <strong data-i18n="update.available">New version available!</strong>
                </div>
                <button id="update-btn" class="update-btn-primary" data-i18n="update.button">Update Now</button>
                <button id="dismiss-update" class="update-btn-dismiss" aria-label="Dismiss">&times;</button>
            </div>
        `;

        document.body.appendChild(updateNotification);

        // Apply i18n
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
            this.showUpdatingIndicator();
            
            // Clear all caches before update
            await this.clearAllCaches();
            
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });

                // Listen for the activation and reload
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    window.location.reload(true);
                });
                
                // Fallback reload
                setTimeout(() => {
                    window.location.reload(true);
                }, 3000);
            } else {
                window.location.reload(true);
            }
        } catch (error) {
            console.error('Update application failed:', error);
            window.location.reload(true);
        }
    }

    showUpdatingIndicator() {
        this.hideUpdateNotification();
        
        const indicator = document.createElement('div');
        indicator.id = 'updating-indicator';
        indicator.innerHTML = `
            <div class="update-checking">
                <span data-i18n="update.updating">Updating app... Please wait.</span>
            </div>
        `;
        document.body.appendChild(indicator);
        
        if (window.i18n) {
            window.i18n.translatePage();
        }
    }

    async clearAllCaches() {
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                const deletePromises = cacheNames.map(cacheName => {
                    console.log('🗑️ Clearing cache:', cacheName);
                    return caches.delete(cacheName);
                });
                await Promise.all(deletePromises);
                console.log('✅ All caches cleared successfully');
            } catch (error) {
                console.error('❌ Cache clearing failed:', error);
                throw error;
            }
        }
        
        // Also clear service worker cache via message
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration && registration.active) {
                    registration.active.postMessage({ type: 'CLEAR_CACHE' });
                }
            } catch (error) {
                console.warn('Could not message service worker for cache clearing:', error);
            }
        }
    }

    async manualUpdateCheck() {
        const indicator = this.createUpdateCheckingIndicator();
        document.body.appendChild(indicator);

        try {
            await this.clearAllCaches();
            
            setTimeout(() => {
                indicator.remove();
                window.location.reload(true);
            }, 1000);
        } catch (error) {
            console.error('Manual update check failed:', error);
            indicator.remove();
            this.showUpdateError();
        }
    }

    createUpdateCheckingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'update-checking';
        indicator.innerHTML = `
            <div class="update-checking">
                <span data-i18n="update.checking">Checking for updates...</span>
            </div>
        `;
        
        if (window.i18n) {
            setTimeout(() => window.i18n.translatePage(), 0);
        }
        
        return indicator;
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
        
        if (window.i18n) {
            window.i18n.translatePage();
        }

        setTimeout(() => {
            error.remove();
        }, 3000);
    }

    getInfo() {
        return {
            version: this.version,
            buildDate: this.buildDate,
            updateAvailable: this.updateAvailable,
            lastUpdateCheck: this.lastUpdateCheck
        };
    }

    stopPeriodicChecks() {
        if (this.updateCheckInterval) {
            clearInterval(this.updateCheckInterval);
            this.updateCheckInterval = null;
        }
    }
}

// Initialize update service
window.updateService = new UpdateService();