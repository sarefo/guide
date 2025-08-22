class SpeciesManager {
    constructor() {
        this.currentSpecies = [];
        this.currentFilter = 'all';
        this.currentPlaceId = null;
        this.currentLocale = 'en';
        this.loading = false;
        this.loadTimeout = null;
        this.loadPromise = null; // Track current loading promise
        this.customTaxa = new Map(); // Store multiple custom taxa {id -> {name, rank}}
        this.predefinedIconicTaxa = ['all', '3', '40151', '47126', '47158', '47119', '26036', '20978', '47178', '47170', '47115'];
        this.loadCustomTaxaFromStorage();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupIntersectionObserver();
    }

    setupEventListeners() {
        window.addEventListener('locationChanged', (event) => {
            this.currentPlaceId = event.detail.id;
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

        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const group = e.currentTarget.dataset.group;
                if (group === 'other') {
                    this.openTaxonModal();
                } else {
                    this.setFilter(group);
                }
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
        
        // Cancel any existing loading promise
        if (this.loadPromise) {
            this.loadPromise = null;
        }
        
        // Set loading immediately to prevent multiple calls
        this.loading = true;
        this.showLoadingOverlay();
        
        // Debounce the actual loading by 150ms
        this.loadTimeout = setTimeout(() => {
            this._performLoad();
        }, 150);
    }

    async _performLoad() {
        if (!this.currentPlaceId) return;
        
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
        if (!this.currentPlaceId) return;
        
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
            const options = {
                iconicTaxonId: null,
                taxonId: null,
                locale: this.currentLocale,
                perPage: 50,
                quality: 'research',
                photos: true
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
        
        // No longer automatically remove custom taxa when switching filters
        // Custom taxa persist until explicitly removed by user
        
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.group === group);
        });
        
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

        const wikipediaUrl = species.wikipediaUrl ? 
            window.api.convertWikipediaURL(species.wikipediaUrl) :
            window.api.buildWikipediaSearchURL(species.scientificName, species.name);

        modalBody.innerHTML = `
            <div style="text-align: center;">
                ${hasPhoto ? `
                    <img 
                        src="${photoUrl}" 
                        alt="${species.name}"
                        class="species-modal-image"
                        style="width: min(40vh, 350px); height: min(40vh, 350px); max-width: 100%; object-fit: cover; border-radius: 0.5rem; margin: 0 auto 1rem; display: block;"
                    />
                ` : ''}
                <h2 style="margin-bottom: 1rem;">${species.name}</h2>
                ${species.scientificName !== species.name ? 
                    `<p style="margin-bottom: 1rem;"><strong>${window.i18n.t('species.scientificName')}:</strong> <em>${species.scientificName}</em></p>` : ''
                }
                <div class="modal-actions" style="display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin-bottom: 1rem;">
                    <a href="${wikipediaUrl}" target="_blank" class="modal-action-btn">
                        ${window.i18n.t('modal.wikipedia')}
                    </a>
                    <a href="${species.inatUrl}" target="_blank" class="modal-action-btn">
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

    openTaxonModal() {
        const modal = document.getElementById('taxon-modal');
        const searchInput = document.getElementById('taxon-search');
        const resultsContainer = document.getElementById('taxon-results');
        
        if (!modal || !searchInput || !resultsContainer) return;

        // Clear previous search
        searchInput.value = '';
        resultsContainer.innerHTML = '';
        
        modal.style.display = 'flex';
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

        // Setup modal close functionality
        const closeModal = () => {
            modal.style.display = 'none';
            clearTimeout(searchTimeout);
        };

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
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
                <div class="taxon-result" data-taxon-id="${taxon.id}" data-taxon-name="${buttonName}" data-taxon-rank="${rank}">
                    <div class="taxon-names">
                        ${displayName ? `<div class="taxon-common-name">${displayName}</div>` : ''}
                        <div class="taxon-scientific-name"><em>${scientificName}</em></div>
                    </div>
                    <div class="taxon-rank">${rank}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = resultsHTML;

        // Add click handlers to results
        container.querySelectorAll('.taxon-result').forEach(result => {
            result.addEventListener('click', (e) => {
                const taxonId = e.currentTarget.dataset.taxonId;
                const taxonName = e.currentTarget.dataset.taxonName;
                const taxonRank = e.currentTarget.dataset.taxonRank;
                
                this.selectCustomTaxon(taxonId, taxonName, taxonRank);
                document.getElementById('taxon-modal').style.display = 'none';
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
        const existingCustomBtn = document.querySelector(`.filter-btn[data-group="${taxonId}"]`);
        
        // If button already exists for this taxon, don't recreate it
        if (existingCustomBtn) {
            return;
        }

        // Create new custom filter button
        const filterContainer = document.querySelector('.filter-container');
        const otherBtn = document.querySelector('.filter-btn[data-group="other"]');
        
        if (filterContainer && otherBtn) {
            const customBtn = document.createElement('button');
            customBtn.className = 'filter-btn';
            customBtn.dataset.group = taxonId;
            
            // Ensure capitalization and truncate long names
            const capitalizedName = taxonName ? 
                taxonName.charAt(0).toUpperCase() + taxonName.slice(1) : 
                'Unknown';
            const displayName = capitalizedName.length > 12 ? capitalizedName.substring(0, 12) + '...' : capitalizedName;
            
            customBtn.innerHTML = `
                <span class="filter-icon">🔬</span>
                <span class="filter-text">${displayName}</span>
                <span class="remove-custom" title="Remove filter">&times;</span>
            `;

            // Insert before the "Other" button
            filterContainer.insertBefore(customBtn, otherBtn);

            // Add click handler for the main button
            customBtn.addEventListener('click', (e) => {
                if (!e.target.classList.contains('remove-custom')) {
                    this.setFilter(taxonId);
                }
            });

            // Add click handler for the remove button
            const removeBtn = customBtn.querySelector('.remove-custom');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeCustomTaxon(taxonId);
            });
        }
    }

    removeCustomTaxon(taxonId) {
        // Remove custom taxon from storage
        this.customTaxa.delete(taxonId);
        
        // Save to localStorage
        this.saveCustomTaxaToStorage();
        
        // Remove custom filter button
        const customBtn = document.querySelector(`.filter-btn[data-group="${taxonId}"]`);
        if (customBtn) {
            customBtn.remove();
        }
        
        // If this was the active filter, reset to "all" filter
        if (this.currentFilter === taxonId) {
            this.setFilter('all');
        }
    }

    async restoreCustomTaxonFromURL(taxonId) {
        // If taxon is already in localStorage, don't fetch it again
        if (this.customTaxa.has(taxonId)) {
            console.log(`Custom taxon ${taxonId} already in storage, skipping URL restoration`);
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
                
                console.log(`Restored custom taxon from URL: ${capitalizedName} (${rank})`);
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
                console.log(`Loaded ${taxaArray.length} custom taxa from storage`);
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
            console.log(`Saved ${taxaArray.length} custom taxa to storage`);
        } catch (error) {
            console.error('Failed to save custom taxa to storage:', error);
        }
    }

    createStoredCustomTaxaButtons() {
        // Create buttons for all stored custom taxa
        this.customTaxa.forEach((data, taxonId) => {
            this.addCustomFilterButton(data.name, data.rank, taxonId);
        });
    }
}

window.speciesManager = new SpeciesManager();