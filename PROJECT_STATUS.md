# Mobile Biodiversity Web App - Project Status

## Project Overview
Mobile-optimized PWA for displaying location-based biodiversity using iNaturalist API. Features image-heavy species displays with text overlays, multi-language support, and modern mobile UX.

## Current Status: **PRODUCTION READY**

### Last Session Date: 2025-08-25 (Code Refactoring & Documentation Update)
### Current Phase: **Phase 3 - Code Optimization & Maintenance**

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
- [x] **Native URL sharing system** (QR functionality disabled, uses browser sharing)
- [x] **Service Worker for PWA caching**
- [x] **Responsive mobile design with touch interactions**
- [x] **Life group filtering system**
- [x] **Species modal with Wikipedia/iNaturalist links**

### ✅ Completed - Phase 1.5: Mobile UX Optimization
- [x] **Modal positioning optimization for mobile devices**
  - Location/share dialogs moved higher to prevent keyboard obstruction
  - Species modal positioned at viewport top on mobile screens
  - Responsive image sizing in species modal (250px→200px→180px→150px)
  - Progressive modal padding reduction for smaller screens
  - Landscape mode optimizations for limited vertical space
  - Full visibility ensured on phones as small as 360px

### ✅ Completed - Phase 2: Core Features & Fixes
- [x] **Console error resolution** - All console errors eliminated
- [x] **Translation system** - Complete EN/ES/FR/DE language support
- [x] **URL sharing** - Native browser sharing (QR code disabled)
- [x] **Service worker** - Offline caching with version management
- [x] **Custom taxa support** - Dynamic taxon filtering with persistence
- [x] **Offline mode** - Graceful degradation when offline
- [x] **IndexedDB caching** - Persistent species data caching
- [x] **Auto-update system** - Version checking and update notifications

### 🔄 Current Implementation Status
- **Production-ready PWA** with offline capabilities
- **IndexedDB caching** for 7-day data persistence
- **Custom taxa management** with localStorage persistence
- **Automatic updates** with version checking
- **Network state handling** with online/offline indicators
- **Modal management system** with history integration
- **Responsive design** optimized for 360px+ screens
- **Performance optimized** with lazy loading and debouncing

### 📋 Current Issues & Improvements Needed
1. **Cache persistence** - IndexedDB data should persist between app loads
2. **Loading flicker** - Occasional flicker when switching life groups
3. **Code consolidation** - Further refactoring for maintainability
4. **Search functionality** - Add species name search/sort
5. **Hierarchical taxonomy** - Add taxonomic tree navigation
6. **GPS location** - "Here" option for current location

## Technical Decisions Made

### Core Architecture
- **Framework**: Vanilla JavaScript PWA (Claude Code maintainable)
- **APIs**: iNaturalist REST API (`api.inaturalist.org/v1/`)
- **URL Sharing**: Native browser sharing (QR functionality disabled)
- **Styling**: CSS Grid/Flexbox, mobile-first approach
- **i18n**: Custom system with JSON language files (EN/ES/FR/DE)

### Key Requirements Confirmed
- Mobile-first design with full-width species images
- Text overlays showing vernacular names only (initially)
- Tap interaction revealing Wikipedia/iNaturalist links
- URL-based location loading via place_id parameter
- Life group filtering using existing DuoNat icons
- Native URL sharing for location URLs
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
│   └── qr.js (URL sharing, QR disabled)
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
**Current State**: Production-ready PWA with comprehensive offline support, custom taxa management, and auto-update capabilities. Code architecture follows modular design with separation of concerns between API, UI, and data management layers.