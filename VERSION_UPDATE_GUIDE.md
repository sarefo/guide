# Version Update Guide

## When updating the app version, only update these 2 files:

### 1. `/js/config.js`
```javascript
const APP_CONFIG = {
    version: 'X.X.X',      // Update version here
    buildDate: 'YYYY-MM-DD', // Update build date here
    ...
};
```

### 2. `/sw.js`
```javascript
const VERSION = 'X.X.X'; // Must match config.js version
```

## That's it!

All JavaScript files automatically use the version from `config.js`:
- `app.js` - Uses `window.APP_CONFIG.version`
- `updates.js` - Uses `window.APP_CONFIG.version`
- `cache.js` - Uses `window.APP_CONFIG.cacheExpiry`

Documentation files no longer contain version numbers to maintain.

## Current Version
- **Version**: 1.1.3
- **Build Date**: 2025-08-25

## Version History
- 1.1.3 - Code refactoring, centralized config
- 1.1.2 - Bug fixes and optimizations
- 1.1.1 - Offline improvements
- 1.1.0 - Custom taxa support