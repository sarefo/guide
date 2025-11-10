class BiodiversityApp {
    constructor() {
        // Version from centralized config
        this.version = window.APP_CONFIG.version;
        this.buildDate = window.APP_CONFIG.buildDate;
        this.initialized = false;
        this.updateCheckInterval = null;
        this.lastUpdateCheck = null;
        this.updateAvailable = false;
        this.lastUpdateNotification = null;
        this.updateFoundListenerAdded = false;
        this.init();
    }

    async init() {
        if (this.initialized) return;


        try {
            await this.waitForDependencies();
            this.setupErrorHandling();
            this.setupNetworkMonitoring();
            this.initializeApp();
            this.initialized = true;

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
            this.showNetworkStatus('online');
            this.updateOfflineUiElements(true);
            this.retryFailedOperations();
        });

        window.addEventListener('offline', () => {
            this.showNetworkStatus('offline');
            this.updateOfflineUiElements(false);
        });
    }

    initializeApp() {
        this.setupAppEventListeners();
        this.initializeSharing();
        this.initializeCaching();
        this.initializeLanguageSelector();
        this.setupServiceWorkerListeners();
        this.requestPersistentStorage();
        
        // Delay initial update check to avoid conflicts with SW installation
        setTimeout(async () => {
            try {
                await this.checkForUpdates();
            } catch (error) {
                console.error('Initial update check failed:', error);
            }
        }, window.APP_CONFIG.timing.updateCheckDelay);
        
        this.startPeriodicUpdateChecks();
        
        // Initial offline state setup
        this.updateOfflineUiElements(navigator.onLine);

        if (window.locationManager) {
        }

        if (window.speciesManager) {
        }
    }

    setupAppEventListeners() {
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden) {
                this.onAppHidden();
            } else {
                this.onAppVisible();
                // Only check for updates if significant time has passed (2+ hours)
                const timeSinceLastCheck = Date.now() - (this.lastUpdateCheck?.getTime() || 0);
                if (timeSinceLastCheck > 2 * 60 * 60 * 1000) { // 2 hours
                    try {
                        await this.checkForUpdates();
                    } catch (error) {
                        console.error('Visibility update check failed:', error);
                    }
                }
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

    async requestPersistentStorage() {
        if ('storage' in navigator && 'persist' in navigator.storage) {
            try {
                const isPersisted = await navigator.storage.persisted();
                if (!isPersisted) {
                    const granted = await navigator.storage.persist();
                    if (granted) {
                        console.log('✅ Persistent storage granted');
                    } else {
                        console.log('⚠️ Persistent storage denied - cache may be cleared by browser');
                    }
                } else {
                    console.log('✅ Storage is already persistent');
                }
                
                // Log storage estimate for debugging
                if ('estimate' in navigator.storage) {
                    const estimate = await navigator.storage.estimate();
                    console.log(`📊 Storage: ${(estimate.usage / 1024 / 1024).toFixed(2)}MB used of ${(estimate.quota / 1024 / 1024).toFixed(2)}MB`);
                }
            } catch (error) {
                console.warn('Persistent storage request failed:', error);
            }
        }
    }

    handleServiceWorkerMessage(data) {

        switch (data.type) {
            case 'SW_UPDATE_COMPLETE':
                this.hideUpdateNotification();
                break;
        }
    }

    startPeriodicUpdateChecks() {
        // Check for updates using config interval
        this.updateCheckInterval = setInterval(async () => {
            if (!document.hidden) {
                try {
                    await this.checkForUpdates();
                } catch (error) {
                    console.error('Periodic update check failed:', error);
                }
            }
        }, window.APP_CONFIG.updateCheckInterval);
    }

    initializeSharing() {
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                this.shareLocation();
            });
        }
    }

    initializeCaching() {
        const cacheBtn = document.getElementById('cache-btn');
        if (cacheBtn) {
            cacheBtn.addEventListener('click', () => {
                // Block caching when offline
                if (!navigator.onLine) {
                    if (window.speciesManager) {
                        window.speciesManager.showOfflineNotification('cache');
                    }
                    return;
                }
                this.cacheAllLifeGroups();
            });
        }
        
        // Check if current location is already cached on app load
        this.checkCachedState();
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
        notification.className = `notification notification--${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('notification--slide-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, window.APP_CONFIG.timing.modalTransition);
        }, window.APP_CONFIG.timing.notificationDuration);
    }

    showNetworkStatus(status) {
        const offlineBadge = document.getElementById('offline-badge');
        const locationBtn = document.getElementById('location-btn');
        const shareBtn = document.getElementById('share-btn');
        
        if (!offlineBadge) return;

        if (status === 'offline') {
            // Hide location and share buttons (useless offline)
            if (locationBtn) locationBtn.style.display = 'none';
            if (shareBtn) shareBtn.style.display = 'none';
            
            // Show offline badge persistently in their place
            offlineBadge.classList.remove('online', 'hiding');
            offlineBadge.style.display = 'block';
            
            // Update text for offline
            const textEl = offlineBadge.querySelector('.offline-text');
            if (textEl) {
                const translation = window.i18n ? window.i18n.t('status.offline') : 'Offline';
                textEl.textContent = translation !== 'status.offline' ? translation : 'Offline';
            }
        } else {
            // Show brief "back online" indication, then restore buttons
            offlineBadge.classList.add('online');
            offlineBadge.classList.remove('hiding');
            offlineBadge.style.display = 'block';
            
            // Update text for online
            const textEl = offlineBadge.querySelector('.offline-text');
            if (textEl) {
                const translation = window.i18n ? window.i18n.t('status.online') : 'Online';
                textEl.textContent = translation !== 'status.online' ? translation : 'Online';
            }
            
            // Hide badge and restore buttons after notification duration
            setTimeout(() => {
                if (navigator.onLine && offlineBadge.classList.contains('online')) {
                    offlineBadge.classList.add('hiding');
                    setTimeout(() => {
                        offlineBadge.style.display = 'none';
                        offlineBadge.classList.remove('online', 'hiding');

                        // Restore the buttons
                        if (locationBtn) locationBtn.style.display = 'flex';
                        if (shareBtn) shareBtn.style.display = 'flex';
                    }, window.APP_CONFIG.timing.modalTransition);
                }
            }, window.APP_CONFIG.timing.notificationDuration);
        }
    }

    async retryFailedOperations() {
        if (window.speciesManager && !window.speciesManager.currentSpecies.length) {
            await window.speciesManager.loadSpecies();
        }
    }

    async refreshData() {

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
            const updateInterval = 15 * 60 * 1000; // 15 minutes (less aggressive)

            if (timeSinceLastUpdate > updateInterval) {
                // Only refresh if data is actually stale
                if (window.speciesManager && !window.speciesManager.currentSpecies.length) {
                    this.refreshData();
                }
            }
        }
    }

    onAppHidden() {
        this.lastUpdateTime = Date.now();
    }

    onAppUnload() {
    }

    async checkForUpdates() {
        if ('serviceWorker' in navigator) {
            try {
                this.lastUpdateCheck = new Date();
                const registration = await navigator.serviceWorker.getRegistration();

                if (registration) {
                    // Only check for updates, don't set up duplicate listeners
                    await registration.update();
                    
                    // Only set up updatefound listener if we don't already have one
                    if (!this.updateFoundListenerAdded) {
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            if (newWorker && navigator.serviceWorker.controller) {
                                // Only show notification if there's an active worker (this is an update)
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
    }

    async manualUpdateCheck() {
        this.showUpdateCheckingIndicator();

        try {
            // Clear all caches before reload to ensure fresh content
            await this.clearAllCaches();
            
            // Always reload the app when manual update is requested
            setTimeout(() => {
                this.hideUpdateCheckingIndicator();
                window.location.reload(true); // Force reload from server
            }, 1000);
        } catch (error) {
            console.error('Manual update check failed:', error);
            this.hideUpdateCheckingIndicator();
            this.showUpdateError();
        }
    }

    showUpdateNotification() {
        // Prevent showing update notifications too frequently (within 60 seconds)
        const now = Date.now();
        if (this.lastUpdateNotification && (now - this.lastUpdateNotification) < 60000) {
            return;
        }
        this.lastUpdateNotification = now;
        
        // Check if notification already exists
        if (document.getElementById('update-notification')) {
            return; // Don't show duplicate notifications
        }

        const updateNotification = document.createElement('div');
        updateNotification.id = 'update-notification';
        updateNotification.innerHTML = `
            <div class="update-notification">
                <div class="update-notification__message">
                    <strong data-i18n="update.available">New version available!</strong>
                </div>
                <button id="update-btn" class="update-notification__btn" data-i18n="update.button">Update Now</button>
                <button id="dismiss-update" class="update-notification__dismiss" aria-label="Dismiss">&times;</button>
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
            
            // Clear all caches before update to ensure no stale data
            await this.clearAllCaches();
            
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && registration.waiting) {
                // Tell the waiting service worker to take over
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });

                // Listen for the activation and reload
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    window.location.reload(true); // Force reload from server
                });
                
                // Fallback: reload after timeout if controllerchange doesn't fire
                setTimeout(() => {
                    window.location.reload(true); // Force reload from server
                }, 3000);
            } else {
                // No waiting worker, just reload with cache clearing
                window.location.reload(true); // Force reload from server
            }
        } catch (error) {
            console.error('Update application failed:', error);
            // Even if cache clearing fails, still reload
            window.location.reload(true); // Force reload from server
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
        
        // Also clear service worker cache via message if available
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

    async cacheAllLifeGroups() {
        if (!window.locationManager || !window.locationManager.currentLocation) {
            console.log('No current location available for caching');
            return;
        }

        const cacheBtn = document.getElementById('cache-btn');
        if (!cacheBtn) return;

        // Show loading state
        this.setCacheButtonState('loading');
        this.showCacheStatus('caching');

        try {
            // Get predefined life groups (same list as in species.js)
            const lifeGroups = ['all', '3', '40151', '47126', '47158', '47119', '26036', '20978', '47178', '47170', '47115'];
            const location = window.locationManager.currentLocation;
            
            // Add existing custom life groups to cache list
            if (window.speciesManager && window.speciesManager.customTaxa) {
                const customTaxaIds = Array.from(window.speciesManager.customTaxa.keys());
                lifeGroups.push(...customTaxaIds);
                console.log(`📦 Found ${customTaxaIds.length} custom taxa to cache:`, customTaxaIds);
            }
            
            for (const group of lifeGroups) {
                console.log(`📦 Caching life group: ${group}`);
                
                try {
                    // Determine options for this life group (same logic as in species.js)
                    const options = {
                        iconicTaxonId: null,
                        taxonId: null,
                        locale: window.i18n ? window.i18n.getCurrentLang() : 'en',
                        perPage: 50,
                        quality: 'research',
                        photos: true,
                        locationData: location
                    };
                    
                    // Set the appropriate filter option
                    if (group === 'all') {
                        // No filter for "all"
                    } else if (['3', '40151', '47126', '47158', '47119', '26036', '20978', '47178', '47170', '47115'].includes(group)) {
                        // Use iconic taxon filter for predefined groups
                        options.iconicTaxonId = group;
                    } else {
                        // Use custom taxon filter for custom taxa
                        options.taxonId = group;
                    }
                    
                    // Fetch species data for this life group
                    const speciesData = await window.api.getSpeciesObservations(
                        location.lat,
                        location.lng,
                        location.radius,
                        options
                    );
                    
                    // Format and cache the species data in the species manager's cache
                    if (window.speciesManager && speciesData) {
                        const formattedSpecies = speciesData.map(species => 
                            window.api.formatSpeciesData(species)
                        );
                        
                        // Create cache key using same logic as species manager
                        const cacheKey = `${JSON.stringify(location)}_${group}`;
                        window.speciesManager.speciesCache.set(cacheKey, {
                            species: formattedSpecies,
                            timestamp: Date.now()
                        });
                        
                        console.log(`✅ Cached ${formattedSpecies.length} species for group ${group}`);
                    }
                    
                    // Preload thumbnails for this group
                    speciesData.forEach(speciesCount => {
                        const species = window.api.formatSpeciesData(speciesCount);
                        const photoUrl = species.photo?.thumbUrl || species.photo?.url;
                        if (photoUrl && photoUrl !== 'null') {
                            const img = new Image();
                            img.src = photoUrl;
                        }
                    });
                    
                } catch (error) {
                    console.warn(`Failed to cache life group ${group}:`, error);
                }
            }
            
            // Mark location as cached
            this.markLocationAsCached(location);
            
            // Show success state
            this.setCacheButtonState('complete');
            this.showCacheStatus('cached');
            
            // Keep cached state visible for notification duration, then hide badge
            setTimeout(() => {
                try {
                    this.hideCacheStatus();
                } catch (error) {
                    console.error('Hide cache status failed:', error);
                }
            }, window.APP_CONFIG.timing.notificationDuration);
            
        } catch (error) {
            console.error('Caching failed:', error);
            this.setCacheButtonState('idle');
            this.showCacheStatus('failed');
            setTimeout(() => {
                this.hideCacheStatus();
            }, 3000);
        }
    }

    setCacheButtonState(state) {
        const cacheBtn = document.getElementById('cache-btn');
        if (!cacheBtn) return;

        const iconDefault = cacheBtn.querySelector('.cache-icon');
        const iconLoading = cacheBtn.querySelector('.cache-loading');
        const iconComplete = cacheBtn.querySelector('.cache-complete');

        // Hide all icons first
        [iconDefault, iconLoading, iconComplete].forEach(icon => {
            if (icon) icon.style.display = 'none';
        });

        // Show appropriate icon
        switch (state) {
            case 'loading':
                if (iconLoading) iconLoading.style.display = 'block';
                cacheBtn.disabled = true;
                break;
            case 'complete':
            case 'cached':
                if (iconComplete) iconComplete.style.display = 'block';
                cacheBtn.disabled = false;
                break;
            case 'idle':
            default:
                if (iconDefault) iconDefault.style.display = 'block';
                cacheBtn.disabled = false;
                break;
        }
    }

    showCacheStatus(status) {
        const offlineBadge = document.getElementById('offline-badge');
        const locationBtn = document.getElementById('location-btn');
        const shareBtn = document.getElementById('share-btn');
        
        if (!offlineBadge) return;

        // Show badge
        offlineBadge.classList.remove('online', 'hiding');
        offlineBadge.style.display = 'block';
        
        // Hide location and share buttons while showing cache status
        if (locationBtn) locationBtn.style.display = 'none';
        if (shareBtn) shareBtn.style.display = 'none';
        
        // Update text and color based on status
        const textEl = offlineBadge.querySelector('.offline-text');
        if (textEl) {
            let text, className;
            
            switch (status) {
                case 'caching':
                    text = window.i18n ? window.i18n.t('cache.loading') : 'Caching...';
                    className = 'caching';
                    break;
                case 'cached':
                    text = window.i18n ? window.i18n.t('cache.complete') : 'Cached';
                    className = 'online'; // Use green color
                    break;
                case 'failed':
                    text = window.i18n ? window.i18n.t('cache.failed') : 'Cache failed';
                    className = 'failed';
                    break;
            }
            
            textEl.textContent = text;
            offlineBadge.className = `offline-badge ${className}`;
        }
    }

    hideCacheStatus() {
        const offlineBadge = document.getElementById('offline-badge');
        const locationBtn = document.getElementById('location-btn');
        const shareBtn = document.getElementById('share-btn');
        
        if (!offlineBadge) return;

        // Only hide if we're not actually offline
        if (navigator.onLine) {
            offlineBadge.classList.add('hiding');
            setTimeout(() => {
                offlineBadge.style.display = 'none';
                offlineBadge.classList.remove('online', 'hiding', 'caching', 'failed');
                
                // Restore the buttons
                if (locationBtn) locationBtn.style.display = 'flex';
                if (shareBtn) shareBtn.style.display = 'flex';
            }, 300);
        }
    }

    markLocationAsCached(location) {
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
            console.warn('Failed to store cache marker:', error);
        }
    }

    isLocationCached(location) {
        if (!location) return false;
        
        const cacheKey = `cached_location_${location.lat}_${location.lng}_${location.radius}`;
        
        try {
            const cacheData = localStorage.getItem(cacheKey);
            if (cacheData) {
                const parsed = JSON.parse(cacheData);
                // Consider cache valid for 7 days
                const cacheAge = Date.now() - parsed.timestamp;
                return cacheAge < (7 * 24 * 60 * 60 * 1000);
            }
        } catch (error) {
            console.warn('Failed to check cache status:', error);
        }
        
        return false;
    }

    checkCachedState() {
        // Check when location changes
        if (window.locationManager && window.locationManager.currentLocation) {
            this.updateCacheButtonForLocation(window.locationManager.currentLocation);
        }
        
        // Listen for location changes
        document.addEventListener('locationChanged', (event) => {
            if (event.detail && event.detail.location) {
                this.updateCacheButtonForLocation(event.detail.location);
            }
        });
    }

    updateCacheButtonForLocation(location) {
        if (this.isLocationCached(location)) {
            this.setCacheButtonState('cached');
        } else {
            this.setCacheButtonState('idle');
        }
    }

    initializeLanguageSelector() {
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => {
                // Block language changing when offline
                if (!navigator.onLine) {
                    // Revert to previous selection
                    const currentLang = window.i18n ? window.i18n.getCurrentLang() : 'en';
                    e.target.value = currentLang;
                    
                    if (window.speciesManager) {
                        window.speciesManager.showOfflineNotification('language');
                    }
                    return;
                }
                
                // Allow language change when online
                if (window.i18n) {
                    window.i18n.setLanguage(e.target.value);
                }
            });
        }
    }
    
    updateOfflineUiElements(isOnline) {
        // Update cache button state (but preserve visual state if already cached)
        const cacheBtn = document.getElementById('cache-btn');
        if (cacheBtn) {
            if (isOnline) {
                cacheBtn.disabled = false;
                cacheBtn.style.opacity = '1';
                cacheBtn.style.pointerEvents = 'auto';
            } else {
                // Only disable if not showing cached state
                const iconComplete = cacheBtn.querySelector('.cache-complete');
                const isShowingCached = iconComplete && iconComplete.style.display !== 'none';
                
                if (!isShowingCached) {
                    cacheBtn.disabled = true;
                    cacheBtn.style.opacity = '0.5';
                    cacheBtn.style.pointerEvents = 'none';
                } else {
                    // Keep visual appearance but block functionality
                    cacheBtn.disabled = true;
                    cacheBtn.style.pointerEvents = 'none';
                    // Don't change opacity - keep checkmark visible
                }
            }
        }
        
        // Update language selector state
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            if (isOnline) {
                languageSelect.disabled = false;
                languageSelect.style.opacity = '1';
                languageSelect.style.pointerEvents = 'auto';
            } else {
                languageSelect.disabled = true;
                languageSelect.style.opacity = '0.5';
                languageSelect.style.pointerEvents = 'none';
            }
        }
    }

    getAppInfo() {
        return {
            version: this.version,
            buildDate: this.buildDate,
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
        this.modalHistoryStates = new Map();
        this.historyStateCounter = 0;
        this.init();
    }

    init() {
        this.setupGlobalEventListeners();
        this.setupHistoryHandling();
    }

    setupGlobalEventListeners() {
        // Global click handler for closing modals when clicking outside
        document.addEventListener('click', (e) => {
            // Find if the click was on a modal backdrop
            const modal = e.target.closest('.modal');
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

    setupHistoryHandling() {
        // Flag to track if we're handling modal-related history navigation
        this.handlingModalPopstate = false;
        
        // Listen for popstate events (Android back button, browser back button)
        window.addEventListener('popstate', (e) => {
            // If we have open modals, close the top one instead of navigating back
            if (this.openModals.size > 0) {
                e.preventDefault();
                e.stopImmediatePropagation(); // Prevent other popstate handlers from running
                this.closeTopModalFromHistory();
                return false;
            }
            // If no modals are open, let the default behavior happen (handled by LocationManager)
        });
    }

    openModal(modal) {
        if (modal) {
            modal.style.display = 'flex';
            this.openModals.add(modal);
            
            // Push a history state for Android back button handling
            const stateId = `modal-${this.historyStateCounter++}`;
            const currentState = history.state || {};
            history.pushState({ ...currentState, modalId: stateId }, '', window.location.href);
            this.modalHistoryStates.set(modal, stateId);
        }
    }

    closeModal(modal, fromHistory = false) {
        if (modal) {
            modal.style.display = 'none';
            this.openModals.delete(modal);
            
            // Only navigate history if not already triggered by history navigation
            if (!fromHistory) {
                const stateId = this.modalHistoryStates.get(modal);
                if (stateId && history.state && history.state.modalId === stateId) {
                    // Set flag to prevent location manager from reacting to this popstate
                    this.handlingModalPopstate = true;
                    
                    // Use history.replaceState instead of history.back() to avoid popstate event
                    const currentState = history.state || {};
                    const newState = { ...currentState };
                    delete newState.modalId;
                    
                    // If the new state is empty, go back in history
                    if (Object.keys(newState).length === 0) {
                        history.back();
                    } else {
                        history.replaceState(newState, '', window.location.href);
                    }
                    
                    // Clear flag after a short delay
                    setTimeout(() => {
                        this.handlingModalPopstate = false;
                    }, 100);
                }
            }
            this.modalHistoryStates.delete(modal);

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

    closeTopModalFromHistory() {
        // Close the most recently opened modal (triggered by history navigation)
        if (this.openModals.size > 0) {
            const modalsArray = Array.from(this.openModals);
            const topModal = modalsArray[modalsArray.length - 1];
            this.closeModal(topModal, true);
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
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
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