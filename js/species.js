class SpeciesManager {
    constructor() {
        this.currentSpecies = [];
        this.currentFilter = 'all';
        this.currentLocation = null; // Changed from currentPlaceId to currentLocation
        this.currentLocale = 'en';
        this.speciesCache = new Map(); // Cache species data by location+filter key
        this.loading = false;
        this.loadTimeout = null;
        this.loadPromise = null; // Track current loading promise
        this.isShowingOfflineMessage = false; // Track if currently showing offline message
        this.customTaxa = new Map(); // Store multiple custom taxa {id -> {name, rank}}
        this.predefinedIconicTaxa = ['all', '3', '40151', '47126', '47158', '47119', '26036', '20978', '47178', '47170', '47115'];
        this.lastLoadTime = null; // Track when data was last loaded
        this.lastLoadLocation = null; // Track location of last load
        this.lastLoadFilter = null; // Track filter of last load
        this.loadCustomTaxaFromStorage();
        this.init();
        this.setupOnlineOfflineListeners();
    }

    init() {
        this.setupEventListeners();
        this.setupIntersectionObserver();
    }





    setupEventListeners() {
        window.addEventListener('locationChanged', (event) => {
            this.currentLocation = event.detail; // Store full location object with lat/lng/radius
            this.createStoredCustomTaxaButtons();
            this.loadSpecies();
        });
        
        window.addEventListener('lifeGroupFromURL', (event) => {
            
            this.currentFilter = event.detail.lifeGroup;
            this.pendingLifeGroupFromURL = event.detail.lifeGroup;
            
            
            // If this is a custom taxon ID (not in predefined list), we need to fetch its details
            if (!this.predefinedIconicTaxa.includes(event.detail.lifeGroup)) {
                this.restoreCustomTaxonFromURL(event.detail.lifeGroup);
            }
        });

        // Use event delegation for filter buttons (handles dynamic buttons too)
        const filterContainer = document.querySelector('.filter__container');
        if (filterContainer) {
            filterContainer.addEventListener('click', (e) => {
                const filterBtn = e.target.closest('.filter__btn');
                if (!filterBtn) return;
                
                // Handle remove custom button clicks
                if (e.target.classList.contains('filter__remove')) {
                    e.stopPropagation();
                    const taxonId = filterBtn.dataset.group;
                    this.removeCustomTaxon(taxonId);
                    return;
                }
                
                // Handle filter button clicks
                const group = filterBtn.dataset.group;
                if (group === 'other') {
                    this.openTaxonModal();
                } else {
                    this.setFilter(group);
                }
            });
            
            // Initial offline state setup
            this.updateOfflineUiElements(navigator.onLine);
        } else {
            console.error('🔧 Filter container not found!');
        }

        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.loadSpecies();
            });
        }
    }

    setupIntersectionObserver() {
        this.imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.dataset.src;
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                        this.imageObserver.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px'
        });
    }

    debouncedLoadSpecies() {
        
        // Clear any existing timeout
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
        }
        
        // Cancel any existing loading promise
        if (this.loadPromise) {
            this.loadPromise = null;
        }
        
        // Check if we already have fresh data for this location and filter
        if (this.isDataFresh()) {
            console.log('📅 Using fresh species data, skipping reload', {
                speciesCount: this.currentSpecies.length,
                filter: this.currentFilter,
                lastFilter: this.lastLoadFilter
            });
            // Ensure cached data is displayed and error state is hidden
            this.displaySpecies();
            return;
        }

        // Check if we have cached data for this location and filter combination
        if (this.loadCachedSpeciesData()) {
            console.log('📦 Using cached species data');
            this.displaySpecies();
            return;
        }
        
        // Set loading immediately to prevent multiple calls
        this.loading = true;
        this.showLoadingOverlay();
        
        // Debounce the actual loading by 300ms (increased)
        this.loadTimeout = setTimeout(() => {
            this._performLoad();
        }, 300);
    }

    async _performLoad() {
        
        if (!this.currentLocation || !this.currentLocation.lat || !this.currentLocation.lng) {
            console.error('🔄 No valid location for _performLoad');
            return;
        }
        
        // Reset loading state
        this.loading = true;
        this.showLoading();

        // Create and store the loading promise
        this.loadPromise = this._doLoadSpecies();
        
        try {
            await this.loadPromise;
        } finally {
            this.loadPromise = null;
            this.loading = false;
            this.hideLoading();
        }
    }

    async loadSpecies() {
        
        if (!this.currentLocation || !this.currentLocation.lat || !this.currentLocation.lng) {
            console.error('🔄 No valid location for loadSpecies');
            return;
        }
        
        // If already loading, return the existing promise
        if (this.loadPromise) {
            return this.loadPromise;
        }
        
        // If there's a pending debounced load, cancel it and load immediately
        if (this.loadTimeout) {
            clearTimeout(this.loadTimeout);
            this.loadTimeout = null;
        }
        
        this.loading = true;
        this.showLoading();

        // Create and store the loading promise
        this.loadPromise = this._doLoadSpecies();
        
        try {
            await this.loadPromise;
        } finally {
            this.loadPromise = null;
            this.loading = false;
            this.hideLoading();
        }
    }

    async _doLoadSpecies() {
        try {
            // Check if we're offline first
            if (!navigator.onLine) {
                // Try to load from cache when offline
                const cacheLoaded = this.loadCachedSpeciesData();
                if (cacheLoaded) {
                    console.log('📦 Loaded species from cache (offline)');
                    this.displaySpecies();
                    return;
                } else {
                    // No cached data available
                    console.log('📵 No cached data available for current filter');
                    this.showOfflineMessage();
                    return;
                }
            }
            
            const options = {
                iconicTaxonId: null,
                taxonId: null,
                locale: this.currentLocale,
                perPage: 50,
                quality: 'research',
                photos: true,
                locationData: this.currentLocation  // Pass full location data for country detection
            };

            // Determine if we're using iconic taxa or custom taxon
            if (this.currentFilter === 'all') {
                // No filter
            } else if (this.predefinedIconicTaxa.includes(this.currentFilter)) {
                // Use iconic taxon filter
                options.iconicTaxonId = this.currentFilter;
            } else {
                // Use custom taxon filter
                options.taxonId = this.currentFilter;
            }
            

            const speciesData = await window.api.getSpeciesObservations(
                this.currentLocation.lat, 
                this.currentLocation.lng, 
                this.currentLocation.radius || 50, 
                options
            );
            
            // Only update if we got actual data (not cancelled request)
            if (speciesData && speciesData.length >= 0) {
                this.currentSpecies = speciesData.map(species => 
                    window.api.formatSpeciesData(species)
                );

                // Cache the species data
                this.cacheSpeciesData();

                // Update load tracking
                this.lastLoadTime = Date.now();
                this.lastLoadLocation = JSON.stringify(this.currentLocation);
                this.lastLoadFilter = this.currentFilter;

                this.displaySpecies();
                
                // Handle pending life group from URL
                if (this.pendingLifeGroupFromURL) {
                    this.handlePendingLifeGroupFromURL();
                }
            }
            
        } catch (error) {
            // Don't show error for cancelled requests
            if (error.message === 'Request cancelled') {
                return;
            }
            
            // Only log errors when online - offline errors are expected
            if (navigator.onLine) {
                console.error('Failed to load species:', error);
                
                // Try to load from cache as fallback when API fails
                const cacheLoaded = this.loadCachedSpeciesData();
                if (cacheLoaded) {
                    console.log('📦 Loaded species from cache (API failed)');
                    this.displaySpecies();
                    return;
                }
            }
            
            // Check if we're offline and show appropriate message
            if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message === 'Unable to load species data') {
                // Try cache one more time for offline scenarios
                const cacheLoaded = this.loadCachedSpeciesData();
                if (cacheLoaded) {
                    console.log('📦 Loaded species from cache (offline fallback)');
                    this.displaySpecies();
                    return;
                }
                this.showOfflineMessage();
            } else {
                this.showError();
            }
        }
    }

    displaySpecies() {
        const grid = document.getElementById('species-grid');
        if (!grid) return;

        if (this.currentSpecies.length === 0) {
            this.showEmptyState();
            return;
        }

        const speciesHTML = this.currentSpecies.map(species => 
            this.createSpeciesCard(species)
        ).join('');

        grid.innerHTML = speciesHTML;
        
        // Ensure grid is visible
        grid.style.display = 'grid';

        const images = grid.querySelectorAll('img[data-src]');
        images.forEach(img => this.imageObserver.observe(img));

        const cards = grid.querySelectorAll('.species-card');
        cards.forEach(card => {
            card.addEventListener('click', async (e) => {
                const speciesId = e.currentTarget.dataset.speciesId;
                const species = this.currentSpecies.find(s => s.id == speciesId);
                if (species) {
                    await this.showSpeciesModal(species);
                }
            });
        });

        this.hideError();
        
        // Clear offline message flag since we're showing species
        this.isShowingOfflineMessage = false;
        
        // Preload all thumbnails for offline caching
        this.preloadThumbnails();
    }

    preloadThumbnails() {
        // Preload thumbnails for all species in current list for offline caching
        this.currentSpecies.forEach(species => {
            const photoUrl = species.photo?.thumbUrl || species.photo?.url;
            if (photoUrl && photoUrl !== 'null') {
                const img = new Image();
                img.src = photoUrl;
                // No need to do anything with the loaded image - browser will cache it
            }
        });
    }

    createSpeciesCard(species) {
        const photoUrl = species.photo?.thumbUrl || species.photo?.url;
        const hasPhoto = photoUrl && photoUrl !== 'null';
        
        // Handle vernacular name capitalization, accounting for potential HTML
        let vernacularName = species.name || 'Unknown species';
        
        // If it doesn't contain HTML tags, capitalize normally
        if (!vernacularName.includes('<')) {
            vernacularName = vernacularName.charAt(0).toUpperCase() + vernacularName.slice(1);
        }
        // If it contains HTML (like <em>Genus</em> sp.), it's already properly formatted
            
        // Check if we're using scientific name as fallback (no common name available)
        const isUsingScientificName = species.name === species.scientificName;
        
        return `
            <div class="species-card" data-species-id="${species.id}">
                ${hasPhoto ? `
                    <img 
                        class="species-card__image" 
                        data-src="${photoUrl}"
                        alt="${vernacularName}"
                        loading="lazy"
                        onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'species-card__placeholder\\'><div class=\\'species-card__placeholder-text\\'>' + (window.i18n ? window.i18n.t('image.offline') : 'Offline') + '</div></div>';"
                    />
                ` : `
                    <div class="species-card__placeholder species-card__placeholder--no-photo">
                        <div class="species-card__placeholder-icon">📸</div>
                    </div>
                `}
                <div class="species-card__overlay">
                    <div class="species-card__name${isUsingScientificName ? ' species-card__name--scientific' : ''}">${vernacularName}</div>
                    ${!isUsingScientificName && species.scientificName ? `<div class="species-card__scientific">${species.scientificName}</div>` : ''}
                </div>
            </div>
        `;
    }

    setFilter(group) {
        
        this.currentFilter = group;
        
        // No longer automatically remove custom taxa when switching filters
        // Custom taxa persist until explicitly removed by user
        
        const filterButtons = document.querySelectorAll('.filter__btn');
        filterButtons.forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.group === group);
        });
        
        // Ensure filter button content is preserved after class changes
        this.ensureFilterButtonsTranslated();
        
        // Update URL with new life group
        if (window.locationManager) {
            window.locationManager.updateURLWithLifeGroup(group);
        }

        this.debouncedLoadSpecies();
    }

    showLoadingOverlay() {
        const grid = document.getElementById('species-grid');
        if (!grid) return;

        // Create or show loading overlay
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading species...</p>
                </div>
            `;
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                backdrop-filter: blur(2px);
            `;
            
            // Add spinner styles
            const style = document.createElement('style');
            style.textContent = `
                .loading-spinner {
                    text-align: center;
                    color: #2E7D32;
                }
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #2E7D32;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 1rem;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            
            // Make grid container relative for positioning
            grid.style.position = 'relative';
            grid.appendChild(overlay);
        } else {
            overlay.style.display = 'flex';
        }
        
        // Hide error state
        const error = document.getElementById('error-state');
        if (error) error.style.display = 'none';
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    showLoading() {
        const loading = document.getElementById('loading');
        const grid = document.getElementById('species-grid');
        const error = document.getElementById('error-state');

        if (loading) loading.style.display = 'flex';
        if (grid) grid.style.display = 'none';
        if (error) error.style.display = 'none';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        const grid = document.getElementById('species-grid');
        const error = document.getElementById('error-state');

        if (loading) loading.style.display = 'none';
        
        // Only show grid if error state is not visible
        if (grid && (!error || getComputedStyle(error).display === 'none')) {
            grid.style.display = 'grid';
        }
    }

    showError() {
        const loading = document.getElementById('loading');
        const grid = document.getElementById('species-grid');
        const error = document.getElementById('error-state');

        if (loading) loading.style.display = 'none';
        if (grid) grid.style.display = 'none';
        if (error) error.style.display = 'flex';
    }

    showOfflineMessage() {
        const loading = document.getElementById('loading');
        const grid = document.getElementById('species-grid');
        const error = document.getElementById('error-state');
        const loadingOverlay = document.getElementById('loading-overlay');

        // Track that we're showing offline message
        this.isShowingOfflineMessage = true;

        if (loading) loading.style.display = 'none';
        if (grid) grid.style.display = 'none';
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (error) {
            error.style.display = 'flex';
            // Update error message for offline scenario
            const errorText = error.querySelector('p');
            const retryBtn = error.querySelector('#retry-btn');
            if (errorText) {
                errorText.textContent = window.i18n ? 
                    window.i18n.t('notification.offline') : 
                    'You are offline';
            }
            if (retryBtn) {
                retryBtn.textContent = window.i18n ?
                    window.i18n.t('error.retry') :
                    'Retry';
            }
        }
    }

    hideError() {
        const error = document.getElementById('error-state');
        if (error) {
            error.style.display = 'none';
            // Restore original error message
            const errorText = error.querySelector('p');
            const retryBtn = error.querySelector('#retry-btn');
            if (errorText) {
                errorText.textContent = window.i18n ? 
                    window.i18n.t('error.network') : 
                    'Unable to load data. Please check your connection and try again.';
            }
            if (retryBtn) {
                retryBtn.textContent = window.i18n ?
                    window.i18n.t('error.retry') :
                    'Retry';
            }
        }
    }

    showEmptyState() {
        const grid = document.getElementById('species-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>${window.i18n.t('species.empty')}</p>
                    <button class="retry-btn" onclick="window.speciesManager.loadSpecies()">
                        ${window.i18n.t('species.empty.try')}
                    </button>
                </div>
            `;
        }
    }

    async showSpeciesModal(species) {
        const modal = document.getElementById('species-modal');
        const modalBody = document.getElementById('modal-body');
        
        if (!modal || !modalBody) return;

        const mediumPhotoUrl = species.photo?.url;
        const thumbPhotoUrl = species.photo?.thumbUrl;
        const hasPhoto = (mediumPhotoUrl && mediumPhotoUrl !== 'null') || (thumbPhotoUrl && thumbPhotoUrl !== 'null');

        // Open modal immediately with disabled Wikipedia button
        modalBody.innerHTML = `
            <div style="text-align: center;">
                ${hasPhoto ? `
                    <img 
                        src="${mediumPhotoUrl || thumbPhotoUrl}" 
                        alt="${species.name}"
                        class="species-modal__image"
                        data-thumb-url="${thumbPhotoUrl || ''}"
                        style="width: min(40vh, 350px); height: min(40vh, 350px); max-width: 100%; object-fit: cover; border-radius: 0.5rem; margin: 0 auto 1rem; display: block;"
                    />
                ` : ''}
                <h2 style="margin-bottom: 1rem;">${species.name}</h2>
                ${species.scientificName !== species.name ? 
                    `<p style="margin-bottom: 1rem;"><strong>${window.i18n.t('species.scientificName')}:</strong> <em>${species.scientificName}</em></p>` : ''
                }
                <div class="modal-actions" style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-bottom: 1rem;">
                    <a class="modal-action-btn wiki-btn" style="opacity: 0.5; pointer-events: none; cursor: not-allowed;" title="Loading Wikipedia..." data-original-text="${window.i18n.t('modal.wikipedia')}" onclick="return false;">
                        <svg class="wiki-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" style="animation: spin 1s linear infinite; margin-right: 0.5rem;">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                                <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                                <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                            </circle>
                        </svg>
                        <span class="wiki-text">${window.i18n.t('modal.wikipedia')}</span>
                    </a>
                    <a href="${species.inatUrl}" target="_blank" class="modal-action-btn inat-btn">
                        ${window.i18n.t('modal.inaturalist')}
                    </a>
                </div>
                ${species.photo?.attribution ? `
                    <div class="photo-attribution" style="font-size: 0.8rem;">
                        ${window.i18n.t('modal.photo.credit')}: ${species.photo.attribution}
                    </div>
                ` : ''}
            </div>
        `;

        // Set up image fallback handler
        const modalImage = modal.querySelector('.species-modal__image');
        if (modalImage && modalImage.dataset.thumbUrl) {
            modalImage.addEventListener('error', function(e) {
                const thumbUrl = this.dataset.thumbUrl;
                if (thumbUrl && thumbUrl !== 'null' && thumbUrl !== '' && this.src !== thumbUrl) {
                    console.log('📸 Medium image failed, trying thumbnail:', thumbUrl);
                    this.src = thumbUrl;
                    this.style.imageRendering = 'smooth';
                } else {
                    console.log('📸 No thumbnail available, showing placeholder');
                    this.style.display = 'none';
                    const placeholder = document.createElement('div');
                    placeholder.style.cssText = 'width: min(40vh, 350px); height: min(40vh, 350px); max-width: 100%; border-radius: 0.5rem; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #666;';
                    placeholder.innerHTML = '<span>📸 Image unavailable offline</span>';
                    this.parentNode.insertBefore(placeholder, this.nextSibling);
                }
            });
        }

        // Use unified modal manager
        if (window.modalManager) {
            window.modalManager.openModal(modal);
        } else {
            modal.style.display = 'flex';
        }

        const actionBtns = modal.querySelectorAll('.modal-action-btn');
        actionBtns.forEach(btn => {
            btn.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.75rem 1rem;
                background: #2E7D32;
                color: white;
                text-decoration: none;
                border-radius: 0.5rem;
                font-weight: 500;
                transition: background-color 0.2s ease;
            `;
            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#1B5E20';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#2E7D32';
            });
        });

        // Set up offline/online state for action buttons AFTER styling is applied
        this.updateModalActionButtons(modal, navigator.onLine);

        // Close button handler (redundant with global handler but kept for explicitness)
        const closeBtn = modal.querySelector('.modal__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (window.modalManager) {
                    window.modalManager.closeModal(modal);
                } else {
                    modal.style.display = 'none';
                }
            });
        }

        // Check Wikipedia asynchronously after modal is shown
        this.checkAndEnableWikipedia(modal, species);
    }

    async checkAndEnableWikipedia(modal, species) {
        const wikiBtn = modal.querySelector('.wiki-btn');
        if (!wikiBtn) return;

        const wikiSpinner = wikiBtn.querySelector('.wiki-spinner');
        const wikiText = wikiBtn.querySelector('.wiki-text');
        const originalText = wikiBtn.dataset.originalText || window.i18n.t('modal.wikipedia');

        // Ensure spinner is visible while loading
        if (wikiSpinner) {
            wikiSpinner.style.display = 'inline-block';
        }

        try {
            // Check for the best Wikipedia URL (with language fallback)
            const wikipediaResult = await window.api.findBestWikipediaUrl(species);
            
            if (wikipediaResult) {
                // Enable the Wikipedia button
                wikiBtn.href = wikipediaResult.url;
                wikiBtn.target = '_blank';
                wikiBtn.style.opacity = '1';
                wikiBtn.style.pointerEvents = 'auto';
                wikiBtn.style.cursor = 'pointer';
                wikiBtn.removeAttribute('title');
                wikiBtn.removeAttribute('onclick');
                
                // Hide spinner and update text
                if (wikiSpinner) {
                    wikiSpinner.style.display = 'none';
                }
                
                // Update button text to indicate language fallback
                let buttonText = originalText;
                if (!wikipediaResult.isOriginalLang) {
                    buttonText = `${originalText} (${wikipediaResult.lang.toUpperCase()})`;
                }
                
                if (wikiText) {
                    wikiText.textContent = buttonText;
                } else {
                    wikiBtn.innerHTML = buttonText;
                }
                
                console.log('✅ Wikipedia button enabled:', {
                    url: wikipediaResult.url,
                    lang: wikipediaResult.lang,
                    fallback: !wikipediaResult.isOriginalLang,
                    buttonText
                });
            } else {
                // No Wikipedia article found - disable the button
                wikiBtn.removeAttribute('href');
                wikiBtn.removeAttribute('target');
                wikiBtn.setAttribute('onclick', 'return false;');
                wikiBtn.style.opacity = '0.5';
                wikiBtn.style.pointerEvents = 'none';
                wikiBtn.style.cursor = 'not-allowed';
                wikiBtn.setAttribute('title', 'No Wikipedia article found');
                
                // Hide spinner and show disabled state
                if (wikiSpinner) {
                    wikiSpinner.style.display = 'none';
                }
                
                if (wikiText) {
                    wikiText.textContent = originalText;
                } else {
                    wikiBtn.innerHTML = originalText;
                }
                
                console.log('❌ No Wikipedia article found - button disabled');
            }
        } catch (error) {
            console.error('Error checking Wikipedia:', error);
            // On error, disable the button
            wikiBtn.removeAttribute('href');
            wikiBtn.removeAttribute('target');
            wikiBtn.setAttribute('onclick', 'return false;');
            wikiBtn.style.opacity = '0.5';
            wikiBtn.style.pointerEvents = 'none';
            wikiBtn.style.cursor = 'not-allowed';
            wikiBtn.setAttribute('title', 'Wikipedia check failed');
            
            // Hide spinner and show error state
            if (wikiSpinner) {
                wikiSpinner.style.display = 'none';
            }
            
            if (wikiText) {
                wikiText.textContent = originalText;
            } else {
                wikiBtn.innerHTML = originalText;
            }
        }
    }

    setLocale(locale) {
        this.currentLocale = locale;
        if (this.currentLocation) {
            this.loadSpecies();
        }
    }

    getCurrentSpecies() {
        return this.currentSpecies;
    }

    getCurrentFilter() {
        return this.currentFilter;
    }
    
    handlePendingLifeGroupFromURL() {
        if (!this.pendingLifeGroupFromURL) return;
        
        // Set the filter UI state without reloading species (already loaded)
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.group === this.pendingLifeGroupFromURL);
        });
        
        this.pendingLifeGroupFromURL = null;
    }

    openTaxonModal() {
        // Block taxon modal when offline
        if (!navigator.onLine) {
            this.showOfflineNotification('search');
            return;
        }
        
        const modal = document.getElementById('taxon-modal');
        const searchInput = document.getElementById('taxon-search');
        const resultsContainer = document.getElementById('taxon-results');
        
        if (!modal || !searchInput || !resultsContainer) return;

        // Clear previous search
        searchInput.value = '';
        resultsContainer.innerHTML = '';
        
        // Use unified modal manager
        if (window.modalManager) {
            window.modalManager.openModal(modal);
        } else {
            modal.style.display = 'flex';
        }
        searchInput.focus();

        // Setup search functionality
        let searchTimeout;
        const handleSearch = async (query) => {
            if (query.length < 2) {
                resultsContainer.innerHTML = '';
                return;
            }

            try {
                const taxa = await window.api.searchTaxa(query, 20, this.currentLocale);
                this.displayTaxonResults(taxa, resultsContainer);
            } catch (error) {
                console.error('Taxon search failed:', error);
                resultsContainer.innerHTML = '<div class="search-error">Search failed. Please try again.</div>';
            }
        };

        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => handleSearch(e.target.value.trim()), 300);
        });

        // Close button handler (redundant with global handler but kept for explicitness)
        const closeBtn = modal.querySelector('.modal__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearTimeout(searchTimeout);
                if (window.modalManager) {
                    window.modalManager.closeModal(modal);
                } else {
                    modal.style.display = 'none';
                }
            });
        }
    }

    displayTaxonResults(taxa, container) {
        if (!taxa || taxa.length === 0) {
            container.innerHTML = '<div class="no-results">No taxa found</div>';
            return;
        }

        const resultsHTML = taxa.map(taxon => {
            // Get vernacular name with locale preference
            let vernacularName = '';
            if (taxon.preferred_common_name) {
                vernacularName = taxon.preferred_common_name;
            } else if (taxon.names && taxon.names.length > 0) {
                // Look for a name in current locale
                const localName = taxon.names.find(name => 
                    name.locale === this.currentLocale || 
                    name.locale?.startsWith(this.currentLocale)
                );
                if (localName) {
                    vernacularName = localName.name;
                } else {
                    // Fallback to first common name or english
                    const fallbackName = taxon.names.find(name => name.locale === 'en') || taxon.names[0];
                    vernacularName = fallbackName ? fallbackName.name : '';
                }
            } else if (taxon.english_common_name) {
                vernacularName = taxon.english_common_name;
            }
            
            // Capitalize first letter of vernacular name
            const displayName = vernacularName ? 
                vernacularName.charAt(0).toUpperCase() + vernacularName.slice(1) : '';
            
            const scientificName = taxon.name || '';
            const rank = taxon.rank || '';
            
            // Use display name for button, fallback to scientific name
            const buttonName = displayName || scientificName;
            
            return `
                <div class="search-results__item search-results__item--taxon" data-taxon-id="${taxon.id}" data-taxon-name="${buttonName}" data-taxon-rank="${rank}">
                    <div class="search-results__names">
                        ${displayName ? `<div class="search-results__primary-name">${displayName}</div>` : ''}
                        <div class="search-results__secondary-name"><em>${scientificName}</em></div>
                    </div>
                    <div class="search-results__rank">${rank}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = resultsHTML;

        // Add click handlers to results
        container.querySelectorAll('.search-results__item--taxon').forEach(result => {
            result.addEventListener('click', (e) => {
                const taxonId = e.currentTarget.dataset.taxonId;
                const taxonName = e.currentTarget.dataset.taxonName;
                const taxonRank = e.currentTarget.dataset.taxonRank;
                
                this.selectCustomTaxon(taxonId, taxonName, taxonRank);
                const taxonModal = document.getElementById('taxon-modal');
                if (window.modalManager) {
                    window.modalManager.closeModal(taxonModal);
                } else {
                    taxonModal.style.display = 'none';
                }
            });
        });
    }

    async selectCustomTaxon(taxonId, taxonName, taxonRank) {
        try {
            // Fetch full taxon details with current locale to get proper vernacular name
            const taxonData = await window.api.getTaxonDetails(taxonId, this.currentLocale);
            const taxon = taxonData.results?.[0] || taxonData;
            
            let finalName = taxonName; // fallback to passed name
            let finalRank = taxonRank;
            
            if (taxon) {
                // Get vernacular name with locale preference
                let vernacularName = '';
                if (taxon.preferred_common_name) {
                    vernacularName = taxon.preferred_common_name;
                } else if (taxon.names && taxon.names.length > 0) {
                    // Look for a name in current locale
                    const localName = taxon.names.find(name => 
                        name.locale === this.currentLocale || 
                        name.locale?.startsWith(this.currentLocale)
                    );
                    if (localName) {
                        vernacularName = localName.name;
                    } else {
                        // Fallback to english or first available
                        const fallbackName = taxon.names.find(name => name.locale === 'en') || taxon.names[0];
                        vernacularName = fallbackName ? fallbackName.name : '';
                    }
                } else if (taxon.english_common_name) {
                    vernacularName = taxon.english_common_name;
                }
                
                // Use vernacular name if available, otherwise scientific name
                finalName = vernacularName || taxon.name || taxonName;
                finalRank = taxon.rank || taxonRank;
                
                // Capitalize first letter
                if (finalName) {
                    finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
                }
            }
            
            // Store the custom taxon
            this.customTaxa.set(taxonId, { name: finalName, rank: finalRank });
            
            // Save to localStorage
            this.saveCustomTaxaToStorage();
            
            // Create custom filter button if it doesn't exist
            this.addCustomFilterButton(finalName, finalRank, taxonId);
            
            // Set filter and load species
            this.setFilter(taxonId);
            
        } catch (error) {
            console.error('Failed to fetch taxon details for custom selection:', error);
            
            // Fallback: use the passed name and rank with capitalization
            const capitalizedName = taxonName ? 
                taxonName.charAt(0).toUpperCase() + taxonName.slice(1) : 
                `Taxon ${taxonId}`;
            
            // Store the custom taxon with fallback data
            this.customTaxa.set(taxonId, { name: capitalizedName, rank: taxonRank });
            
            // Save to localStorage
            this.saveCustomTaxaToStorage();
            
            // Create custom filter button
            this.addCustomFilterButton(capitalizedName, taxonRank, taxonId);
            
            // Set filter and load species
            this.setFilter(taxonId);
        }
    }

    addCustomFilterButton(taxonName, taxonRank, taxonId) {
        // Check if this taxon already has a button
        const existingCustomBtn = document.querySelector(`.filter__btn[data-group="${taxonId}"]`);
        
        // If button already exists for this taxon, don't recreate it
        if (existingCustomBtn) {
            return;
        }

        // Create new custom filter button
        const filterContainer = document.querySelector('.filter__container');
        const otherBtn = document.querySelector('.filter__btn[data-group="other"]');
        
        if (filterContainer && otherBtn) {
            const customBtn = document.createElement('button');
            customBtn.className = 'filter__btn';
            customBtn.dataset.group = taxonId;
            
            // Ensure capitalization and truncate long names
            const capitalizedName = taxonName ? 
                taxonName.charAt(0).toUpperCase() + taxonName.slice(1) : 
                'Unknown';
            const displayName = capitalizedName.length > 12 ? capitalizedName.substring(0, 12) + '...' : capitalizedName;
            
            customBtn.innerHTML = `
                <span class="filter__icon">◯</span>
                <span class="filter__text">${displayName}</span>
                <span class="filter__remove" title="Remove filter">&times;</span>
            `;

            // Insert before the "Other" button
            filterContainer.insertBefore(customBtn, otherBtn);
            
            // Ensure all filter button translations are preserved after DOM manipulation
            this.ensureFilterButtonsTranslated();
        }
    }

    removeCustomTaxon(taxonId) {
        // Remove custom taxon from storage
        this.customTaxa.delete(taxonId);
        
        // Save to localStorage
        this.saveCustomTaxaToStorage();
        
        // Remove custom filter button
        const customBtn = document.querySelector(`.filter__btn[data-group="${taxonId}"]`);
        if (customBtn) {
            customBtn.remove();
        }
        
        // If this was the active filter, reset to "all" filter
        if (this.currentFilter === taxonId) {
            this.setFilter('all');
        }
        
        // Ensure all filter button translations are preserved after DOM manipulation
        this.ensureFilterButtonsTranslated();
    }

    async restoreCustomTaxonFromURL(taxonId) {
        // If taxon is already in localStorage, don't fetch it again
        if (this.customTaxa.has(taxonId)) {
            return;
        }

        try {
            // Fetch taxon details with current locale to get its name
            const taxonData = await window.api.getTaxonDetails(taxonId, this.currentLocale);
            const taxon = taxonData.results?.[0] || taxonData;
            
            if (taxon) {
                // Get vernacular name with locale preference
                let vernacularName = '';
                if (taxon.preferred_common_name) {
                    vernacularName = taxon.preferred_common_name;
                } else if (taxon.names && taxon.names.length > 0) {
                    // Look for a name in current locale
                    const localName = taxon.names.find(name => 
                        name.locale === this.currentLocale || 
                        name.locale?.startsWith(this.currentLocale)
                    );
                    if (localName) {
                        vernacularName = localName.name;
                    } else {
                        // Fallback to english or first available
                        const fallbackName = taxon.names.find(name => name.locale === 'en') || taxon.names[0];
                        vernacularName = fallbackName ? fallbackName.name : '';
                    }
                } else if (taxon.english_common_name) {
                    vernacularName = taxon.english_common_name;
                }
                
                // Use vernacular name if available, otherwise scientific name
                const finalName = vernacularName || taxon.name;
                const rank = taxon.rank || 'Unknown';
                
                // Capitalize first letter
                const capitalizedName = finalName ? 
                    finalName.charAt(0).toUpperCase() + finalName.slice(1) : 
                    `Taxon ${taxonId}`;
                
                // Store the custom taxon
                this.customTaxa.set(taxonId, { 
                    name: capitalizedName, 
                    rank: rank 
                });
                
                // Save to localStorage
                this.saveCustomTaxaToStorage();
                
                // Create the custom filter button
                this.addCustomFilterButton(capitalizedName, rank, taxonId);
                
            }
        } catch (error) {
            console.error('Failed to restore custom taxon from URL:', error);
            // If we can't get the taxon details, still proceed but with generic name
            this.customTaxa.set(taxonId, { 
                name: `Taxon ${taxonId}`, 
                rank: 'Unknown' 
            });
            this.saveCustomTaxaToStorage();
            this.addCustomFilterButton(`Taxon ${taxonId}`, 'Unknown', taxonId);
        }
    }

    loadCustomTaxaFromStorage() {
        try {
            const stored = localStorage.getItem('biodiversity_custom_taxa');
            if (stored) {
                const taxaArray = JSON.parse(stored);
                taxaArray.forEach(taxon => {
                    this.customTaxa.set(taxon.id, { name: taxon.name, rank: taxon.rank });
                });
            }
        } catch (error) {
            console.error('Failed to load custom taxa from storage:', error);
        }
    }

    saveCustomTaxaToStorage() {
        try {
            const taxaArray = Array.from(this.customTaxa.entries()).map(([id, data]) => ({
                id: id,
                name: data.name,
                rank: data.rank
            }));
            localStorage.setItem('biodiversity_custom_taxa', JSON.stringify(taxaArray));
        } catch (error) {
            console.error('Failed to save custom taxa to storage:', error);
        }
    }

    createStoredCustomTaxaButtons() {
        // Create buttons for all stored custom taxa
        this.customTaxa.forEach((data, taxonId) => {
            this.addCustomFilterButton(data.name, data.rank, taxonId);
        });
        
        // Ensure all filter button translations are properly applied
        this.ensureFilterButtonsTranslated();
    }

    isDataFresh() {
        // Check if we have recent data for the same location and filter
        if (!this.lastLoadTime || !this.currentLocation) {
            return false;
        }
        
        // Data is fresh if:
        // 1. Loaded within last 7 days
        // 2. Same location (within reasonable precision)
        // 3. Same filter
        const timeSinceLoad = Date.now() - this.lastLoadTime;
        const dataAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        const sameLocation = this.lastLoadLocation === JSON.stringify(this.currentLocation);
        const sameFilter = this.lastLoadFilter === this.currentFilter;
        
        return timeSinceLoad < dataAge && sameLocation && sameFilter && this.currentSpecies.length > 0;
    }

    ensureFilterButtonsTranslated() {
        // Ensure all filter buttons have proper text content
        // This prevents the "All" button and others from becoming empty
        const filterButtons = document.querySelectorAll('.filter__btn[data-group]');
        filterButtons.forEach(btn => {
            const filterTextSpan = btn.querySelector('.filter-text[data-i18n]');
            if (filterTextSpan) {
                const key = filterTextSpan.getAttribute('data-i18n');
                if (window.i18n && key) {
                    const translation = window.i18n.t(key);
                    if (translation && translation !== key && filterTextSpan.textContent !== translation) {
                        filterTextSpan.textContent = translation;
                    }
                }
            }
            
            // Special check for the "All" button if it somehow lost content
            if (btn.dataset.group === 'all' && (!btn.textContent.trim() || btn.textContent.trim() === '')) {
                const icon = btn.querySelector('.filter-icon');
                const text = btn.querySelector('.filter-text');
                if (!icon || !text) {
                    // Recreate the button structure if it was corrupted
                    btn.innerHTML = `
                        <span class="filter-icon">🌈</span>
                        <span class="filter-text" data-i18n="filter.all">All</span>
                    `;
                    // Re-apply translation
                    if (window.i18n) {
                        const textSpan = btn.querySelector('.filter-text');
                        if (textSpan) {
                            textSpan.textContent = window.i18n.t('filter.all');
                        }
                    }
                }
            }
        });
    }

    getCacheKey() {
        if (!this.currentLocation) return null;
        return `${JSON.stringify(this.currentLocation)}_${this.currentFilter}`;
    }

    cacheSpeciesData() {
        const cacheKey = this.getCacheKey();
        if (!cacheKey) return;
        
        const cacheData = {
            species: [...this.currentSpecies], // Deep copy
            timestamp: Date.now()
        };
        
        // Save to cache service (both memory and IndexedDB)
        window.cacheService.set(cacheKey, cacheData);
        
        // Also save to local cache for backward compatibility
        this.speciesCache.set(cacheKey, cacheData);
    }

    loadCachedSpeciesData() {
        const cacheKey = this.getCacheKey();
        if (!cacheKey) return false;
        
        // Try cache service first, fallback to local cache
        let cached = window.cacheService.get(cacheKey);
        if (!cached) {
            cached = this.speciesCache.get(cacheKey);
            if (!cached) return false;
            
            // Check if local cache is still valid (within 7 days)
            const cacheAge = Date.now() - cached.timestamp;
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
            if (cacheAge > maxAge) {
                this.speciesCache.delete(cacheKey);
                return false;
            }
        }
        
        // Load cached species data
        this.currentSpecies = cached.data ? cached.data.species : cached.species;
        return true;
    }

    setupOnlineOfflineListeners() {
        // Listen for online event
        window.addEventListener('online', () => {
            console.log('📶 App went online');
            this.updateOfflineUiElements(true);
            this.updateAllModalActionButtons(true);
            // Only reload if we're currently showing an offline message
            if (this.isShowingOfflineMessage) {
                console.log('🔄 Auto-reloading offline group now that we\'re online');
                this.loadSpecies();
            }
        });

        // Listen for offline event
        window.addEventListener('offline', () => {
            console.log('📵 App went offline');
            this.updateOfflineUiElements(false);
            this.updateAllModalActionButtons(false);
        });
    }
    
    updateOfflineUiElements(isOnline) {
        // Update "other" filter button state
        const otherBtn = document.querySelector('.filter__btn[data-group="other"]');
        if (otherBtn) {
            if (isOnline) {
                otherBtn.disabled = false;
                otherBtn.style.opacity = '1';
                otherBtn.style.pointerEvents = 'auto';
            } else {
                otherBtn.disabled = true;
                otherBtn.style.opacity = '0.5';
                otherBtn.style.pointerEvents = 'none';
            }
        }
    }
    
    showOfflineNotification(feature) {
        const messages = {
            search: window.i18n ? window.i18n.t('notification.offline.search') : 'Search requires internet connection',
            cache: window.i18n ? window.i18n.t('notification.offline.cache') : 'Caching requires internet connection',
            language: window.i18n ? window.i18n.t('notification.offline.language') : 'Language change requires internet connection'
        };
        
        const message = messages[feature] || messages.search;
        
        if (window.app) {
            window.app.showNotification(message, 'warning');
        } else {
            console.warn(message);
        }
    }

    updateModalActionButtons(modal, isOnline) {
        if (!modal) {
            console.log('❌ No modal provided to updateModalActionButtons');
            return;
        }
        
        const wikiBtn = modal.querySelector('.wiki-btn');
        const inatBtn = modal.querySelector('.inat-btn');
        
        console.log('🔧 Updating modal buttons:', { 
            wikiBtn: !!wikiBtn, 
            inatBtn: !!inatBtn, 
            isOnline 
        });
        
        [wikiBtn, inatBtn].forEach(btn => {
            if (btn) {
                if (isOnline) {
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                    btn.style.cursor = 'pointer';
                    btn.removeAttribute('title');
                } else {
                    btn.style.opacity = '0.5';
                    btn.style.pointerEvents = 'none';
                    btn.style.cursor = 'not-allowed';
                    btn.setAttribute('title', 'Requires internet connection');
                }
            }
        });
    }

    updateAllModalActionButtons(isOnline) {
        // Update buttons in currently open species modal
        const speciesModal = document.getElementById('species-modal');
        if (speciesModal) {
            // Check if modal is visible using multiple methods
            const isVisible = speciesModal.style.display === 'flex' || 
                             speciesModal.style.display === 'block' ||
                             (window.getComputedStyle && window.getComputedStyle(speciesModal).display !== 'none') ||
                             speciesModal.offsetParent !== null;
            
            if (isVisible) {
                console.log('📱 Updating modal buttons, online:', isOnline);
                this.updateModalActionButtons(speciesModal, isOnline);
            }
        }
    }
}

window.speciesManager = new SpeciesManager();