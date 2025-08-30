class iNaturalistAPI {
    constructor() {
        this.baseURL = 'https://api.inaturalist.org/v1';
        this.requestCount = 0;
        this.lastRequestTime = 0;
        this.minRequestInterval = 100; // Minimum 100ms between requests
        this.currentLocale = 'en';
        this.currentRequests = new Map(); // Track active requests
    }

    async makeRequest(endpoint, params = {}, requestKey = null) {
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

        // Cancel any existing request with the same key
        if (requestKey && this.currentRequests.has(requestKey)) {
            this.currentRequests.get(requestKey).abort();
        }

        const controller = new AbortController();
        if (requestKey) {
            this.currentRequests.set(requestKey, controller);
        }

        
        try {
            const response = await fetch(url, {
                signal: controller.signal
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            this.requestCount++;
            
            // Clean up the request tracker
            if (requestKey) {
                this.currentRequests.delete(requestKey);
            }
            
            return data;
        } catch (error) {
            // Clean up the request tracker
            if (requestKey) {
                this.currentRequests.delete(requestKey);
            }
            
            if (error.name === 'AbortError') {
                throw new Error('Request cancelled');
            }
            
            // Only log errors when online - offline errors are expected
            if (navigator.onLine) {
                console.error('API request error:', error);
            }
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

    async reverseGeocode(lat, lng) {
        try {
            
            // Use Nominatim for reverse geocoding (more reliable than iNaturalist)
            const lang = this.currentLocale || 'en';
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=${lang}&zoom=14`;
            
            const response = await fetch(nominatimUrl, {
                headers: {
                    'User-Agent': 'BiodiversityExplorer/1.0'  // Nominatim requires a User-Agent
                }
            });
            
            if (!response.ok) {
                throw new Error(`Nominatim request failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && data.display_name) {
                let locationName = data.display_name;
                
                // Try to get a more concise name from the address components
                if (data.address) {
                    const addr = data.address;
                    const parts = [];
                    
                    // Primary place name (in order of preference for different place types)
                    if (addr.tourism) parts.push(addr.tourism);        // Tourist attractions
                    else if (addr.amenity) parts.push(addr.amenity);   // Parks, reserves
                    else if (addr.leisure) parts.push(addr.leisure);   // Recreation areas  
                    else if (addr.natural) parts.push(addr.natural);   // Natural features
                    else if (addr.city) parts.push(addr.city);
                    else if (addr.town) parts.push(addr.town);
                    else if (addr.village) parts.push(addr.village);
                    else if (addr.municipality) parts.push(addr.municipality);
                    else if (addr.county) parts.push(addr.county);     // Fallback to county
                    else if (addr.state) parts.push(addr.state);       // Or state
                    
                    // Always add country as second part
                    if (addr.country) parts.push(addr.country);
                    
                    if (parts.length > 0) {
                        locationName = parts.join(', ');
                    }
                }
                
                return {
                    name: locationName,
                    data: data
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('Nominatim reverse geocoding failed:', error);
            return null;
        }
    }

    async searchTaxa(query, limit = 20, locale = null) {
        try {
            const params = {
                q: query,
                per_page: limit
            };
            
            if (locale) {
                params.locale = locale;
            }
            
            const data = await this.makeRequest('/taxa/autocomplete', params);
            return data.results || [];
        } catch (error) {
            console.error('Failed to search taxa:', error);
            throw new Error('Unable to search taxa');
        }
    }

    async getSpeciesObservations(lat, lng, radius = 50, options = {}) {
        const {
            iconicTaxonId = null,
            taxonId = null,
            locale = 'en',
            perPage = 50,
            page = 1,
            quality = 'research',
            photos = true,
            includeGenusLevel = true,
            locationData = null  // New parameter to pass country information
        } = options;

        try {
            // Check if this is a country with iNaturalist place_id
            const isCountryWithPlace = locationData && locationData.isCountry && locationData.inatPlaceId;
            
            let baseParams;
            
            if (isCountryWithPlace) {
                // Use place_id for countries to get proper boundary coverage
                console.log(`🌍 Using iNat place_id ${locationData.inatPlaceId} for country "${locationData.name}"`);
                baseParams = {
                    place_id: locationData.inatPlaceId,
                    per_page: perPage,
                    page: page,
                    locale: locale,
                    verifiable: true,
                    quality_grade: quality
                };
            } else {
                // Use lat/lng/radius for cities and regions
                baseParams = {
                    lat: lat,
                    lng: lng,
                    radius: radius,
                    per_page: perPage,
                    page: page,
                    locale: locale,
                    verifiable: true,
                    quality_grade: quality
                };
            }

            if (iconicTaxonId && iconicTaxonId !== 'all') {
                baseParams.iconic_taxa = iconicTaxonId;
            } else if (taxonId) {
                baseParams.taxon_id = taxonId;
            }

            if (photos) {
                baseParams.photos = 'true';
            }

            // Create unique request key to cancel previous requests
            const filterKey = iconicTaxonId || taxonId || 'all';
            const locationKey = isCountryWithPlace ? 
                `place_${locationData.inatPlaceId}` : 
                `${lat}_${lng}`;
            const requestKey = `species_${locationKey}_${filterKey}`;
            
            if (includeGenusLevel && !taxonId) {
                // Only use rank filtering for iconic taxa, not custom taxa
                // Make parallel requests for species and genus levels
                const [speciesData, genusData] = await Promise.all([
                    this.makeRequest('/observations/species_counts', {
                        ...baseParams,
                        hrank: 'species',
                        lrank: 'species'
                    }, `${requestKey}_species`),
                    this.makeRequest('/observations/species_counts', {
                        ...baseParams,
                        hrank: 'genus',
                        lrank: 'genus'
                    }, `${requestKey}_genus`)
                ]);
                
                const species = speciesData.results || [];
                const genera = genusData.results || [];
                
                // Filter out genera that have species-level observations
                const speciesGenera = new Set();
                species.forEach(s => {
                    if (s.taxon.ancestor_ids) {
                        s.taxon.ancestor_ids.forEach(ancestorId => {
                            speciesGenera.add(ancestorId);
                        });
                    }
                });
                
                const uniqueGenera = genera.filter(g => !speciesGenera.has(g.taxon.id));
                
                // Combine species and unique genera
                return [...species, ...uniqueGenera];
            } else if (includeGenusLevel && taxonId) {
                // For custom taxa, we need to use different approach
                // Get species from species_counts (research grade)
                const speciesData = await this.makeRequest('/observations/species_counts', baseParams, requestKey);
                const species = speciesData.results || [];
                
                // Get genus-level observations separately (without quality_grade restriction)
                const genusParams = {
                    taxon_id: taxonId,
                    hrank: 'genus',
                    lrank: 'genus',
                    per_page: perPage,
                    locale: locale,
                    verifiable: true
                };
                
                // Add location parameters based on type
                if (isCountryWithPlace) {
                    genusParams.place_id = locationData.inatPlaceId;
                } else {
                    genusParams.lat = lat;
                    genusParams.lng = lng;
                    genusParams.radius = radius;
                }
                
                if (photos) {
                    genusParams.photos = 'true';
                }
                
                const genusObsData = await this.makeRequest('/observations', genusParams, `${requestKey}_genus_obs`);
                const genusObservations = genusObsData.results || [];
                
                // Convert genus observations to species_counts format and count by taxon
                const genusCounts = new Map();
                genusObservations.forEach(obs => {
                    const taxonId = obs.taxon.id;
                    if (genusCounts.has(taxonId)) {
                        genusCounts.get(taxonId).count++;
                    } else {
                        genusCounts.set(taxonId, {
                            count: 1,
                            taxon: obs.taxon
                        });
                    }
                });
                
                const genera = Array.from(genusCounts.values());
                
                // Filter out genera that have species-level observations
                const speciesGenera = new Set();
                species.forEach(s => {
                    if (s.taxon.ancestor_ids) {
                        s.taxon.ancestor_ids.forEach(ancestorId => {
                            speciesGenera.add(ancestorId);
                        });
                    }
                });
                
                const uniqueGenera = genera.filter(g => !speciesGenera.has(g.taxon.id));
                
                // Combine species and unique genera
                return [...species, ...uniqueGenera];
            } else {
                // Original behavior: species only
                const data = await this.makeRequest('/observations/species_counts', baseParams, requestKey);
                return data.results || [];
            }
        } catch (error) {
            if (error.message === 'Request cancelled') {
                return []; // Return empty array for cancelled requests
            }
            // Only log errors when online - offline errors are expected
            if (navigator.onLine) {
                console.error('Failed to get species observations:', error);
            }
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
        
        let vernacularName = taxon.preferred_common_name || taxon.english_common_name || taxon.name;
        
        if (!taxon.preferred_common_name && taxon.names && taxon.names.length > 0) {
            const localName = taxon.names.find(name => 
                name.locale === this.currentLocale || 
                name.locale?.startsWith(this.currentLocale)
            );
            if (localName) {
                vernacularName = localName.name;
            }
        }
        
        // For genus-level taxa, show "Genus sp." format if no vernacular name
        if (taxon.rank === 'genus' && (vernacularName === taxon.name || !taxon.preferred_common_name)) {
            vernacularName = `${taxon.name} sp.`;
        }
        
        return {
            id: taxon.id,
            name: vernacularName,
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
            inatUrl: this.buildINaturalistURL(taxon.id)
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

    async getLocationStats(lat, lng, radius = 50) {
        try {
            const [speciesData, observersData] = await Promise.all([
                this.makeRequest('/observations/species_counts', {
                    lat: lat,
                    lng: lng,
                    radius: radius,
                    per_page: 1
                }),
                this.makeRequest('/observations/observers', {
                    lat: lat,
                    lng: lng,
                    radius: radius,
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

    // Helper method to convert place center from bounding box
    async getPlaceCenter(placeId) {
        try {
            const place = await this.getPlace(placeId);
            
            if (place.bounding_box_geojson) {
                return this.calculateCenterFromBbox(place.bounding_box_geojson);
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get place center:', error);
            return null;
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

    buildWikipediaSearchURL(scientificName, commonName) {
        // Always use scientific name for Wikipedia searches
        const searchTerm = scientificName;
        const lang = window.i18n ? window.i18n.getCurrentLang() : 'en';
        return `https://${lang}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(searchTerm)}`;
    }

    async checkWikipediaArticleExists(articleTitle, lang = 'en') {
        try {
            const response = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`, {
                method: 'HEAD'
            });
            return response.status === 200;
        } catch (error) {
            console.log(`Wikipedia article check failed for ${articleTitle} (${lang}):`, error);
            return false;
        }
    }

    async findBestWikipediaUrl(species) {
        const currentLang = window.i18n ? window.i18n.getCurrentLang() : 'en';
        const fallbackLang = 'en';
        
        console.log('🔍 Wikipedia check for:', {
            vernacularName: species.name,
            scientificName: species.scientificName,
            currentLang
        });
        
        const speciesName = species.scientificName;
        const genusName = species.scientificName.split(' ')[0];

        // Always prioritize scientific name over iNaturalist's Wikipedia URL
        // First, try species name in current language
        console.log(`🔍 Checking ${currentLang} Wikipedia for:`, speciesName);
        if (await this.checkWikipediaArticleExists(speciesName, currentLang)) {
            console.log(`✅ Found ${currentLang} Wikipedia article for:`, speciesName);
            return {
                url: `https://${currentLang}.wikipedia.org/wiki/${encodeURIComponent(speciesName)}`,
                lang: currentLang,
                isOriginalLang: true
            };
        }

        // Then try species name in English fallback
        if (currentLang !== fallbackLang) {
            console.log(`🔍 Checking ${fallbackLang} Wikipedia for:`, speciesName);
            if (await this.checkWikipediaArticleExists(speciesName, fallbackLang)) {
                console.log(`✅ Found ${fallbackLang} Wikipedia article for:`, speciesName);
                return {
                    url: `https://${fallbackLang}.wikipedia.org/wiki/${encodeURIComponent(speciesName)}`,
                    lang: fallbackLang,
                    isOriginalLang: false
                };
            }
        }

        // Last resort: try genus name in English only (if no English species page exists)
        console.log(`🔍 Last resort - checking ${fallbackLang} Wikipedia for genus:`, genusName);
        if (await this.checkWikipediaArticleExists(genusName, fallbackLang)) {
            console.log(`✅ Found ${fallbackLang} Wikipedia article for genus:`, genusName);
            return {
                url: `https://${fallbackLang}.wikipedia.org/wiki/${encodeURIComponent(genusName)}`,
                lang: fallbackLang,
                isOriginalLang: false,
                isGenusOnly: true
            };
        }

        // No valid Wikipedia article found
        console.log('❌ No Wikipedia article found for any search terms');
        return null;
    }

    convertWikipediaURL(wikipediaUrl) {
        if (!wikipediaUrl) return null;
        
        const lang = window.i18n ? window.i18n.getCurrentLang() : 'en';
        
        // If it's already in the target language, return as-is
        if (wikipediaUrl.includes(`://${lang}.wikipedia.org/`)) {
            return wikipediaUrl;
        }
        
        // Extract the article title from the URL
        const match = wikipediaUrl.match(/https?:\/\/[a-z-]+\.wikipedia\.org\/wiki\/(.+)/);
        if (!match) {
            return wikipediaUrl;
        }
        
        const articleTitle = match[1];
        
        // Convert to target language, with fallback handling
        return `https://${lang}.wikipedia.org/wiki/${articleTitle}`;
    }

    buildINaturalistURL(taxonId) {
        const lang = window.i18n ? window.i18n.getCurrentLang() : 'en';
        
        // Add locale parameter if not English
        if (lang !== 'en') {
            return `https://www.inaturalist.org/taxa/${taxonId}?locale=${lang}#map-tab`;
        }
        
        return `https://www.inaturalist.org/taxa/${taxonId}#map-tab`;
    }

    setLocale(locale) {
        this.currentLocale = locale;
    }

    getRequestStats() {
        return {
            totalRequests: this.requestCount,
            lastRequestTime: this.lastRequestTime
        };
    }
}

window.api = new iNaturalistAPI();