# iNaturalist API Integration Guide

## Base Configuration
- **Base URL**: `https://api.inaturalist.org/v1/`
- **Format**: JSON responses
- **Rate Limiting**: Be respectful, implement caching
- **CORS**: API supports cross-origin requests

## Core Endpoints for Biodiversity App

### 1. Places API - Location Management
**Endpoint**: `GET /v1/places`

**Purpose**: Search and retrieve location data for place selection

**Key Parameters**:
- `q`: Query string for location search
- `latitude`, `longitude`: Geographic coordinates  
- `place_type`: Filter by type (country, state, etc.)
- `per_page`: Results per page (default: 20, max: 200)

**Example Request**:
```javascript
// Search for places by name
fetch('https://api.inaturalist.org/v1/places?q=San+Francisco&per_page=10')

// Get place by coordinates  
fetch('https://api.inaturalist.org/v1/places?latitude=37.7749&longitude=-122.4194')
```

**Response Structure**:
```json
{
  "total_results": 1,
  "page": 1,
  "per_page": 10,
  "results": [{
    "id": 40855,
    "name": "San Francisco",
    "display_name": "San Francisco, CA, US", 
    "place_type": 8,
    "latitude": "37.7749295",
    "longitude": "-122.4194155"
  }]
}
```

### 2. Observations API - Species Data
**Endpoint**: `GET /v1/observations/species_counts`

**Purpose**: Get species list and counts for a specific location

**Key Parameters**:
- `place_id`: Required - ID of the location
- `per_page`: Results per page (default: 20, max: 500)
- `iconic_taxon_id`: Filter by life group (see taxonomy IDs below)
- `locale`: Language for vernacular names (en, es, fr, de)
- `order_by`: Sort order (observations, species)

**Example Request**:
```javascript
// Get all species for San Francisco
fetch('https://api.inaturalist.org/v1/observations/species_counts?place_id=40855&per_page=100&locale=en')

// Get only birds for location
fetch('https://api.inaturalist.org/v1/observations/species_counts?place_id=40855&iconic_taxon_id=3&locale=en')
```

**Response Structure**:
```json
{
  "total_results": 1234,
  "page": 1, 
  "per_page": 100,
  "results": [{
    "count": 456,
    "taxon": {
      "id": 12345,
      "name": "Turdus migratorius",
      "preferred_common_name": "American Robin",
      "iconic_taxon_id": 3,
      "default_photo": {
        "square_url": "https://static.inaturalist.org/photos/123/square.jpg",
        "medium_url": "https://static.inaturalist.org/photos/123/medium.jpg"
      }
    }
  }]
}
```

### 3. Taxa API - Species Details
**Endpoint**: `GET /v1/taxa/{id}`

**Purpose**: Get detailed information about a specific species

**Key Parameters**:
- `locale`: Language for vernacular names
- `all_names`: Include all common names

**Example Request**:
```javascript
// Get taxon details with Spanish names
fetch('https://api.inaturalist.org/v1/taxa/12345?locale=es&all_names=true')
```

## Iconic Taxon IDs (Life Groups)
Map to our icon system:
- `47126` - Plants (Plantae) → `icon-plants`
- `1` - Animals (Animalia) → Generic animal
- `3` - Birds (Aves) → `icon-birds` 
- `40151` - Mammals (Mammalia) → `icon-mammals`
- `26036` - Reptiles (Reptilia) → `icon-reptiles`
- `20978` - Amphibians (Amphibia) → `icon-amphibians`
- `47178` - Fish (Actinopterygii) → `icon-fishes`
- `47158` - Insects (Insecta) → `icon-insects`
- `47119` - Arachnids (Arachnida) → `icon-arachnids`
- `47115` - Molluscs (Mollusca) → `icon-molluscs`
- `47170` - Fungi (Fungi) → `icon-fungi`

## Implementation Strategy

### 1. Location Loading from URL
```javascript
// Extract place_id from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const placeId = urlParams.get('place_id') || '1'; // Default to Earth

// Load location data
async function loadLocation(placeId) {
  const response = await fetch(`https://api.inaturalist.org/v1/places/${placeId}`);
  const data = await response.json();
  return data.results[0];
}
```

### 2. Species Loading with Life Group Filtering  
```javascript
async function loadSpecies(placeId, iconicTaxonId = null, locale = 'en') {
  let url = `https://api.inaturalist.org/v1/observations/species_counts?place_id=${placeId}&per_page=100&locale=${locale}`;
  
  if (iconicTaxonId) {
    url += `&iconic_taxon_id=${iconicTaxonId}`;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  return data.results;
}
```

### 3. Caching Strategy
```javascript
// Simple cache implementation
const apiCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

async function cachedFetch(url) {
  const cached = apiCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  
  apiCache.set(url, {
    data: data,
    timestamp: Date.now()
  });
  
  return data;
}
```

## Error Handling
- Network errors: Show offline message, use cached data
- API errors: Graceful degradation, show error states
- Rate limiting: Implement exponential backoff
- Invalid place_id: Fallback to global view or user's location

## Multilingual Support
Supported locales for vernacular names:
- `en` - English
- `es` - Spanish  
- `fr` - French
- `de` - German

Names fallback to scientific name if vernacular not available.

---
**Note**: Always test API endpoints thoroughly and implement proper error handling for production use.