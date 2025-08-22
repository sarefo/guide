class I18nManager {
    constructor() {
        this.currentLang = 'en';
        this.translations = {};
        this.init();
    }

    init() {
        this.currentLang = this.detectLanguage();
        this.loadTranslations();
    }

    detectLanguage() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        
        if (urlLang && ['en', 'es', 'fr', 'de'].includes(urlLang)) {
            return urlLang;
        }
        
        const browserLang = navigator.language.split('-')[0];
        if (['en', 'es', 'fr', 'de'].includes(browserLang)) {
            return browserLang;
        }
        
        return 'en';
    }

    async loadTranslations() {
        try {
            const response = await fetch(`lang/${this.currentLang}.json`);
            if (response.ok) {
                this.translations = await response.json();
                this.translatePage();
            }
        } catch (error) {
            console.warn('Translation loading failed, using fallback:', error);
            this.translations = this.getFallbackTranslations();
        }
    }

    getFallbackTranslations() {
        return {
            "app.title": "Biodiversity Explorer",
            "loading.species": "Loading species data...",
            "error.network": "Unable to load data. Please check your connection.",
            "filter.all": "All",
            "filter.birds": "Birds", 
            "filter.amphibians": "Amphibians",
            "filter.reptiles": "Reptiles",
            "filter.mammals": "Mammals",
            "filter.fishes": "Fishes",
            "filter.plants": "Plants",
            "filter.fungi": "Fungi",
            "location.search.placeholder": "Search for a location...",
            "location.change": "Change location",
            "share.location": "Share location",
            "species.observations": "observations",
            "modal.wikipedia": "Wikipedia",
            "modal.inaturalist": "iNaturalist",
            "help.links.donate": "Donate",
            "notification.copied": "URL copied to clipboard!",
            "notification.offline": "You are offline",
            "notification.online": "Connection restored"
        };
    }

    translatePage() {
        // Translate text content
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation !== key) {
                el.textContent = translation;
            }
        });

        // Translate placeholders
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation !== key) {
                el.placeholder = translation;
            }
        });
    }

    t(key) {
        return this.translations[key] || key;
    }

    getCurrentLang() {
        return this.currentLang;
    }

    async setLanguage(lang) {
        if (this.currentLang === lang) return;
        
        this.currentLang = lang;
        await this.loadTranslations();
        
        const event = new CustomEvent('languageChanged', {
            detail: { language: lang }
        });
        window.dispatchEvent(event);
        
        // Trigger re-rendering of dynamic content
        if (window.speciesManager && window.speciesManager.currentSpecies) {
            window.speciesManager.displaySpecies(window.speciesManager.currentSpecies);
        }
    }
}

window.i18n = new I18nManager();