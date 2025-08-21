class iNaturalistAPI {
    constructor() {
        this.baseURL = 'https://api.inaturalist.org/v1';
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.minRequestInterval = 100; // Minimum 100ms between requests
    }

    async makeRequest(endpoint, params = {}) {
        await this.respectRateLimit();
        
        const url = new URL(`${this.baseURL}${endpoint}`);
        
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                if (Array.isArray(params[key])) {
                    url.searchParams.append(key, params[key].join(','));
                } else {
                    url.searchParams.append(key, params[key]);
                }
            }
        });

        console.log('API Request:', url.toString());
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            this.requestCount++;
            
            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    async respectRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minRequestInterval) {
            const delay = this.minRequestInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        this.lastRequestTime = Date.now();
    }

    async getPlace(placeId) {
        try {
            const data = await this.makeRequest(`/places/${placeId}`);
            return data.results?.[0] || data;
        } catch (error) {
            console.error('Failed to get place:', error);
            throw new Error('Unable to load location data');
        }
    }

    async searchPlaces(query, limit = 20) {
        try {
            const data = await this.makeRequest('/places/autocomplete', {
                q: query,
                per_page: limit
            });
            return data.results || [];
        } catch (error) {
            console.error('Failed to search places:', error);
            throw new Error('Unable to search locations');
        }
    }

    async getSpeciesObservations(placeId, options = {}) {
        const {
            iconicTaxonId = null,
            locale = 'en',
            perPage = 50,
            page = 1,
            quality = 'research',
            photos = true
        } = options;

        try {
            const params = {
                place_id: placeId,
                per_page: perPage,
                page: page,
                locale: locale,
                verifiable: true,
                quality_grade: quality
            };

            if (iconicTaxonId && iconicTaxonId !== 'all') {
                params.iconic_taxa = iconicTaxonId;
            }

            if (photos) {
                params.photos = 'true';
            }

            const data = await this.makeRequest('/observations/species_counts', params);
            return data.results || [];
        } catch (error) {
            console.error('Failed to get species observations:', error);
            throw new Error('Unable to load species data');
        }
    }

    async getTaxonDetails(taxonId, locale = 'en') {
        try {
            const data = await this.makeRequest(`/taxa/${taxonId}`, {
                locale: locale
            });
            return data.results?.[0] || data;
        } catch (error) {
            console.error('Failed to get taxon details:', error);
            throw new Error('Unable to load species details');
        }
    }

    async getObservationPhotos(taxonId, placeId, limit = 10) {
        try {
            const data = await this.makeRequest('/observations', {
                taxon_id: taxonId,
                place_id: placeId,
                per_page: limit,
                order_by: 'votes',
                order: 'desc',
                photos: 'true',
                quality_grade: 'research'
            });
            
            const observations = data.results || [];
            const photos = [];
            
            observations.forEach(obs => {
                if (obs.photos && obs.photos.length > 0) {
                    photos.push(...obs.photos.slice(0, 3)); // Max 3 photos per observation
                }
            });
            
            return photos.slice(0, limit);
        } catch (error) {
            console.error('Failed to get observation photos:', error);
            return [];
        }
    }

    formatSpeciesData(speciesCount) {
        const taxon = speciesCount.taxon;
        const photos = taxon.default_photo || (taxon.photos && taxon.photos[0]);
        
        return {
            id: taxon.id,
            name: taxon.preferred_common_name || taxon.name,
            scientificName: taxon.name,
            count: speciesCount.count,
            rank: taxon.rank,
            iconicTaxonId: taxon.iconic_taxon_id,
            wikipediaUrl: taxon.wikipedia_url,
            photo: photos ? {
                url: this.getPhotoURL(photos, 'medium'),
                thumbUrl: this.getPhotoURL(photos, 'small'),
                attribution: photos.attribution
            } : null,
            inatUrl: `https://www.inaturalist.org/taxa/${taxon.id}`
        };
    }

    getPhotoURL(photo, size = 'medium') {
        if (!photo) return null;
        
        const sizeMap = {
            small: 'small',
            medium: 'medium', 
            large: 'large',
            original: 'original'
        };
        
        const photoSize = sizeMap[size] || 'medium';
        
        if (photo.url) {
            return photo.url.replace('/square', `/${photoSize}`);
        }
        
        return null;
    }

    getIconicTaxonName(iconicTaxonId) {
        const iconicTaxa = {
            1: 'plants',
            3: 'birds', 
            20978: 'amphibians',
            26036: 'reptiles', 
            40151: 'mammals',
            47115: 'fungi',
            47158: 'arthropods',
            47178: 'fishes',
            47686: 'molluscs',
            85497: 'arachnids'
        };
        
        return iconicTaxa[iconicTaxonId] || 'unknown';
    }

    async getLocationStats(placeId) {
        try {
            const [speciesData, observersData] = await Promise.all([
                this.makeRequest('/observations/species_counts', {
                    place_id: placeId,
                    per_page: 1
                }),
                this.makeRequest('/observations/observers', {
                    place_id: placeId,
                    per_page: 1
                })
            ]);

            return {
                speciesCount: speciesData.total_results || 0,
                observerCount: observersData.total_results || 0
            };
        } catch (error) {
            console.error('Failed to get location stats:', error);
            return {
                speciesCount: 0,
                observerCount: 0
            };
        }
    }

    buildWikipediaSearchURL(scientificName, commonName) {
        const searchTerm = commonName || scientificName;
        return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(searchTerm)}`;
    }

    getRequestStats() {
        return {
            totalRequests: this.requestCount,
            lastRequestTime: this.lastRequestTime
        };
    }
}

window.api = new iNaturalistAPI();