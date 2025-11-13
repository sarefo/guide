class NotificationService {
    constructor() {
        this.activeNotifications = new Set();
        this.notificationQueue = [];
        this.isProcessing = false;
    }

    show(message, type = 'info', duration = 3000) {
        const notification = this.createNotification(message, type, duration);
        this.notificationQueue.push(notification);
        this.processQueue();
        return notification;
    }

    createNotification(message, type, duration) {
        const id = `notification-${Date.now()}-${Math.random()}`;
        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        const styles = {
            info: '#4CAF50',
            warning: '#FF9800',
            error: '#f44336',
            success: '#4CAF50'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${styles[type] || styles.info};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 90vw;
            word-wrap: break-word;
        `;

        return { element: notification, id, duration, type };
    }

    async processQueue() {
        if (this.isProcessing || this.notificationQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.notificationQueue.length > 0) {
            const notification = this.notificationQueue.shift();
            await this.displayNotification(notification);
        }
        
        this.isProcessing = false;
    }

    async displayNotification(notification) {
        document.body.appendChild(notification.element);
        this.activeNotifications.add(notification.id);

        await new Promise(resolve => setTimeout(resolve, notification.duration));

        if (this.activeNotifications.has(notification.id)) {
            await this.hideNotification(notification);
        }
    }

    async hideNotification(notification) {
        if (!this.activeNotifications.has(notification.id)) return;
        
        notification.element.style.animation = 'slideOut 0.3s ease forwards';
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (notification.element.parentNode) {
            notification.element.parentNode.removeChild(notification.element);
        }
        
        this.activeNotifications.delete(notification.id);
    }

    clearAll() {
        this.notificationQueue = [];
        this.activeNotifications.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        this.activeNotifications.clear();
    }

    showOffline(feature) {
        const messages = {
            search: window.i18n ? window.i18n.t('notification.offline.search') : 'Search requires internet connection',
            cache: window.i18n ? window.i18n.t('notification.offline.cache') : 'Caching requires internet connection',
            language: window.i18n ? window.i18n.t('notification.offline.language') : 'Language change requires internet connection',
            default: window.i18n ? window.i18n.t('notification.offline') : 'You are offline'
        };
        
        const message = messages[feature] || messages.default;
        return this.show(message, 'warning');
    }

    showNetworkStatus(isOnline) {
        if (isOnline) {
            const message = window.i18n ? window.i18n.t('status.online') : 'Back online';
            return this.show(message, 'success');
        } else {
            const message = window.i18n ? window.i18n.t('status.offline') : 'You are offline';
            return this.show(message, 'warning');
        }
    }
}

// Initialize notification service in App namespace
App.notificationService = new NotificationService();