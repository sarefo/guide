
class LocationManager {
    constructor() {
        this.currentLocation = null;
        this.defaultLocation = { lat: 22.3193, lng: 114.1694, radius: 50, name: 'Hong Kong' }; // Default location
        this.radius = 50; // Always 50km as requested
        this.isGettingLocation = false;
        
        // Search state management
        this.currentSearchQuery = '';
        this.searchState = 'idle'; // 'idle' | 'searching' | 'complete'
        this.currentSearchController = null;
        this.isRapidTyping = false;
        this.lastInputTime = 0;
        
        this.init();
    }

    init() {
        this.loadLocationFromURL();
        this.setupEventListeners();
        
        // Manual test helper (keeping original functionality)
        setTimeout(() => {
            const helpBtn = document.getElementById('help-btn');
            if (helpBtn) {
                window.testHelpButton = () => {
                    this.openHelpModal();
                };
            }
        }, 1000);
    }

    setupEventListeners() {
        
        // Main UI elements
        const locationBtn = document.getElementById('location-btn');
        const locationName = document.getElementById('location-name');
        const locationModal = document.getElementById('location-modal');
        const searchInput = document.getElementById('location-search');
        const modalCloses = document.querySelectorAll('.modal-close');
        const languageSelect = document.getElementById('language-select');
        const helpBtn = document.getElementById('help-btn');
        
        // New elements for coordinate system
        const myLocationBtn = document.getElementById('my-location-btn');
        const useLocationBtn = document.getElementById('use-location-btn');


        // Event listeners
        locationBtn?.addEventListener('click', () => this.openLocationModal());
        locationName?.addEventListener('click', () => this.openLocationModal());
        myLocationBtn?.addEventListener('click', () => this.getCurrentGPSLocation());
        useLocationBtn?.addEventListener('click', () => this.confirmSelectedLocation());
        
        if (helpBtn) {
            helpBtn.addEventListener('click', (e) => {
                this.openHelpModal();
            });
        }
        
        modalCloses.forEach(close => {
            close.addEventListener('click', (e) => {
                const modal = e.target.closest('.location-modal, .species-modal, .share-modal, .help-modal, .taxon-modal');
                if (modal) {
                    if (window.modalManager) {
                        window.modalManager.closeModal(modal);
                    } else {
                        this.closeModal(modal);
                    }
                }
            });
        });

        // Search input with geocoding
        searchInput?.addEventListener('input', (e) => {
            const now = Date.now();
            this.isRapidTyping = (now - this.lastInputTime) < 200; // Less than 200ms between keystrokes
            this.lastInputTime = now;
            this.debounce(() => {
                this.isRapidTyping = false;
                this.handleSearchInput(e.target.value);
            }, 800)();
        });

        // Language change handler
        languageSelect?.addEventListener('change', (e) => {
            this.changeLanguage(e.target.value);
        });

        // URL change handler
        window.addEventListener('popstate', () => {
            this.loadLocationFromURL();
        });
    }

    async loadLocationFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check for new coordinate-based URL format
        const lat = urlParams.get('lat');
        const lng = urlParams.get('lng');
        const name = urlParams.get('name') || urlParams.get('location');
        const urlLang = urlParams.get('lang');
        const lifeGroup = urlParams.get('life_group');
        
        await this.waitForDependencies();
        
        // Determine language: URL param takes priority, then saved preference, then default
        const lang = urlLang || this.loadLanguageFromStorage() || 'en';
        this.setLanguage(lang);
        
        // Small delay to ensure language setting propagates to API and species manager
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Handle life group selection BEFORE loading location
        // This ensures species manager has the correct filter when locationChanged fires
        const finalLifeGroup = lifeGroup || this.loadLifeGroupFromStorage();
        if (finalLifeGroup) {
            window.dispatchEvent(new CustomEvent('lifeGroupFromURL', {
                detail: { lifeGroup: finalLifeGroup }
            }));
        }
        
        if (lat && lng) {
            // New coordinate-based URL
            await this.loadLocationFromCoordinates(parseFloat(lat), parseFloat(lng), name);
        } else {
            // Check for legacy place_id format
            const placeId = urlParams.get('place_id');
            if (placeId) {
                await this.convertPlaceIdToCoordinates(placeId);
            } else {
                // No URL location specified - try loading from localStorage
                const savedLocation = this.loadLocationFromStorage();
                if (savedLocation) {
                    console.log('📍 Using saved location for PWA launch');
                    await this.loadLocationFromCoordinates(
                        savedLocation.lat, 
                        savedLocation.lng, 
                        savedLocation.name
                    );
                } else {
                    // No saved location - open location modal for user to choose
                    this.openLocationModalOnFirstLoad();
                }
            }
        }
    }
    
    async waitForDependencies() {
        const maxWait = 3000;
        const checkInterval = 50;
        let waited = 0;

        while (waited < maxWait) {
            if (window.api && window.speciesManager && window.i18n) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }
        
        console.warn('Dependencies not fully loaded, proceeding anyway');
    }

    async loadLocationFromCoordinates(lat, lng, name = null) {
        try {
            
            // Create location object
            this.currentLocation = {
                lat: lat,
                lng: lng,
                radius: this.radius,
                name: name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                source: 'coordinates'
            };
            
            // Save location to localStorage for PWA persistence
            this.saveLocationToStorage();
            
            this.updateLocationDisplay();
            this.updateURL();
            
            // Update map if available
            if (window.mapManager) {
                window.mapManager.setLocation(lat, lng, this.currentLocation.name);
            }
            
            // Notify other components
            window.dispatchEvent(new CustomEvent('locationChanged', {
                detail: this.currentLocation
            }));
            
        } catch (error) {
            console.error('Failed to load location from coordinates:', error);
            this.handleLocationError();
        }
    }

    async convertPlaceIdToCoordinates(placeId) {
        try {
            
            const locationData = await window.api.getPlace(placeId);
            
            // Calculate center from bounding box
            let lat, lng, name;
            
            if (locationData.bounding_box_geojson) {
                const center = window.mapManager ? 
                    window.mapManager.constructor.calculateCenter(locationData.bounding_box_geojson) :
                    this.calculateCenterFromBbox(locationData.bounding_box_geojson);
                
                if (center) {
                    lat = center.lat;
                    lng = center.lng;
                    name = locationData.display_name || locationData.name;
                    
                    await this.loadLocationFromCoordinates(lat, lng, name);
                    return;
                }
            }
            
            // Fallback to default if conversion fails
            console.warn('⚠️ Could not convert place to coordinates, using default');
            await this.loadLocationFromCoordinates(
                this.defaultLocation.lat, 
                this.defaultLocation.lng, 
                this.defaultLocation.name
            );
            
        } catch (error) {
            console.error('Failed to convert place_id:', error);
            await this.loadLocationFromCoordinates(
                this.defaultLocation.lat, 
                this.defaultLocation.lng, 
                this.defaultLocation.name
            );
        }
    }

    calculateCenterFromBbox(boundingBoxGeoJson) {
        if (!boundingBoxGeoJson || !boundingBoxGeoJson.coordinates) {
            return null;
        }

        try {
            const coords = boundingBoxGeoJson.coordinates[0];
            let minLng = Infinity, maxLng = -Infinity;
            let minLat = Infinity, maxLat = -Infinity;

            coords.forEach(([lng, lat]) => {
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
            });

            const centerLat = (minLat + maxLat) / 2;
            const centerLng = (minLng + maxLng) / 2;

            return { lat: centerLat, lng: centerLng };
        } catch (error) {
            console.error('Failed to calculate center from bbox:', error);
            return null;
        }
    }

    // localStorage persistence methods
    saveLocationToStorage() {
        if (this.currentLocation) {
            try {
                const locationData = {
                    lat: this.currentLocation.lat,
                    lng: this.currentLocation.lng,
                    name: this.currentLocation.name,
                    radius: this.currentLocation.radius,
                    timestamp: Date.now()
                };
                localStorage.setItem('savedLocation', JSON.stringify(locationData));
                console.log('📍 Location saved to storage:', locationData.name);
            } catch (error) {
                console.warn('Failed to save location to storage:', error);
            }
        }
    }

    loadLocationFromStorage() {
        try {
            const saved = localStorage.getItem('savedLocation');
            if (saved) {
                const locationData = JSON.parse(saved);
                // Check if location is not too old (e.g., within 30 days)
                const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
                if (Date.now() - locationData.timestamp < maxAge) {
                    console.log('📍 Loaded location from storage:', locationData.name);
                    return locationData;
                } else {
                    console.log('📍 Saved location is too old, clearing it');
                    this.clearLocationFromStorage();
                }
            }
        } catch (error) {
            console.warn('Failed to load location from storage:', error);
            this.clearLocationFromStorage();
        }
        return null;
    }

    clearLocationFromStorage() {
        try {
            localStorage.removeItem('savedLocation');
            console.log('📍 Cleared saved location from storage');
        } catch (error) {
            console.warn('Failed to clear location from storage:', error);
        }
    }

    saveLanguageToStorage(lang) {
        try {
            localStorage.setItem('savedLanguage', lang);
            console.log('🌐 Language saved to storage:', lang);
        } catch (error) {
            console.warn('Failed to save language to storage:', error);
        }
    }

    loadLanguageFromStorage() {
        try {
            const saved = localStorage.getItem('savedLanguage');
            if (saved) {
                console.log('🌐 Loaded language from storage:', saved);
                return saved;
            }
        } catch (error) {
            console.warn('Failed to load language from storage:', error);
        }
        return null;
    }

    saveLifeGroupToStorage(lifeGroup) {
        try {
            if (lifeGroup && lifeGroup !== 'all') {
                localStorage.setItem('savedLifeGroup', lifeGroup);
                console.log('🦋 Life group saved to storage:', lifeGroup);
            } else {
                localStorage.removeItem('savedLifeGroup');
                console.log('🦋 Life group cleared from storage (all selected)');
            }
        } catch (error) {
            console.warn('Failed to save life group to storage:', error);
        }
    }

    loadLifeGroupFromStorage() {
        try {
            const saved = localStorage.getItem('savedLifeGroup');
            if (saved) {
                console.log('🦋 Loaded life group from storage:', saved);
                return saved;
            }
        } catch (error) {
            console.warn('Failed to load life group from storage:', error);
        }
        return null;
    }


    // GPS Location functionality
    async getCurrentGPSLocation() {
        if (this.isGettingLocation) {
            return;
        }

        if (!navigator.geolocation) {
            this.showLocationError(window.i18n.t('location.permission.error'));
            return;
        }

        this.isGettingLocation = true;
        this.updateMyLocationButton('detecting');

        const options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000 // 5 minutes
        };

        try {
            
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, options);
            });

            const { latitude, longitude, accuracy } = position.coords;

            // Store in localStorage for faster subsequent loads
            localStorage.setItem('lastGPSLocation', JSON.stringify({
                lat: latitude,
                lng: longitude,
                timestamp: Date.now(),
                accuracy: accuracy
            }));

            // Get actual location name using reverse geocoding
            let locationName = window.i18n?.t('location.myLocation') || 'My Location'; // Fallback with i18n
            
            try {
                if (window.api && window.api.reverseGeocode) {
                    const geocodeResult = await window.api.reverseGeocode(latitude, longitude);
                    if (geocodeResult && geocodeResult.name) {
                        locationName = geocodeResult.name;
                    } else {
                    }
                }
            } catch (error) {
                // Continue with i18n fallback name
            }

            // Show location selection with actual location name
            this.showLocationSelection(latitude, longitude, locationName);
            
            // Also update the map to show this location
            if (window.mapManager) {
                window.mapManager.setLocation(latitude, longitude, locationName);
            }

        } catch (error) {
            console.error('GPS location error:', error);
            
            let errorMessage;
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = window.i18n.t('location.permission.denied');
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = window.i18n.t('location.permission.error');
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out';
                    break;
                default:
                    errorMessage = window.i18n.t('location.permission.error');
                    break;
            }
            
            this.showLocationError(errorMessage);
        } finally {
            this.isGettingLocation = false;
            this.updateMyLocationButton('ready');
        }
    }

    updateMyLocationButton(state) {
        const btn = document.getElementById('my-location-btn');
        if (!btn) return;

        switch (state) {
            case 'detecting':
                btn.textContent = '📍 ' + window.i18n.t('location.detecting');
                btn.disabled = true;
                break;
            case 'ready':
            default:
                btn.textContent = '📍 ' + window.i18n.t('location.myLocation');
                btn.disabled = false;
                break;
        }
    }

    showLocationError(message) {
        if (window.app && window.app.showNotification) {
            window.app.showNotification(message, 'error');
        } else {
            console.error('Location error:', message);
        }
    }

    // Handle search input with proper state management
    handleSearchInput(query) {
        this.currentSearchQuery = query.trim();
        
        // Handle different input states
        if (this.currentSearchQuery.length === 0) {
            // Cancel any ongoing search and clear results
            if (this.currentSearchController) {
                this.currentSearchController.abort();
                this.currentSearchController = null;
            }
            this.clearLocationResults();
            return;
        }
        
        if (this.currentSearchQuery.length < 3) {
            // Cancel any ongoing search and show prompt
            if (this.currentSearchController) {
                this.currentSearchController.abort();
                this.currentSearchController = null;
            }
            this.showSearchPrompt();
            return;
        }
        
        // Only cancel and start new search if we have enough characters
        this.performSearch(this.currentSearchQuery);
    }
    
    // Separate method to handle the actual search with proper cancellation
    async performSearch(query) {
        // Cancel any ongoing search
        if (this.currentSearchController) {
            this.currentSearchController.abort();
            this.currentSearchController = null;
        }
        
        // Small delay to avoid rapid cancellations
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Start new search
        this.searchLocations(query);
    }

    // Search functionality with proper cancellation and state management
    async searchLocations(query) {
        try {
            // Set up cancellation
            this.currentSearchController = new AbortController();
            const signal = this.currentSearchController.signal;
            
            // Update state and show loading
            this.searchState = 'searching';
            this.showSearchLoading();
            
            
            let places = [];
            
            // Use map manager's geocoder if available
            if (window.mapManager && window.mapManager.searchLocation) {
                places = await window.mapManager.searchLocation(query, signal);
            } else {
                console.warn('Map manager not available for search');
                this.displayLocationError('Map not available');
                return;
            }
            
            // Check if this search was cancelled or if query has changed
            if (signal.aborted || query !== this.currentSearchQuery) {
                // Only log if it's a meaningful cancellation (not just rapid typing)
                if (query.length > 2 && !this.isRapidTyping) {
                    console.log('🔍 Search cancelled for:', query);
                }
                return;
            }
            
            // Update state and display results
            this.searchState = 'complete';
            this.displayLocationResults(places, query);
            
        } catch (error) {
            // Don't show error if request was just cancelled
            if (error.name === 'AbortError') {
                // Silent cancellation - this is expected behavior
                return;
            }
            
            console.error('Location search failed:', error);
            this.searchState = 'idle';
            this.displayLocationError('Search failed. Please try again.');
        }
    }

    displayLocationResults(places, query) {
        const resultsContainer = document.getElementById('location-results');
        
        if (!resultsContainer) {
            console.error('📋 No results container found!');
            return;
        }

        // Verify this is still the current search
        if (query !== this.currentSearchQuery) {
            return;
        }

        if (!places || places.length === 0) {
            resultsContainer.innerHTML = `
                <div class="search-state no-results">
                    <p>No locations found for "${query}"</p>
                </div>
            `;
            this.showLocationResults();
            return;
        }


        const resultsHTML = places.map(place => {
            const name = place.display_name || place.name;
            return `
                <div class="location-result" data-lat="${place.lat}" data-lng="${place.lng}" data-name="${name}">
                    <div class="location-info">
                        <h3 class="location-result-name">${name}</h3>
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = resultsHTML;
        this.showLocationResults();

        // Remove existing click handlers and add new one
        resultsContainer.onclick = null;
        resultsContainer.onclick = (e) => {
            const resultEl = e.target.closest('.location-result');
            if (resultEl) {
                const lat = parseFloat(resultEl.dataset.lat);
                const lng = parseFloat(resultEl.dataset.lng);
                const name = resultEl.dataset.name;
                this.selectLocationFromSearch(lat, lng, name);
            }
        };
    }

    showSearchPrompt() {
        const resultsContainer = document.getElementById('location-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="search-state search-prompt">
                <p>Type at least 3 characters to search locations...</p>
            </div>
        `;
        this.showLocationResults();
    }

    showSearchLoading() {
        const resultsContainer = document.getElementById('location-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="search-state search-loading">
                <div class="loading-spinner"></div>
                <p>Searching locations...</p>
            </div>
        `;
        this.showLocationResults();
    }

    clearLocationResults() {
        const resultsContainer = document.getElementById('location-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
            this.hideLocationResults();
        }
        this.searchState = 'idle';
    }

    async selectLocationFromSearch(lat, lng, name) {
        // Show location selection instead of immediately loading
        this.showLocationSelection(lat, lng, name);
        
        // Also update the map to show this location
        if (window.mapManager) {
            window.mapManager.setLocation(lat, lng, name);
        }
    }

    hideLocationResults() {
        const resultsContainer = document.getElementById('location-results');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    }

    showLocationResults() {
        const resultsContainer = document.getElementById('location-results');
        if (resultsContainer) {
            resultsContainer.style.display = 'block';
        }
    }

    displayLocationError(message = 'Search error occurred') {
        const resultsContainer = document.getElementById('location-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="search-state search-error">
                    <p>${message}</p>
                </div>
            `;
            this.showLocationResults();
        }
    }

    // Map integration
    setLocationFromCoordinates(lat, lng, name) {
        this.showLocationSelection(lat, lng, name);
    }

    // Show location selection confirmation
    showLocationSelection(lat, lng, name) {
        
        // Update search field
        const searchInput = document.getElementById('location-search');
        if (searchInput) {
            searchInput.value = name || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
        }

        // Show confirmation panel
        const confirmPanel = document.getElementById('location-confirm');
        const nameEl = document.getElementById('selected-location-name');
        const coordsEl = document.getElementById('selected-location-coords');

        console.log('Confirmation elements:', {
            panel: !!confirmPanel,
            name: !!nameEl, 
            coords: !!coordsEl
        });

        if (confirmPanel && nameEl) {
            nameEl.textContent = name || 'Selected Location';
            // Hide coordinates element
            if (coordsEl) {
                coordsEl.style.display = 'none';
            }
            confirmPanel.style.display = 'block';
        } else {
            console.error('🎯 Missing confirmation elements!');
        }

        // Store pending location
        this.pendingLocation = { lat, lng, name };
        
        // Clear and hide search results
        this.clearLocationResults();
        this.hideLocationResults();
    }

    // Confirm and use selected location
    async confirmSelectedLocation() {
        if (this.pendingLocation) {
            await this.loadLocationFromCoordinates(
                this.pendingLocation.lat,
                this.pendingLocation.lng,
                this.pendingLocation.name
            );
            
            // Close modal
            const modal = document.getElementById('location-modal');
            if (window.modalManager) {
                window.modalManager.closeModal(modal);
            } else {
                this.closeModal(modal);
            }
        }
    }

    // UI updates
    updateLocationDisplay() {
        const locationNameEl = document.getElementById('location-name');
        if (locationNameEl && this.currentLocation) {
            locationNameEl.textContent = this.currentLocation.name;
            locationNameEl.removeAttribute('data-i18n');
        }
    }

    updateURL(lifeGroup = null) {
        if (!this.currentLocation) return;

        const url = new URL(window.location);
        
        // Use coordinate-based parameters with reduced precision
        url.searchParams.set('lat', this.currentLocation.lat.toFixed(3));
        url.searchParams.set('lng', this.currentLocation.lng.toFixed(3));
        url.searchParams.set('name', this.currentLocation.name);
        
        // Remove legacy place_id parameter
        url.searchParams.delete('place_id');
        
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            url.searchParams.set('lang', langSelect.value);
        }
        
        // Handle life_group parameter
        if (lifeGroup !== null) {
            // Only modify life_group if explicitly provided
            if (lifeGroup && lifeGroup !== 'all') {
                url.searchParams.set('life_group', lifeGroup);
                this.saveLifeGroupToStorage(lifeGroup);
            } else {
                url.searchParams.delete('life_group');
                this.saveLifeGroupToStorage(null);
            }
        }
        // If lifeGroup is null, preserve the existing life_group parameter
        
        window.history.replaceState({}, '', url);
    }

    // Modal management
    openLocationModal() {
        const modal = document.getElementById('location-modal');
        if (modal) {
            if (window.modalManager) {
                window.modalManager.openModal(modal);
            } else {
                modal.style.display = 'flex';
            }
            
            // Initialize map when modal opens
            setTimeout(() => {
                if (window.mapManager) {
                    window.mapManager.initializeMap();
                    window.mapManager.invalidateSize();
                }
            }, 100);
            
            const searchInput = document.getElementById('location-search');
            if (searchInput) {
                searchInput.focus();
            }
        }
    }

    openLocationModalOnFirstLoad() {
        // Load default location first, then open modal
        this.loadLocationFromCoordinates(
            this.defaultLocation.lat, 
            this.defaultLocation.lng, 
            this.defaultLocation.name
        ).then(() => {
            // Small delay to ensure the UI is ready
            setTimeout(() => {
                this.openLocationModal();
            }, 500);
        }).catch(error => {
            console.error('Failed to load default location:', error);
            // Open modal anyway for user to select location
            setTimeout(() => {
                this.openLocationModal();
            }, 500);
        });
    }

    openHelpModal() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            if (window.modalManager) {
                window.modalManager.openModal(modal);
            } else {
                modal.style.display = 'flex';
            }
            setTimeout(() => {
                this.updateHelpModalInfo();
            }, 100);
        }
    }

    updateHelpModalInfo() {
        const versionEl = document.getElementById('app-version');
        const lastCheckEl = document.getElementById('last-update-check');
        const updateBtn = document.getElementById('manual-update-btn');
        
        if (versionEl) {
            let version = 'Loading...';
            
            if (window.app && window.app.getAppInfo) {
                try {
                    const appInfo = window.app.getAppInfo();
                    if (appInfo && appInfo.version) {
                        version = appInfo.version;
                    }
                } catch (error) {
                    console.log('Could not get app info:', error);
                }
            }
            
            if (version === 'Loading...' && window.app && window.app.version) {
                version = window.app.version;
            }
            
            versionEl.textContent = version;
        }
        
        if (lastCheckEl && window.app && window.app.getAppInfo) {
            try {
                const appInfo = window.app.getAppInfo();
                if (appInfo && appInfo.lastUpdateCheck) {
                    const lastCheck = new Date(appInfo.lastUpdateCheck);
                    const diffMinutes = Math.floor((Date.now() - lastCheck) / (1000 * 60));
                    
                    let timeText = '';
                    if (diffMinutes >= 1 && diffMinutes < 60) {
                        timeText = window.i18n ? window.i18n.t('help.lastCheck.minutes').replace('{{minutes}}', diffMinutes) : `${diffMinutes}m ago`;
                    } else if (diffMinutes >= 60) {
                        timeText = window.i18n ? window.i18n.t('help.lastCheck.hours').replace('{{hours}}', Math.floor(diffMinutes / 60)) : `${Math.floor(diffMinutes / 60)}h ago`;
                    }
                    
                    if (timeText) {
                        lastCheckEl.textContent = `(${timeText})`;
                    } else {
                        lastCheckEl.textContent = '';
                    }
                }
            } catch (error) {
                console.log('Could not get update check info:', error);
            }
        }
        
        if (updateBtn && !updateBtn.hasAttribute('data-listener-added')) {
            updateBtn.addEventListener('click', () => {
                if (window.app && window.app.manualUpdateCheck) {
                    window.app.manualUpdateCheck();
                }
            });
            updateBtn.setAttribute('data-listener-added', 'true');
        }

        
        if (window.i18n) {
            window.i18n.translatePage();
        }
    }

    closeModal(modal) {
        modal.style.display = 'none';
        const searchInput = modal.querySelector('input');
        if (searchInput) {
            searchInput.value = '';
        }
        const resultsContainer = modal.querySelector('.location-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'block'; // Reset to visible for next time
        }
        
        // Hide confirmation panel
        const confirmPanel = document.getElementById('location-confirm');
        if (confirmPanel) {
            confirmPanel.style.display = 'none';
        }
        
        // Clear pending location
        this.pendingLocation = null;
    }

    // Language management
    setLanguage(lang) {
        
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.value = lang;
        }
        
        if (window.api) {
            window.api.setLocale(lang);
        } else {
            console.warn('🌐 API not available when setting language');
        }
        
        if (window.speciesManager) {
            window.speciesManager.setLocale(lang);
        } else {
            console.warn('🌐 Species manager not available when setting language');
        }
        
        if (window.i18n) {
            window.i18n.setLanguage(lang);
        } else {
            console.warn('🌐 i18n not available when setting language');
        }
    }
    
    changeLanguage(lang) {
        this.setLanguage(lang);
        this.saveLanguageToStorage(lang);
        const urlParams = new URLSearchParams(window.location.search);
        const currentLifeGroup = urlParams.get('life_group');
        this.updateURL(currentLifeGroup);
    }

    handleLocationError() {
        const locationNameEl = document.getElementById('location-name');
        if (locationNameEl) {
            locationNameEl.textContent = window.i18n.t('error.location');
        }
        
        setTimeout(() => {
            this.loadLocationFromCoordinates(
                this.defaultLocation.lat, 
                this.defaultLocation.lng, 
                this.defaultLocation.name
            );
        }, 2000);
    }

    // Utility functions
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public API
    getCurrentLocation() {
        return this.currentLocation;
    }

    getCurrentPlaceId() {
        // For backward compatibility - no longer used
        return null;
    }
    
    updateURLWithLifeGroup(lifeGroup) {
        this.updateURL(lifeGroup);
    }
    
    getCurrentLifeGroup() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('life_group');
    }
}


try {
    window.locationManager = new LocationManager();
} catch (error) {
    console.error('❌ Failed to create LocationManager:', error);
    console.error('❌ Error stack:', error.stack);
}