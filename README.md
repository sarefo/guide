# Mobile Biodiversity Explorer

**Status**: Production Ready  
**URL**: https://sarefo.github.io/guide/

## Overview
Progressive Web App for exploring location-based biodiversity using iNaturalist data. Mobile-first design with offline support, multi-language interface, and installable PWA capabilities.

## Features
- 🌍 Location-based species exploration with iNaturalist API
- 🦋 Life group filtering (birds, plants, insects, etc.)
- 🔍 Custom taxon search and filtering
- 🌐 Multi-language support (EN/ES/FR/DE)
- 📱 Mobile-optimized responsive design
- 💾 Offline mode with IndexedDB caching
- 🔄 Auto-update notifications
- 📤 Native URL sharing

## Technical Stack
- **Frontend**: Vanilla JavaScript (ES6+)
- **API**: iNaturalist REST API v1
- **Storage**: IndexedDB, localStorage, Service Worker cache
- **Design**: Mobile-first responsive CSS Grid/Flexbox
- **PWA**: Service Worker, Web App Manifest

## Architecture
```
/guide/
├── js/
│   ├── app.js         # Main application controller
│   ├── api.js         # iNaturalist API integration
│   ├── species.js     # Species display & filtering
│   ├── location.js    # Location management
│   ├── i18n.js        # Internationalization
│   ├── map.js         # Map integration
│   └── qr.js          # URL sharing (QR disabled)
├── css/
│   ├── main.css       # Core styles
│   └── mobile.css     # Mobile optimizations
├── lang/              # Translation files
├── assets/            # Icons and images
├── index.html         # PWA shell
├── manifest.json      # PWA manifest
└── sw.js             # Service Worker
```

## Known Issues
1. **Cache persistence**: IndexedDB data not persisting between sessions
2. **UI flicker**: Occasional flicker when switching life groups
3. **Performance**: Further optimization needed for large datasets

## Future Enhancements
- Species name search/sort functionality
- Hierarchical taxonomy tree navigation
- GPS-based "current location" option
- Enhanced offline capabilities
- Performance optimizations

## Development
```bash
# Local development server
python3 -m http.server 8000

# Access at
http://localhost:8000/guide/
```

## URL Parameters
- `place_id`: iNaturalist place ID (e.g., `?place_id=40855`)
- `lang`: Language code (en/es/fr/de)
- `lifeGroup`: Taxon filter ID

## License
MIT