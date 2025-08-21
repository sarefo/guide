class BiodiversityApp {
    constructor() {
        this.version = '1.0.0';
        this.initialized = false;
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
        this.checkForUpdates();
        
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
            modal.style.display = 'flex';

            if (copyBtn) {
                copyBtn.onclick = () => {
                    this.copyToClipboard(url);
                };
            }

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
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
        
        this.showNotification('Refreshing data...');
        
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
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    this.showUpdateAvailable();
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

    showUpdateAvailable() {
        const updateNotification = document.createElement('div');
        updateNotification.innerHTML = `
            <div style="position: fixed; bottom: 20px; left: 20px; right: 20px; background: #2E7D32; color: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10000; display: flex; justify-content: space-between; align-items: center;">
                <span>A new version is available!</span>
                <button onclick="window.location.reload()" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer;">
                    Update
                </button>
            </div>
        `;
        
        document.body.appendChild(updateNotification);
    }

    getAppInfo() {
        return {
            version: this.version,
            initialized: this.initialized,
            online: navigator.onLine,
            lastUpdateTime: this.lastUpdateTime
        };
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
    });
} else {
    window.app = new BiodiversityApp();
}