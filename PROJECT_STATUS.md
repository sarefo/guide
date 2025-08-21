# Mobile Biodiversity Web App - Project Status

## Project Overview
Mobile-optimized PWA for displaying location-based biodiversity using iNaturalist API. Features image-heavy species displays with text overlays, multi-language support, and modern mobile UX.

## Current Status: **PLANNING COMPLETE - READY FOR DEVELOPMENT**

### Last Session Date: 2025-01-21
### Current Phase: **Phase 0 - Setup & Documentation**
### Next Phase: **Phase 1 - Core Infrastructure & Location**

## Implementation Progress

### ✅ Completed
- [x] Research iNaturalist API capabilities and endpoints
- [x] Identify technical stack (Vanilla JS PWA)  
- [x] Define file structure and architecture
- [x] Locate life group icons from DuoNat (./guide/icons.svg)
- [x] Plan URL parameter system for location loading
- [x] Design session memory system for Claude Code continuity

### 🔄 In Progress
- [ ] Setting up project documentation and structure

### 📋 Next Session Priorities
1. **Move icons.svg** from `./guide/icons.svg` to `./assets/icons.svg`
2. **Create PWA shell** (index.html, manifest.json, sw.js)  
3. **Implement URL parameter location loading** (?place_id=40855)
4. **Set up basic CSS framework** (mobile-first responsive)
5. **Begin iNaturalist API integration**

## Technical Decisions Made

### Core Architecture
- **Framework**: Vanilla JavaScript PWA (Claude Code maintainable)
- **APIs**: iNaturalist REST API (`api.inaturalist.org/v1/`)
- **QR Library**: QRCode.js (npm package)
- **Styling**: CSS Grid/Flexbox, mobile-first approach
- **i18n**: Custom system with JSON language files (EN/ES/FR/DE)

### Key Requirements Confirmed
- Mobile-first design with full-width species images
- Text overlays showing vernacular names only (initially)
- Tap interaction revealing Wikipedia/iNaturalist links
- URL-based location loading via place_id parameter
- Life group filtering using existing DuoNat icons
- QR code sharing for location URLs
- Future: Google OAuth + user bookmarks (TODO)

### File Structure Planned
```
/
├── index.html (PWA app shell)
├── js/
│   ├── app.js (main controller)
│   ├── api.js (iNaturalist integration)  
│   ├── location.js (URL params + location)
│   ├── species.js (species display)
│   ├── i18n.js (internationalization)
│   └── qr.js (QR code generation)
├── css/
│   ├── main.css (core styles)
│   └── mobile.css (mobile optimizations)
├── assets/
│   └── icons.svg (life group icons)
├── lang/ 
│   └── en.json, es.json, fr.json, de.json
├── manifest.json (PWA config)
├── sw.js (service worker)
├── PROJECT_STATUS.md (this file)
└── test-runner.js (Puppeteer tests)
```

## API Integration Details

### iNaturalist API Endpoints
- **Places**: `/v1/places` - Location search and data
- **Observations**: `/v1/observations?place_id={id}` - Species for location
- **Taxa**: `/v1/taxa` - Species details with vernacular names
- **Base URL**: `https://api.inaturalist.org/v1/`

### URL Structure Design  
- **Primary**: `https://app.com/?place_id=40855&lang=en`
- **place_id**: Required parameter for location
- **lang**: Optional language parameter (defaults to 'en')

### Life Groups Available
From icons.svg: birds, amphibians, reptiles, mammals, fishes, molluscs, arachnids, insects, plants, fungi

## Known Considerations
- iNaturalist API rate limiting - implement respectful requests
- Image optimization for mobile networks  
- Offline functionality via service worker
- Cross-browser PWA compatibility (iOS Safari, Android Chrome)
- Text overlay readability on various image backgrounds

## Testing Strategy
- Puppeteer automated tests for layout validation
- Console log monitoring  
- Mobile device testing (iOS/Android)
- API response caching and error handling

## Future TODOs (Post-MVP)
- Google OAuth2 integration for user accounts
- Like/bookmark functionality with user management
- Enhanced search by species name
- Hierarchical taxonomy tree view
- Location history and favorites

---
**Next Session Goal**: Complete Phase 1 core infrastructure and begin location functionality.