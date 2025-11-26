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
        this.currentAbortController = null; // Track current request for cancellation
        this.requestId = 0; // Incremental ID to identify requests
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

            // Update filter button highlights to reflect URL parameter
            const filterButtons = document.querySelectorAll('.filter__btn');
            filterButtons.forEach(btn => {
                btn.classList.toggle('is-active', btn.dataset.group === event.detail.lifeGroup);
            });

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

        // Event delegation for species cards (prevents memory leaks)
        const speciesGrid = document.getElementById('species-grid');
        if (speciesGrid) {
            speciesGrid.addEventListener('click', async (e) => {
                const card = e.target.closest('.species-card');
                if (!card) return;

                const speciesId = card.dataset.speciesId;
                const species = this.currentSpecies.find(s => s.id == speciesId);
                if (species) {
                    await this.showSpeciesModal(species);
                }
            });
        } else {
            console.error('🔧 Species grid not found!');
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

        // Cancel any existing request
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
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

        // Debounce the actual loading
        this.loadTimeout = setTimeout(() => {
            this._performLoad();
        }, window.APP_CONFIG.timing.debounceDelay);
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

    /**
     * Handle offline species loading from cache
     * @private
     */
    _handleOfflineLoad() {
        const cacheLoaded = this.loadCachedSpeciesData();
        if (cacheLoaded) {
            console.log('📦 Loaded species from cache (offline)');
            this.displaySpecies();
            return true;
        }
        console.log('📵 No cached data available for current filter');
        this.showOfflineMessage();
        return true;
    }

    /**
     * Build API options for species loading
     * @private
     */
    _buildSpeciesLoadOptions(signal) {
        const options = {
            iconicTaxonId: null,
            taxonId: null,
            locale: this.currentLocale,
            perPage: window.APP_CONFIG.api.defaultPerPage,
            quality: 'research',
            photos: true,
            locationData: this.currentLocation,
            signal: signal
        };

        if (this.currentFilter !== 'all') {
            if (this.predefinedIconicTaxa.includes(this.currentFilter)) {
                options.iconicTaxonId = this.currentFilter;
            } else {
                options.taxonId = this.currentFilter;
            }
        }

        return options;
    }

    /**
     * Process successful species response
     * @private
     */
    _processSpeciesResponse(speciesData) {
        this.currentSpecies = speciesData.map(species =>
            window.api.formatSpeciesData(species)
        );

        this.cacheSpeciesData();

        this.lastLoadTime = Date.now();
        this.lastLoadLocation = JSON.stringify(this.currentLocation);
        this.lastLoadFilter = this.currentFilter;

        this.displaySpecies();

        if (this.pendingLifeGroupFromURL) {
            this.handlePendingLifeGroupFromURL();
        }
    }

    /**
     * Handle species load error with cache fallback
     * @private
     */
    _handleSpeciesLoadError(error) {
        if (error.name === 'AbortError' || error.message === 'Request cancelled') {
            console.log('🚫 Request aborted');
            return;
        }

        if (navigator.onLine) {
            console.error('Failed to load species:', error);
            const cacheLoaded = this.loadCachedSpeciesData();
            if (cacheLoaded) {
                console.log('📦 Loaded species from cache (API failed)');
                this.displaySpecies();
                return;
            }
        }

        if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message === 'Unable to load species data') {
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

    async _doLoadSpecies() {
        this.currentAbortController = new AbortController();
        const signal = this.currentAbortController.signal;
        const currentRequestId = ++this.requestId;

        try {
            if (!navigator.onLine) {
                return this._handleOfflineLoad();
            }

            const options = this._buildSpeciesLoadOptions(signal);
            const speciesData = await window.api.getSpeciesObservations(
                this.currentLocation.lat,
                this.currentLocation.lng,
                this.currentLocation.radius || window.APP_CONFIG.location.defaultRadius,
                options
            );

            if (currentRequestId !== this.requestId) {
                console.log('🚫 Ignoring stale response from request', currentRequestId);
                return;
            }

            if (signal.aborted) {
                console.log('🚫 Request was aborted');
                return;
            }

            if (speciesData && speciesData.length >= 0) {
                this._processSpeciesResponse(speciesData);
            }
        } catch (error) {
            this._handleSpeciesLoadError(error);
        } finally {
            if (currentRequestId === this.requestId) {
                this.currentAbortController = null;
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

        // Build HTML for all species cards
        const cardsHTML = this.currentSpecies
            .map(species => this.createSpeciesCard(species))
            .join('');

        // Update grid with new cards
        grid.innerHTML = cardsHTML;

        // Ensure grid is visible
        grid.style.display = 'grid';

        // Set up lazy loading for images using IntersectionObserver
        const images = grid.querySelectorAll('img[data-src]');
        images.forEach(img => this.imageObserver.observe(img));

        // Event delegation is set up once in setupEventListeners()
        // No need to add listeners to individual cards here

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
                    <div class="empty-state__icon">🔍</div>
                    <p>${window.i18n.t('species.empty')}</p>
                    <button class="retry-btn" onclick="window.speciesManager.openTaxonModal()">
                        ${window.i18n.t('species.empty.try')}
                    </button>
                </div>
            `;
        }
    }

    /**
     * Build HTML for modal image container
     * @param {Object} species - Species data
     * @returns {string} HTML string for image container
     * @private
     */
    _buildModalImageHTML(species) {
        const mediumPhotoUrl = species.photo?.url;
        const thumbPhotoUrl = species.photo?.thumbUrl;
        const hasPhoto = (mediumPhotoUrl && mediumPhotoUrl !== 'null') || (thumbPhotoUrl && thumbPhotoUrl !== 'null');

        return hasPhoto ? `
            <img
                src="${mediumPhotoUrl || thumbPhotoUrl}"
                alt="${species.name}"
                class="species-dialog__image"
                data-thumb-url="${thumbPhotoUrl || ''}"
            />
            <button class="species-dialog__close" aria-label="Close">&times;</button>
        ` : `
            <div class="species-dialog__placeholder">
                <span>📸 No image available</span>
            </div>
            <button class="species-dialog__close" aria-label="Close">&times;</button>
        `;
    }

    /**
     * Format species display name with proper italics for scientific names
     * @param {Object} species - Species data
     * @returns {Object} Object with displayName (HTML string) and isUsingScientificName (boolean)
     * @private
     */
    _formatSpeciesDisplayName(species) {
        const isUsingScientificName = species.name === species.scientificName ||
                                     species.name.endsWith(' sp.');

        let displayName = species.name;
        if (isUsingScientificName) {
            if (species.name.endsWith(' sp.')) {
                // For genus sp. format, only italicize the genus name, not "sp."
                const genusName = species.name.replace(' sp.', '');
                displayName = `<em>${genusName}</em> sp.`;
            } else {
                // For full scientific names, italicize the entire name
                displayName = `<em>${species.name}</em>`;
            }
        }

        return { displayName, isUsingScientificName };
    }

    /**
     * Build HTML for modal body content
     * @param {Object} species - Species data
     * @param {string} displayName - Formatted display name (may contain HTML)
     * @param {boolean} isUsingScientificName - Whether the display name is scientific
     * @returns {string} HTML string for modal body
     * @private
     */
    _buildModalBodyHTML(species, displayName, isUsingScientificName) {
        return `
            <h2 class="species-dialog__title">${displayName}</h2>
            ${!isUsingScientificName && species.scientificName ?
                `<p class="species-dialog__scientific-name">${species.scientificName}</p>` : ''
            }
            <div class="species-dialog__actions">
                <a class="species-dialog__action-btn species-dialog__action-btn--disabled wiki-btn"
                   title="Loading Wikipedia..."
                   data-original-text="${window.i18n.t('modal.wikipedia')}"
                   onclick="return false;">
                    <svg class="wiki-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" style="animation: spin 1s linear infinite;">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-dasharray="31.416" stroke-dashoffset="31.416">
                            <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                            <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                        </animate>
                    </svg>
                    <span class="wiki-text">${window.i18n.t('modal.wikipedia')}</span>
                </a>
                <a href="${species.inatUrl}" target="_blank" class="species-dialog__action-btn inat-btn">
                    ${window.i18n.t('modal.inaturalist')}
                </a>
            </div>
            ${species.photo?.attribution ? `
                <div class="species-dialog__attribution">
                    ${window.i18n.t('modal.photo.credit')}: ${species.photo.attribution}
                </div>
            ` : ''}
        `;
    }

    /**
     * Set up image fallback handler for modal images
     * @param {HTMLElement} imageContainer - Image container element
     * @private
     */
    _setupImageFallback(imageContainer) {
        const modalImage = imageContainer.querySelector('.species-dialog__image');
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
                    placeholder.className = 'species-dialog__placeholder';
                    placeholder.innerHTML = '<span>📸 Image unavailable offline</span>';
                    placeholder.style.cssText = 'display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #666; min-height: 200px;';
                    this.parentNode.insertBefore(placeholder, this.nextSibling);
                }
            });
        }
    }

    /**
     * Open modal and set up event handlers
     * @param {HTMLElement} modal - Modal element
     * @param {HTMLElement} imageContainer - Image container element
     * @param {Object} species - Species data
     * @private
     */
    _openModalAndSetupHandlers(modal, imageContainer, species) {
        // Use unified modal manager
        if (window.modalManager) {
            window.modalManager.openModal(modal);
        } else {
            modal.style.display = 'flex';
        }

        // Set up offline/online state for action buttons
        this.updateModalActionButtons(modal, navigator.onLine);

        // Close button handler
        const closeBtn = imageContainer.querySelector('.species-dialog__close');
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

    /**
     * Show modal with species details
     * @param {Object} species - Species data to display
     */
    async showSpeciesModal(species) {
        const modal = document.getElementById('species-modal');
        const imageContainer = document.getElementById('species-image-container');
        const modalBody = document.getElementById('modal-body');

        if (!modal || !imageContainer || !modalBody) return;

        // Build and populate image container
        imageContainer.innerHTML = this._buildModalImageHTML(species);

        // Format display name
        const { displayName, isUsingScientificName } = this._formatSpeciesDisplayName(species);

        // Build and populate modal body
        modalBody.innerHTML = this._buildModalBodyHTML(species, displayName, isUsingScientificName);

        // Set up image fallback handler
        this._setupImageFallback(imageContainer);

        // Open modal and set up handlers
        this._openModalAndSetupHandlers(modal, imageContainer, species);
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
                wikiBtn.classList.remove('species-dialog__action-btn--disabled');
                wikiBtn.removeAttribute('title');
                wikiBtn.removeAttribute('onclick');
                
                // Hide spinner and update text
                if (wikiSpinner) {
                    wikiSpinner.style.display = 'none';
                }
                
                // Update button text to indicate language fallback
                let buttonText = originalText;
                const currentLang = window.i18n ? window.i18n.getCurrentLang() : 'en';
                if (!wikipediaResult.isOriginalLang && currentLang !== 'en') {
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
                wikiBtn.classList.add('species-dialog__action-btn--disabled');
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
            wikiBtn.classList.add('species-dialog__action-btn--disabled');
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
        
        const actionBtns = modal.querySelectorAll('.species-dialog__action-btn');
        
        console.log('🔧 Updating modal buttons:', { 
            actionBtns: actionBtns.length, 
            isOnline 
        });
        
        actionBtns.forEach(btn => {
            if (isOnline) {
                btn.classList.remove('species-dialog__action-btn--disabled');
                btn.removeAttribute('title');
            } else {
                if (!btn.classList.contains('wiki-btn') || !btn.querySelector('.wiki-spinner')) {
                    // Don't disable if Wikipedia is still loading
                    btn.classList.add('species-dialog__action-btn--disabled');
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

// Initialize SpeciesManager in App namespace
App.speciesManager = new SpeciesManager();