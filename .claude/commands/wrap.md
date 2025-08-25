---
description: Update build date and optionally increment version, then commit to git
argument-hint: "[major|minor|patch]"
---

# Update Build Date, Version, and Commit

This command updates the build date, optionally increments the version number, and creates a git commit.

## Usage
```
/wrap           # Just update build date and commit
/wrap patch     # Increment patch version (1.1.3 → 1.1.4)
/wrap minor     # Increment minor version (1.1.3 → 1.2.0)
/wrap major     # Increment major version (1.1.3 → 2.0.0)
```

## Instructions for Claude

When the user runs this command:

1. **Always update the build date:**
   - Use `date '+%Y-%m-%d %H:%M'` to get current date/time
   - Update in `/js/config.js`:
   ```javascript
   const APP_CONFIG = {
       version: 'X.X.X',
       buildDate: 'YYYY-MM-DD HH:MM',  // Update this to current date/time
       ...
   };
   ```

2. **If version increment is specified (major/minor/patch):**
   - Read current version from `/js/config.js`
   - Increment according to type:
     - patch: 1.1.3 → 1.1.4
     - minor: 1.1.3 → 1.2.0  
     - major: 1.1.3 → 2.0.0
   - Update version in exactly 2 places:
     ```javascript
     // 1. In /js/config.js:
     const APP_CONFIG = {
         version: 'X.X.X',  // Update this
         ...
     };
     
     // 2. In /sw.js:
     const VERSION = 'X.X.X'; // Must match config.js version
     ```

3. **Create git commit:**
   - Commit all changed files to github
   - add sensible commit information

## Example workflows:

### Just update build date:
```bash
# User runs: /wrap

# Claude should:
1. Get current date/time: date '+%Y-%m-%d %H:%M' → "2025-08-25 14:30"
2. Update buildDate in config.js
3. Commit all changes to Github
```

### Increment version:
```bash
# User runs: /wrap patch

# Claude should:
1. Get current date/time: date '+%Y-%m-%d %H:%M' → "2025-08-25 14:30"
2. Read current version from config.js (e.g., "1.1.3")
3. Increment patch: "1.1.3" → "1.1.4"
4. Update config.js with new version and build date
5. Update sw.js with new version
6. Commit all changes to Github
```

## Important notes:
- Build date is ALWAYS updated (even without version change)
- Version is only incremented if explicitly requested
- config.js is the single source of truth for version
- Service Worker (sw.js) needs its own VERSION constant for cache management
- All other JavaScript files automatically use window.APP_CONFIG
- Documentation files do not contain version numbers
