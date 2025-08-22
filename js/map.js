console.log('📂 map.js script loading...');

class MapManager {
    constructor() {
        console.log('🗺️ MapManager constructor called');
        this.map = null;
        this.currentMarker = null;
        this.radiusCircle = null;
        this.geocoder = null;
        this.currentLocation = null;
        this.radius = 50; // 50km radius as requested
        this.init();
    }

    init() {
        console.log('🗺️ MapManager initializing...');
        // Don't initialize map immediately, wait for modal to be opened
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for location modal open to initialize map
        document.addEventListener('modalOpened', (e) => {
            if (e.detail && e.detail.modalId === 'location-modal') {
                setTimeout(() => this.initializeMap(), 100);
            }
        });

        // Listen for location changes from other components
        window.addEventListener('locationChanged', (e) => {
            if (e.detail && e.detail.lat && e.detail.lng) {
                this.updateLocation(e.detail.lat, e.detail.lng, e.detail.name);
            }
        });
    }

    initializeMap() {
        const mapContainer = document.getElementById('location-map');
        if (!mapContainer || this.map) {
            return; // Map already initialized or container not found
        }

        try {
            console.log('🗺️ Initializing Leaflet map...');
            
            // Initialize map with default view
            this.map = L.map('location-map', {
                zoomControl: true,
                attributionControl: true
            }).setView([51.505, -0.09], 2); // Default to London, zoom level 2

            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);

            // Initialize geocoder
            this.initializeGeocoder();

            // Handle map clicks
            this.map.on('click', (e) => {
                this.handleMapClick(e.latlng);
            });

            // Set initial location if available
            if (this.currentLocation) {
                this.updateLocation(this.currentLocation.lat, this.currentLocation.lng, this.currentLocation.name);
            } else if (window.locationManager && window.locationManager.getCurrentLocation()) {
                const loc = window.locationManager.getCurrentLocation();
                if (loc.lat && loc.lng) {
                    this.updateLocation(loc.lat, loc.lng, loc.name);
                }
            }

            // Mark map as loaded to hide loading overlay
            mapContainer.classList.add('map-loaded');

            console.log('✅ Map initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize map:', error);
        }
    }

    initializeGeocoder() {
        if (!this.map) return;

        try {
            // Create geocoder with Nominatim
            this.geocoder = L.Control.Geocoder.nominatim({
                geocodingQueryParams: {
                    format: 'json',
                    addressdetails: 1,
                    limit: 5
                }
            });

            // Don't add the geocoder control to map, we'll use it programmatically
            console.log('✅ Geocoder initialized');
        } catch (error) {
            console.error('❌ Failed to initialize geocoder:', error);
            // Create a fallback direct Nominatim implementation
            this.createFallbackGeocoder();
        }
    }

    createFallbackGeocoder() {
        console.log('🔄 Creating fallback geocoder');
        this.geocoder = {
            geocode: async (query, callback) => {
                try {
                    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    const results = data.map(item => ({
                        center: {
                            lat: parseFloat(item.lat),
                            lng: parseFloat(item.lon)
                        },
                        name: item.display_name,
                        bbox: item.boundingbox
                    }));
                    
                    callback(results);
                } catch (error) {
                    console.error('Fallback geocoder error:', error);
                    callback([]);
                }
            }
        };
        console.log('✅ Fallback geocoder created');
    }

    handleMapClick(latlng) {
        console.log('🗺️ Map clicked at:', latlng);
        
        // Update map display
        this.updateLocation(latlng.lat, latlng.lng, 'Map Location');
        
        // Reverse geocode to get location name
        this.reverseGeocode(latlng.lat, latlng.lng);
    }

    updateLocation(lat, lng, name = null) {
        if (!this.map) return;

        console.log('🗺️ Updating map location:', { lat, lng, name });

        this.currentLocation = { lat, lng, name };

        // Remove existing marker and circle
        if (this.currentMarker) {
            this.map.removeLayer(this.currentMarker);
        }
        if (this.radiusCircle) {
            this.map.removeLayer(this.radiusCircle);
        }

        // Add new marker
        this.currentMarker = L.marker([lat, lng]).addTo(this.map);
        
        // Add popup with location info
        if (name) {
            this.currentMarker.bindPopup(`${name}<br>📍 ${lat.toFixed(3)}, ${lng.toFixed(3)}`);
        }

        // Add radius circle
        this.radiusCircle = L.circle([lat, lng], {
            radius: this.radius * 1000, // Convert km to meters
            fillColor: '#2E7D32',
            fillOpacity: 0.1,
            color: '#2E7D32',
            weight: 2,
            opacity: 0.6
        }).addTo(this.map);

        // Center map on location
        this.map.setView([lat, lng], 10);
    }

    async searchLocation(query, signal = null) {
        if (!this.geocoder || !query || query.length < 2) {
            return [];
        }

        console.log('🔍 Searching for location:', query);

        try {
            // Get current language for i18n support with fallback priority
            const currentLang = window.i18n ? window.i18n.getCurrentLang() : 'en';
            // Create language priority list: chosen language first, then common languages, then any language
            const acceptLanguage = `${currentLang},en,de,fr,es,*;q=0.1`;
            
            // Try direct Nominatim API call with language support
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&accept-language=${acceptLanguage}&q=${encodeURIComponent(query)}`;
            console.log('🔍 Making direct Nominatim request with language priority:', url);
            
            const fetchOptions = {};
            if (signal) {
                fetchOptions.signal = signal;
            }
            
            const response = await fetch(url, fetchOptions);
            const data = await response.json();
            
            console.log('🔍 Raw Nominatim results:', data);
            
            if (!data || data.length === 0) {
                console.log('🔍 No results from Nominatim');
                return [];
            }
            
            const formattedResults = data.map(item => {
                console.log('🔍 Processing Nominatim result:', item);
                return {
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    name: item.display_name,
                    display_name: item.display_name,
                    bbox: item.boundingbox
                };
            });
            
            console.log('🔍 Formatted results:', formattedResults);
            return formattedResults;
            
        } catch (error) {
            console.error('🔍 Geocoding error:', error);
            return [];
        }
    }

    async reverseGeocode(lat, lng) {
        console.log('🔄 Reverse geocoding:', { lat, lng });

        try {
            // Get current language for i18n support with fallback priority
            const currentLang = window.i18n ? window.i18n.getCurrentLang() : 'en';
            // Create language priority list: chosen language first, then common languages, then any language
            const acceptLanguage = `${currentLang},en,de,fr,es,*;q=0.1`;
            
            // Direct Nominatim reverse geocoding with language support
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=${acceptLanguage}`;
            console.log('🔄 Making reverse geocoding request with language priority:', url);
            
            const response = await fetch(url);
            const data = await response.json();
            
            console.log('🔄 Reverse geocoding result:', data);
            
            if (data && data.display_name) {
                const locationName = data.display_name;
                console.log('🔄 Reverse geocoded name:', locationName);
                
                // Update marker popup
                if (this.currentMarker) {
                    this.currentMarker.bindPopup(`${locationName}<br>📍 ${lat.toFixed(3)}, ${lng.toFixed(3)}`);
                }
                
                // Update current location
                this.currentLocation.name = locationName;
                
                // Notify location manager
                if (window.locationManager) {
                    window.locationManager.setLocationFromCoordinates(lat, lng, locationName);
                }
            } else {
                console.log('🔄 No reverse geocoding result, using coordinates');
                if (window.locationManager) {
                    window.locationManager.setLocationFromCoordinates(lat, lng, `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
                }
            }
        } catch (error) {
            console.error('🔄 Reverse geocoding error:', error);
            // Fallback to coordinates
            if (window.locationManager) {
                window.locationManager.setLocationFromCoordinates(lat, lng, `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
            }
        }
    }

    getCurrentLocation() {
        return this.currentLocation;
    }

    setLocation(lat, lng, name) {
        this.updateLocation(lat, lng, name);
    }

    // Convert bounding box center (for iNaturalist place compatibility)
    static calculateCenter(boundingBoxGeoJson) {
        if (!boundingBoxGeoJson || !boundingBoxGeoJson.coordinates) {
            return null;
        }

        try {
            // Extract coordinates from GeoJSON bounding box
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

            console.log('📐 Calculated center from bbox:', { lat: centerLat, lng: centerLng });
            return { lat: centerLat, lng: centerLng };
        } catch (error) {
            console.error('❌ Failed to calculate center from bbox:', error);
            return null;
        }
    }

    // Resize map when modal is resized
    invalidateSize() {
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        }
    }
}

console.log('📂 About to create MapManager...');

try {
    console.log('🗺️ Creating MapManager...');
    window.mapManager = new MapManager();
    console.log('✅ MapManager created successfully');
    console.log('✅ window.mapManager:', window.mapManager);
} catch (error) {
    console.error('❌ Failed to create MapManager:', error);
    console.error('❌ Error stack:', error.stack);
}