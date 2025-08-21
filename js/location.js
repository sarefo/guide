class LocationManager {
    constructor() {
        this.currentLocation = null;
        this.defaultPlaceId = 97394; // Global default
        this.init();
    }

    init() {
        this.loadLocationFromURL();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const locationBtn = document.getElementById('location-btn');
        const locationModal = document.getElementById('location-modal');
        const searchInput = document.getElementById('location-search');
        const modalCloses = document.querySelectorAll('.modal-close');
        const languageSelect = document.getElementById('language-select');

        locationBtn?.addEventListener('click', () => this.openLocationModal());
        
        modalCloses.forEach(close => {
            close.addEventListener('click', (e) => {
                const modal = e.target.closest('.location-modal, .species-modal, .share-modal');
                if (modal) this.closeModal(modal);
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
        
        await this.waitForDependencies();
        this.setLanguage(lang);
        this.loadLocation(placeId);
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
            this.updateURL();
            
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
        }
    }

    updateURL() {
        const url = new URL(window.location);
        url.searchParams.set('place_id', this.currentLocation.id);
        
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            url.searchParams.set('lang', langSelect.value);
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
        this.updateURL();
    }

    openLocationModal() {
        const modal = document.getElementById('location-modal');
        if (modal) {
            modal.style.display = 'flex';
            const searchInput = document.getElementById('location-search');
            if (searchInput) {
                searchInput.focus();
            }
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
            resultsContainer.innerHTML = '<p class="no-results">No locations found</p>';
            return;
        }

        const resultsHTML = places.map(place => {
            const name = place.display_name || place.name;
            const adminLevel = place.admin_level ? ` (${place.admin_level})` : '';
            const bbox = place.bounding_box_geojson;
            const coords = bbox ? 
                `${bbox.coordinates[0][0][1].toFixed(2)}, ${bbox.coordinates[0][0][0].toFixed(2)}` : 
                '';

            return `
                <div class="location-result" data-place-id="${place.id}">
                    <div class="location-info">
                        <h3 class="location-result-name">${name}${adminLevel}</h3>
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
        this.closeModal(document.getElementById('location-modal'));
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
            resultsContainer.innerHTML = '<p class="error">Unable to search locations. Please try again.</p>';
        }
    }

    handleLocationError() {
        const locationNameEl = document.getElementById('location-name');
        if (locationNameEl) {
            locationNameEl.textContent = 'Location unavailable';
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
}

window.locationManager = new LocationManager();