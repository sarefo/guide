# Claude Working Instructions - Mobile Biodiversity PWA

## Project Context
This is a **mobile-first Progressive Web App** for displaying location-based biodiversity data using the iNaturalist API. The app shows species images with elegant text overlays and supports multi-language functionality.

## Key Working Files
- **PROJECT_STATUS.md** - Current development phase and session memory
- **IMPLEMENTATION_CHECKLIST.md** - Step-by-step development tasks  
- **API_INTEGRATION.md** - iNaturalist API endpoints and examples
- **README_START_HERE.md** - Quick start guide for new sessions

## Current Status
**Phase**: Ready for development (setup complete)  
**Next Priority**: Create PWA shell and URL-based location loading  
**Location**: URL parameter system `?place_id=40855&lang=en`

## Development Approach
- **Vanilla JavaScript PWA** (maintainable by Claude Code)
- **Mobile-first responsive design** (images fill screen, text overlays)
- **iNaturalist REST API** for species data
- **Life group filtering** using icons in `./assets/icons.svg`

## Key Requirements
- Images fill available mobile space with vernacular name overlays
- Tap species → reveal Wikipedia/iNaturalist links  
- QR code sharing for location URLs
- Multi-language support (EN/ES/FR/DE)
- URL-driven location loading

## Session Workflow
1. **Check PROJECT_STATUS.md** for current phase
2. **Update TodoWrite** tool to track progress
3. **Follow IMPLEMENTATION_CHECKLIST.md** for tasks
4. **Update PROJECT_STATUS.md** when completing phases
5. **Reference API_INTEGRATION.md** for API details

## Technical Stack
- HTML5/CSS3/Vanilla JS (PWA)
- iNaturalist API (`api.inaturalist.org/v1/`)  
- QRCode.js for sharing functionality
- Service Worker for offline capability

Always maintain session continuity by updating status files and using TodoWrite tool.