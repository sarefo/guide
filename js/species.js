class SpeciesManager {
    constructor() {
        this.currentSpecies = [];
        this.currentFilter = 'all';
        this.currentPlaceId = null;
        this.currentLocale = 'en';
        this.loading = false;
        this.loadTimeout = null;
        this.loadPromise = null; // Track current loading promise
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupIntersectionObserver();
    }

    setupEventListeners() {
        window.addEventListener('locationChanged', (event) => {
            this.currentPlaceId = event.detail.id;
            this.loadSpecies();
        });
        
        window.addEventListener('lifeGroupFromURL', (event) => {
            this.currentFilter = event.detail.lifeGroup;
            this.pendingLifeGroupFromURL = event.detail.lifeGroup;
        });

        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const group = e.currentTarget.dataset.group;
                this.setFilter(group);
            });
        });

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
        
        // Set loading immediately to prevent multiple calls
        this.loading = true;
        this.showLoadingOverlay();
        
        // Debounce the actual loading by 150ms
        this.loadTimeout = setTimeout(() => {
            this.loadSpecies();
        }, 150);
    }

    async loadSpecies() {
        if (!this.currentPlaceId) return;
        
        // If already loading, return the existing promise
        if (this.loadPromise) {
            return this.loadPromise;
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
            const options = {
                iconicTaxonId: this.currentFilter === 'all' ? null : this.currentFilter,
                locale: this.currentLocale,
                perPage: 50,
                quality: 'research',
                photos: true
            };

            const speciesData = await window.api.getSpeciesObservations(this.currentPlaceId, options);
            
            // Only update if we got actual data (not cancelled request)
            if (speciesData && speciesData.length >= 0) {
                this.currentSpecies = speciesData.map(species => 
                    window.api.formatSpeciesData(species)
                );

                this.displaySpecies();
                
                // Handle pending life group from URL
                if (this.pendingLifeGroupFromURL) {
                    this.handlePendingLifeGroupFromURL();
                }
            }
            
        } catch (error) {
            // Don't show error for cancelled requests
            if (error.message !== 'Request cancelled' && error.message !== 'Unable to load species data') {
                console.error('Failed to load species:', error);
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

        const images = grid.querySelectorAll('img[data-src]');
        images.forEach(img => this.imageObserver.observe(img));

        const cards = grid.querySelectorAll('.species-card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                const speciesId = e.currentTarget.dataset.speciesId;
                const species = this.currentSpecies.find(s => s.id == speciesId);
                if (species) {
                    this.showSpeciesModal(species);
                }
            });
        });

        this.hideError();
    }

    createSpeciesCard(species) {
        const photoUrl = species.photo?.thumbUrl || species.photo?.url;
        const hasPhoto = photoUrl && photoUrl !== 'null';
        
        // Capitalize first letter of vernacular name
        const vernacularName = species.name ? 
            species.name.charAt(0).toUpperCase() + species.name.slice(1) : 
            'Unknown species';
            
        // Check if we're using scientific name as fallback (no common name available)
        const isUsingScientificName = species.name === species.scientificName;
        
        return `
            <div class="species-card" data-species-id="${species.id}">
                ${hasPhoto ? `
                    <img 
                        class="species-image" 
                        data-src="${photoUrl}"
                        alt="${vernacularName}"
                        loading="lazy"
                    />
                ` : `
                    <div class="species-image no-photo">
                        <div class="no-photo-icon">📸</div>
                    </div>
                `}
                <div class="species-overlay">
                    <div class="species-name${isUsingScientificName ? ' scientific-name' : ''}">${vernacularName}</div>
                </div>
            </div>
        `;
    }

    setFilter(group) {
        this.currentFilter = group;
        
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.group === group);
        });
        
        // Update URL with new life group
        if (window.locationManager) {
            window.locationManager.updateURLWithLifeGroup(group);
        }

        this.loadSpecies();
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

        if (loading) loading.style.display = 'none';
        if (grid) grid.style.display = 'grid';
    }

    showError() {
        const loading = document.getElementById('loading');
        const grid = document.getElementById('species-grid');
        const error = document.getElementById('error-state');

        if (loading) loading.style.display = 'none';
        if (grid) grid.style.display = 'none';
        if (error) error.style.display = 'flex';
    }

    hideError() {
        const error = document.getElementById('error-state');
        if (error) error.style.display = 'none';
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

        const photoUrl = species.photo?.url || species.photo?.thumbUrl;
        const hasPhoto = photoUrl && photoUrl !== 'null';

        const wikipediaUrl = species.wikipediaUrl || 
            window.api.buildWikipediaSearchURL(species.scientificName, species.name);

        modalBody.innerHTML = `
            ${hasPhoto ? `
                <img 
                    src="${photoUrl}" 
                    alt="${species.name}"
                    class="species-modal-image"
                    style="width: 100%; max-height: 250px; object-fit: cover; border-radius: 0.5rem; margin-bottom: 1rem;"
                />
            ` : ''}
            <h2>${species.name}</h2>
            ${species.scientificName !== species.name ? 
                `<p style="color: #666; margin-bottom: 1rem;"><strong>${window.i18n.t('species.scientificName')}:</strong> <em>${species.scientificName}</em></p>` : ''
            }
            <div class="modal-actions" style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center;">
                <a href="${wikipediaUrl}" target="_blank" class="modal-action-btn">
                    📖 ${window.i18n.t('modal.wikipedia')}
                </a>
                <a href="${species.inatUrl}" target="_blank" class="modal-action-btn">
                    🔍 ${window.i18n.t('modal.inaturalist')}
                </a>
            </div>
            ${species.photo?.attribution ? `
                <div style="margin-top: 1rem; font-size: 0.8rem; color: #666;">
                    ${window.i18n.t('modal.photo.credit')}: ${species.photo.attribution}
                </div>
            ` : ''}
        `;

        modal.style.display = 'flex';

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

        const closeModal = () => {
            modal.style.display = 'none';
        };

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
    }

    setLocale(locale) {
        this.currentLocale = locale;
        if (this.currentPlaceId) {
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
            btn.classList.toggle('active', btn.dataset.group === this.pendingLifeGroupFromURL);
        });
        
        this.pendingLifeGroupFromURL = null;
    }
}

window.speciesManager = new SpeciesManager();