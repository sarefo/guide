// PT Phrases App - Main Logic

class PhraseApp {
    constructor() {
        this.currentCategory = 'all';
        this.phrases = PHRASES;
        this.init();
    }

    init() {
        this.renderPhrases();
        this.setupCategoryFilters();
    }

    renderPhrases(category = 'all') {
        const container = document.getElementById('phrases-container');

        // Filter phrases by category
        const filteredPhrases = category === 'all'
            ? this.phrases
            : this.phrases.filter(p => p.category === category);

        // Clear container
        container.innerHTML = '';

        // Show empty state if no phrases
        if (filteredPhrases.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No phrases in this category yet</p>
                </div>
            `;
            return;
        }

        // Render phrase cards
        filteredPhrases.forEach(phrase => {
            const card = this.createPhraseCard(phrase);
            container.appendChild(card);
        });
    }

    createPhraseCard(phrase) {
        const card = document.createElement('div');
        card.className = 'phrase-card';

        card.innerHTML = `
            <div class="phrase-category-tag">${this.getCategoryLabel(phrase.category)}</div>
            <div class="phrase-pt">${phrase.pt}</div>
            <div class="phrase-ipa">${phrase.ipa}</div>
            <div class="phrase-en">${phrase.en}</div>
        `;

        return card;
    }

    getCategoryLabel(category) {
        const labels = {
            'basics': '🗣️ Basics',
            'navigation': '🗺️ Navigation',
            'prices': '💰 Prices',
            'boats': '⛵ Boats',
            'food': '🍎 Food',
            'time': '⏰ Time'
        };
        return labels[category] || category;
    }

    setupCategoryFilters() {
        const buttons = document.querySelectorAll('.category-btn');

        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active state
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Get category and render
                const category = btn.dataset.category;
                this.currentCategory = category;
                this.renderPhrases(category);

                // Scroll to top of phrases
                document.getElementById('phrases-container').scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            });
        });
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PhraseApp());
} else {
    new PhraseApp();
}
