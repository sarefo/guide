# Mobile Biodiversity PWA - Start Here

## 🚀 Quick Start for Next Session

### Current Status: **READY FOR DEVELOPMENT**

All planning, documentation, and setup is complete. The project is ready for active development.

### 📁 Project Files Created
```
/guide/
├── PROJECT_STATUS.md        ← Session memory & current status
├── API_INTEGRATION.md       ← iNaturalist API endpoints & examples  
├── IMPLEMENTATION_CHECKLIST.md ← Phase-by-phase development plan
├── README_START_HERE.md     ← This file
└── assets/icons.svg         ← Life group icons (moved from DuoNat)
```

### 🎯 Next Session Priorities (Phase 1)
1. **Create PWA shell** - `index.html` with mobile-first layout
2. **Implement location loading** - URL parameter `?place_id=40855`
3. **Basic API integration** - Load and display species data
4. **Responsive CSS** - Mobile-optimized grid for species images
5. **Life group filtering** - Use existing icons for filter buttons

### 📋 Quick Reference

#### Key Technical Decisions
- **Framework**: Vanilla JavaScript PWA
- **API**: iNaturalist REST API (`api.inaturalist.org/v1/`)
- **Location**: URL parameter `?place_id=40855&lang=en`
- **Icons**: Life groups available in `./assets/icons.svg`
- **Languages**: EN/ES/FR/DE support planned

#### Example iNaturalist API Calls
```javascript
// Get species for San Francisco
fetch('https://api.inaturalist.org/v1/observations/species_counts?place_id=40855&per_page=100&locale=en')

// Filter for birds only
fetch('https://api.inaturalist.org/v1/observations/species_counts?place_id=40855&iconic_taxon_id=3&locale=en')
```

#### Project Structure Ready
```
/
├── assets/icons.svg (✅ ready)
├── css/ (📁 created)  
├── js/ (📁 created)
├── lang/ (📁 created)
├── [index.html] (⏳ to create)
├── [manifest.json] (⏳ to create)  
└── [sw.js] (⏳ to create)
```

### 🔄 Development Flow
1. **Check PROJECT_STATUS.md** for current phase and blockers
2. **Follow IMPLEMENTATION_CHECKLIST.md** for step-by-step tasks
3. **Reference API_INTEGRATION.md** for endpoint details
4. **Update PROJECT_STATUS.md** when completing phases
5. **Use TodoWrite** to track individual task progress

### 🎨 Design Requirements Confirmed
- **Mobile-first**: Images fill available space
- **Text overlays**: Vernacular names elegantly displayed
- **Tap interactions**: Reveal Wikipedia + iNaturalist links
- **Life group filters**: Icon buttons using existing SVG symbols
- **QR sharing**: Generate QR codes for current location URL
- **Multi-language**: UI and species names in 4 languages

### 📱 Target URL Structure
```
https://app.com/?place_id=40855&lang=en
                 ↑              ↑
             Location ID    Language
            (San Francisco)   (English)
```

---
## 🔥 Ready to Code!
Everything is documented and organized. Start with **Phase 1** in the Implementation Checklist and begin building the PWA shell.