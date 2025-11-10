# Claude Working Instructions - Mobile Biodiversity PWA

## Project Context
This is a **mobile-first Progressive Web App** for displaying location-based biodiversity data using the iNaturalist API. The app shows species images with elegant text overlays and supports multi-language functionality.

## Key Working Files  
- **docs/PROJECT_STATUS.md** - Current development phase and session memory
- **docs/IMPLEMENTATION_CHECKLIST.md** - Step-by-step development tasks  
- **docs/API_INTEGRATION.md** - iNaturalist API endpoints and examples
- **README.md** - User-facing project documentation

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
1. **Check docs/PROJECT_STATUS.md** for current phase
2. **Update TodoWrite** tool to track progress  
3. **Follow docs/IMPLEMENTATION_CHECKLIST.md** for tasks
4. **Update docs/PROJECT_STATUS.md** when completing phases
5. **Reference docs/API_INTEGRATION.md** for API details
6. **Maintain documentation** - Update docs/ files and README.md to reflect actual app state

## Technical Stack
- HTML5/CSS3/Vanilla JS (PWA)
- iNaturalist API (`api.inaturalist.org/v1/`)  
- QRCode.js for sharing functionality
- Service Worker for offline capability

## Development Environment
- **Local server already running** on port 8000 (python3 -m http.server 8000)
- Access app at: http://localhost:8000/guide
- No need to start new server unless explicitly stopped

## Version Management
When incrementing version (user request):
1. Update `js/config.js` line 4: `version: '1.X.X'` - **SINGLE SOURCE OF TRUTH**
2. sw.js automatically imports from config.js
3. Increment only the last digit (patch version)
4. HTML version updates automatically from config

## Git Workflow & Merging Claude's Changes

**Environment**: Claude runs in a sandboxed environment with git proxy access to your repository.

**Branch Pattern**: Claude works on feature branches named `claude/<description>-<session-id>`
- Example: `claude/code-review-improvements-011CUzZRApfAQRrBKWechRkZ`
- Changes are automatically pushed to origin
- You need to merge to main manually

**🌐 Web-Based Merge** (No command line! Just click the link):

Visit this URL to create a Pull Request with one click:
```
https://github.com/sarefo/guide/compare/main...claude/code-review-improvements-011CUzZRApfAQRrBKWechRkZ
```

Then on GitHub:
1. Click "Create pull request"
2. Review changes
3. Click "Merge pull request"
4. Click "Confirm merge"
5. Done! ✅

**Alternative: Command Line Merge** (from your local machine):
```bash
# One-liner: Fetch, checkout main, merge, and push
git fetch origin && git checkout main && git merge origin/claude/code-review-improvements-011CUzZRApfAQRrBKWechRkZ && git push origin main
```

**Check what's new on Claude's branch**:
```bash
git fetch origin
git log main..origin/claude/code-review-improvements-011CUzZRApfAQRrBKWechRkZ --oneline
```

## Documentation Maintenance
**IMPORTANT**: After implementing features or making significant changes:
- Update docs/PROJECT_STATUS.md with current phase and completed features
- Verify docs/IMPLEMENTATION_CHECKLIST.md reflects remaining tasks  
- Update README.md if user-facing functionality changes
- Keep this CLAUDE.md file current with actual project structure

Always maintain session continuity by updating status files and using TodoWrite tool.
- server already running at :8000