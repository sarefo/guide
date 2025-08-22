console.log('📂 location.js script loading...');

class LocationManager {
    constructor() {
        console.log('🏗️ LocationManager constructor called');
        this.currentLocation = null;
        this.defaultPlaceId = 97394; // Global default
        this.init();
    }

    init() {
        console.log('🌍 LocationManager initializing...');
        this.loadLocationFromURL();
        this.setupEventListeners();
        
        // Manual test - try to find help button after a delay
        setTimeout(() => {
            const helpBtn = document.getElementById('help-btn');
            console.log('🔍 Delayed help button check:', helpBtn);
            if (helpBtn) {
                console.log('✅ Help button available after delay');
                // Add a manual test function to window
                window.testHelpButton = () => {
                    console.log('🧪 Manual help button test');
                    this.openHelpModal();
                };
                console.log('🧪 You can now run: window.testHelpButton() in console');
            }
        }, 1000);
    }

    setupEventListeners() {
        console.log('🔧 LocationManager setupEventListeners called');
        const locationBtn = document.getElementById('location-btn');
        const locationName = document.getElementById('location-name');
        const locationModal = document.getElementById('location-modal');
        const searchInput = document.getElementById('location-search');
        const modalCloses = document.querySelectorAll('.modal-close');
        const languageSelect = document.getElementById('language-select');
        const helpBtn = document.getElementById('help-btn');

        console.log('🔍 Element check:');
        console.log('  locationBtn:', locationBtn);
        console.log('  helpBtn:', helpBtn);
        console.log('  locationModal:', locationModal);

        locationBtn?.addEventListener('click', () => this.openLocationModal());
        locationName?.addEventListener('click', () => this.openLocationModal());
        
        if (helpBtn) {
            console.log('✅ Help button found, adding event listener...');
            helpBtn.addEventListener('click', (e) => {
                console.log('💡 Help button clicked via location.js!', e);
                this.openHelpModal();
            });
        } else {
            console.error('❌ Help button NOT found in setupEventListeners');
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

        searchInput?.addEventListener('input', (e) => {
            this.debounce(() => this.searchLocations(e.target.value), 300)();
        });

        window.addEventListener('popstate', () => {
            this.loadLocationFromURL();
        });
        
        languageSelect?.addEventListener('change', (e) => {
            this.changeLanguage(e.target.value);
        });
    }

    async loadLocationFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const placeId = urlParams.get('place_id') || this.defaultPlaceId;
        const lang = urlParams.get('lang') || 'en';
        const lifeGroup = urlParams.get('life_group');
        
        await this.waitForDependencies();
        this.setLanguage(lang);
        this.loadLocation(placeId);
        
        // Notify about life group selection if present
        if (lifeGroup) {
            window.dispatchEvent(new CustomEvent('lifeGroupFromURL', {
                detail: { lifeGroup }
            }));
        }
    }
    
    async waitForDependencies() {
        const maxWait = 3000; // 3 seconds
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

    async loadLocation(placeId) {
        try {
            const locationData = await window.api.getPlace(placeId);
            
            this.currentLocation = {
                id: placeId,
                name: locationData.display_name || locationData.name,
                data: locationData
            };
            
            this.updateLocationDisplay();
            
            // Preserve life_group parameter when updating URL during location load
            const urlParams = new URLSearchParams(window.location.search);
            const currentLifeGroup = urlParams.get('life_group');
            this.updateURL(currentLifeGroup);
            
            window.dispatchEvent(new CustomEvent('locationChanged', {
                detail: this.currentLocation
            }));
            
        } catch (error) {
            console.error('Failed to load location:', error);
            this.handleLocationError();
        }
    }

    updateLocationDisplay() {
        const locationNameEl = document.getElementById('location-name');
        if (locationNameEl && this.currentLocation) {
            locationNameEl.textContent = this.currentLocation.name;
            // Remove data-i18n attribute to prevent i18n system from overwriting this content
            locationNameEl.removeAttribute('data-i18n');
        }
    }

    updateURL(lifeGroup = null) {
        const url = new URL(window.location);
        url.searchParams.set('place_id', this.currentLocation.id);
        
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            url.searchParams.set('lang', langSelect.value);
        }
        
        // Handle life_group parameter
        if (lifeGroup && lifeGroup !== 'all') {
            url.searchParams.set('life_group', lifeGroup);
        } else {
            url.searchParams.delete('life_group');
        }
        
        window.history.replaceState({}, '', url);
    }

    setLanguage(lang) {
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.value = lang;
        }
        
        if (window.api) {
            window.api.setLocale(lang);
        }
        
        if (window.speciesManager) {
            window.speciesManager.setLocale(lang);
        }
        
        if (window.i18n) {
            window.i18n.setLanguage(lang);
        }
    }
    
    changeLanguage(lang) {
        this.setLanguage(lang);
        // Preserve current life group when changing language
        const urlParams = new URLSearchParams(window.location.search);
        const currentLifeGroup = urlParams.get('life_group');
        this.updateURL(currentLifeGroup);
    }

    openLocationModal() {
        const modal = document.getElementById('location-modal');
        if (modal) {
            // Use unified modal manager
            if (window.modalManager) {
                window.modalManager.openModal(modal);
            } else {
                modal.style.display = 'flex';
            }
            const searchInput = document.getElementById('location-search');
            if (searchInput) {
                searchInput.focus();
            }
        }
    }

    openHelpModal() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            // Use unified modal manager
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
        
        if (window.app && window.app.getAppInfo) {
            try {
                const appInfo = window.app.getAppInfo();
                
                if (versionEl && appInfo.version) {
                    versionEl.textContent = appInfo.version;
                }
                
                if (lastCheckEl && appInfo.lastUpdateCheck) {
                    const lastCheck = new Date(appInfo.lastUpdateCheck);
                    const diffMinutes = Math.floor((Date.now() - lastCheck) / (1000 * 60));
                    
                    let timeText = '';
                    if (diffMinutes < 1) {
                        timeText = 'Just checked';
                    } else if (diffMinutes < 60) {
                        timeText = `${diffMinutes}m ago`;
                    } else {
                        timeText = `${Math.floor(diffMinutes / 60)}h ago`;
                    }
                    
                    lastCheckEl.textContent = `(${timeText})`;
                }
            } catch (error) {
                // Silently fail
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
        }
    }

    async searchLocations(query) {
        if (!query || query.length < 2) {
            this.clearLocationResults();
            return;
        }

        try {
            const places = await window.api.searchPlaces(query);
            this.displayLocationResults(places);
        } catch (error) {
            console.error('Location search failed:', error);
            this.displayLocationError();
        }
    }

    displayLocationResults(places) {
        const resultsContainer = document.getElementById('location-results');
        if (!resultsContainer) return;

        if (!places || places.length === 0) {
            resultsContainer.innerHTML = `<p class="no-results">${window.i18n.t('location.results.empty')}</p>`;
            return;
        }

        const resultsHTML = places.map(place => {
            const name = place.display_name || place.name;
            const bbox = place.bounding_box_geojson;
            const coords = bbox ? 
                `${bbox.coordinates[0][0][1].toFixed(2)}, ${bbox.coordinates[0][0][0].toFixed(2)}` : 
                '';

            return `
                <div class="location-result" data-place-id="${place.id}">
                    <div class="location-info">
                        <h3 class="location-result-name">${name}</h3>
                        ${coords ? `<p class="location-coords">${coords}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = resultsHTML;

        resultsContainer.addEventListener('click', (e) => {
            const resultEl = e.target.closest('.location-result');
            if (resultEl) {
                const placeId = resultEl.dataset.placeId;
                this.selectLocation(placeId);
            }
        });
    }

    selectLocation(placeId) {
        this.loadLocation(placeId);
        const modal = document.getElementById('location-modal');
        if (window.modalManager) {
            window.modalManager.closeModal(modal);
        } else {
            this.closeModal(modal);
        }
    }

    clearLocationResults() {
        const resultsContainer = document.getElementById('location-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
    }

    displayLocationError() {
        const resultsContainer = document.getElementById('location-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `<p class="error">${window.i18n.t('location.results.error')}</p>`;
        }
    }

    handleLocationError() {
        const locationNameEl = document.getElementById('location-name');
        if (locationNameEl) {
            locationNameEl.textContent = window.i18n.t('error.location');
        }
        
        setTimeout(() => {
            this.loadLocation(this.defaultPlaceId);
        }, 2000);
    }

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

    getCurrentLocation() {
        return this.currentLocation;
    }

    getCurrentPlaceId() {
        return this.currentLocation?.id || this.defaultPlaceId;
    }
    
    updateURLWithLifeGroup(lifeGroup) {
        this.updateURL(lifeGroup);
    }
    
    getCurrentLifeGroup() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('life_group');
    }
}

console.log('📂 About to create LocationManager...');
console.log('📂 Window object available:', typeof window);
console.log('📂 Document ready state:', document.readyState);

try {
    console.log('📍 Creating LocationManager...');
    window.locationManager = new LocationManager();
    console.log('✅ LocationManager created successfully');
    console.log('✅ window.locationManager:', window.locationManager);
} catch (error) {
    console.error('❌ Failed to create LocationManager:', error);
    console.error('❌ Error stack:', error.stack);
}