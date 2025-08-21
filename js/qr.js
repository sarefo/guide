class QRManager {
    constructor() {
        this.qrCodeLibLoaded = false;
        this.init();
    }

    async init() {
        await this.loadQRCodeLibrary();
    }

    async loadQRCodeLibrary() {
        if (window.QRCode) {
            this.qrCodeLibLoaded = true;
            return;
        }

        try {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
            script.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });

            this.qrCodeLibLoaded = true;
            console.log('✅ QR code library loaded');
        } catch (error) {
            console.warn('⚠️ QR code library failed to load:', error);
            this.qrCodeLibLoaded = false;
        }
    }

    async generateQRCode(text, container) {
        if (!this.qrCodeLibLoaded) {
            await this.loadQRCodeLibrary();
        }

        if (!this.qrCodeLibLoaded || !window.QRCode) {
            this.showQRFallback(text, container);
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            
            await window.QRCode.toCanvas(canvas, text, {
                width: 200,
                height: 200,
                margin: 1,
                color: {
                    dark: '#2E7D32',
                    light: '#FFFFFF'
                },
                errorCorrectionLevel: 'M'
            });

            container.innerHTML = '';
            container.appendChild(canvas);

        } catch (error) {
            console.error('QR code generation failed:', error);
            this.showQRFallback(text, container);
        }
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
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📱</div>
                <div style="font-size: 0.9rem;">QR code not available</div>
                <div style="font-size: 0.8rem; margin-top: 0.5rem;">Copy URL below to share</div>
            </div>
        `;
    }

    async shareLocation() {
        const modal = document.getElementById('share-modal');
        const qrContainer = document.getElementById('qr-code');
        const urlElement = document.getElementById('share-url');
        const copyButton = document.getElementById('copy-url');

        if (!modal) return;

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