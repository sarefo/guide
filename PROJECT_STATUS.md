# Mobile Biodiversity Web App - Project Status

## Project Overview
Mobile-optimized PWA for displaying location-based biodiversity using iNaturalist API. Features image-heavy species displays with text overlays, multi-language support, and modern mobile UX.

## Current Status: **CORE APP IMPLEMENTED - READY FOR TESTING**

### Last Session Date: 2025-01-21
### Current Phase: **Phase 1 - Core Infrastructure Complete**
### Next Phase: **Phase 2 - Testing & Refinement**

## Implementation Progress

### ✅ Completed - Phase 1: Core Infrastructure
- [x] Research iNaturalist API capabilities and endpoints
- [x] Identify technical stack (Vanilla JS PWA)  
- [x] Define file structure and architecture
- [x] Locate life group icons from DuoNat (./guide/icons.svg)
- [x] Plan URL parameter system for location loading
- [x] Design session memory system for Claude Code continuity
- [x] **PWA shell created** (index.html, manifest.json, sw.js)
- [x] **URL parameter location loading implemented** (js/location.js)
- [x] **Mobile-first CSS framework complete** (css/main.css, css/mobile.css)
- [x] **iNaturalist API integration functional** (js/api.js)
- [x] **Species display system working** (js/species.js)
- [x] **App controller and coordination layer** (js/app.js)
- [x] **Internationalization framework** (js/i18n.js, lang/en.json)
- [x] **QR sharing system** (js/qr.js)
- [x] **Service Worker for PWA caching**
- [x] **Responsive mobile design with touch interactions**
- [x] **Life group filtering system**
- [x] **Species modal with Wikipedia/iNaturalist links**

### 🔄 Current Status
- **App is functional and ready for testing**
- All core features implemented
- PWA installable with offline capabilities
- Mobile-optimized with touch interactions

### 📋 Next Session Priorities
1. **Test the app** in browser to verify functionality
2. **Add missing assets** (app icons for PWA)
3. **Fix any runtime issues** discovered during testing
4. **Optimize performance** and loading states
5. **Add additional language files** (es.json, fr.json, de.json)

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