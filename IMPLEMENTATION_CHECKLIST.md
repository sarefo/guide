# Implementation Checklist - Mobile Biodiversity PWA

## Ready to Start Development

### ✅ Setup Complete
- [x] Project structure created (assets/, css/, js/, lang/)
- [x] Icons moved to ./assets/icons.svg 
- [x] PROJECT_STATUS.md created for session memory
- [x] API_INTEGRATION.md documented with endpoints
- [x] Implementation checklist ready

### Phase 1: Core Infrastructure & Location (Next Session)

#### 1.1 PWA Shell Setup
- [ ] **index.html** - Create PWA app shell with:
  - Mobile viewport meta tag
  - PWA manifest link
  - Service worker registration
  - Basic HTML structure for species grid
  - Icon sprite sheet integration

- [ ] **manifest.json** - PWA configuration:
  - App name and icons
  - Display mode (standalone)
  - Theme colors for mobile
  - Start URL with place_id parameter

- [ ] **sw.js** - Service worker for:
  - Basic caching strategy
  - Offline fallback
  - API response caching

#### 1.2 Location System
- [ ] **js/location.js** - URL parameter handling:
  - Extract place_id from URL (?place_id=40855)
  - Default location fallback (global or user location)
  - Location data loading from iNaturalist API
  - Location display in header

- [ ] **Location autocomplete** - Search functionality:
  - Places API integration for search
  - Dropdown/modal for location selection  
  - URL update when location changes

#### 1.3 Core Styles
- [ ] **css/main.css** - Base responsive framework:
  - Mobile-first CSS reset
  - Grid system for species display
  - Header with location and language switcher
  - Loading states and animations

- [ ] **css/mobile.css** - Mobile optimizations:
  - Touch-friendly interactions
  - Image overlay text styling
  - Responsive breakpoints

### Phase 2: Species Display System

#### 2.1 Species Grid
- [ ] **js/species.js** - Species display logic:
  - Image-heavy grid layout
  - Species data loading from API
  - Image lazy loading for performance
  - Text overlay with vernacular names

#### 2.2 Life Group Filtering  
- [ ] **Life group filter bar** with icon buttons:
  - Icon integration from assets/icons.svg
  - Filter state management
  - API calls with iconic_taxon_id parameter

#### 2.3 Species Interactions
- [ ] **Tap interaction system**:
  - Modal/popup for species details
  - Wikipedia link integration  
  - iNaturalist link integration
  - Smooth animations for mobile

### Phase 3: Internationalization

#### 3.1 Language System
- [ ] **js/i18n.js** - Translation system:
  - Language detection from URL/browser
  - Translation key lookup
  - DOM text replacement

#### 3.2 Language Files
- [ ] **lang/en.json** - English translations
- [ ] **lang/es.json** - Spanish translations
- [ ] **lang/fr.json** - French translations
- [ ] **lang/de.json** - German translations

#### 3.3 Language Switcher
- [ ] **Language selector UI**:
  - Flag dropdown in header
  - URL parameter update (?lang=es)
  - Species API calls with locale parameter

### Phase 4: Core Features & Polish

#### 4.1 QR Code Sharing
- [ ] **js/qr.js** - QR code generation:
  - QRCode.js library integration
  - Current URL to QR code
  - Share modal/popup
  - Download/share functionality

#### 4.2 Performance & PWA
- [ ] **Performance optimizations**:
  - Image compression/optimization
  - API request caching
  - Offline functionality testing
  - Loading state improvements

#### 4.3 Testing System
- [ ] **test-runner.js** - Puppeteer automation:
  - Layout validation tests
  - Console error monitoring  
  - Mobile viewport testing
  - API integration testing

## Implementation Order by Priority

### Must Have (MVP)
1. Basic PWA shell (index.html, manifest, service worker)
2. URL parameter location loading
3. Species grid with images and names
4. Life group filtering
5. Basic responsive mobile design

### Should Have  
6. Language switching (EN/ES initially)
7. Species tap interactions (Wikipedia/iNaturalist)
8. QR code sharing
9. Location search/autocomplete

### Nice to Have
10. Advanced caching strategies
11. Offline functionality 
12. Performance optimizations
13. Automated testing

## Key Technical Notes

### API Implementation
- Use `species_counts` endpoint for main species list
- Filter by `iconic_taxon_id` for life groups  
- Include `locale` parameter for translated names
- Implement caching to respect rate limits

### Mobile UX Priorities
- Touch-friendly tap targets (44px minimum)
- Fast image loading with placeholders
- Readable text overlays on all image backgrounds
- Smooth animations and transitions

### PWA Requirements
- Works offline for cached content
- Installable on mobile devices
- Fast loading (< 3 seconds on 3G)
- Responsive design for all screen sizes

## Next Session Goals
1. Create functional PWA shell
2. Implement URL-based location loading
3. Display basic species grid with real data
4. Basic mobile styling working

---
**Status**: Ready for development - all planning and documentation complete.