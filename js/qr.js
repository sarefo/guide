class QRManager {
    constructor() {
        this.qrCodeLibLoaded = false;
    }

    async init() {
        // QR functionality disabled - modern browsers handle URL sharing natively
    }

    async loadQRCodeLibrary() {
        // QR library loading disabled
        this.qrCodeLibLoaded = false;
    }

    async generateQRCode(text, container) {
        // Always show fallback - QR generation disabled
        this.showQRFallback(text, container);
    }

    showQRFallback(text, container) {
        container.innerHTML = `
            <div style="
                width: 200px; 
                height: 200px; 
                border: 2px dashed #ccc; 
                display: flex; 
                flex-direction: column;
                align-items: center; 
                justify-content: center;
                text-align: center;
                padding: 1rem;
                color: #666;
                background: #f9f9f9;
            ">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔗</div>
                <div style="font-size: 0.9rem;">Use native browser sharing</div>
                <div style="font-size: 0.8rem; margin-top: 0.5rem;">Copy URL below or use share button</div>
            </div>
        `;
    }

    async shareLocation() {
        const modal = document.getElementById('share-modal');
        const qrContainer = document.getElementById('qr-code');
        const urlElement = document.getElementById('share-url');
        const copyButton = document.getElementById('copy-url');

        if (!modal) return;

        // Get current URL which includes place_id, lang, and taxon_id parameters
        const currentUrl = window.location.href;
        
        if (qrContainer) {
            await this.generateQRCode(currentUrl, qrContainer);
        }

        if (urlElement) {
            urlElement.textContent = currentUrl;
        }

        if (copyButton) {
            copyButton.onclick = () => {
                this.copyToClipboard(currentUrl);
            };
        }

        modal.style.display = 'flex';

        const closeModal = () => {
            modal.style.display = 'none';
        };

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.onclick = closeModal;
        }
    }

    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.cssText = 'position: absolute; left: -9999px; top: -9999px;';
                document.body.appendChild(textArea);
                textArea.select();
                textArea.setSelectionRange(0, 99999);
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (!successful) {
                    throw new Error('Copy command failed');
                }
            }
            
            this.showCopySuccess();
        } catch (error) {
            console.error('Copy failed:', error);
            this.showCopyError(text);
        }
    }

    showCopySuccess() {
        if (window.app) {
            window.app.showNotification('URL copied to clipboard!', 'success');
        } else {
            alert('URL copied to clipboard!');
        }
    }

    showCopyError(text) {
        if (window.app) {
            window.app.showNotification('Copy failed. Please copy manually.', 'error');
        } else {
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
            
            if (isMobile) {
                alert('Please long-press the URL below to copy it:\n\n' + text);
            } else {
                prompt('Please copy this URL:', text);
            }
        }
    }

    getQRStatus() {
        return {
            libraryLoaded: this.qrCodeLibLoaded,
            available: this.qrCodeLibLoaded && !!window.QRCode
        };
    }
}

window.qrManager = new QRManager();