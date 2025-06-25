// === HARDCOVER-STYLE UI COMPONENTS ===

/**
 * Enhanced UI functionality for Hardcover-inspired BookStore
 * This file contains reusable UI components and interactions
 */

// === SMOOTH SCROLLING ===
function smoothScrollTo(element, duration = 500) {
    const target = typeof element === 'string' ? document.querySelector(element) : element;
    if (!target) return;

    const targetPosition = target.offsetTop;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = ease(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    function ease(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
}

// === PROGRESSIVE IMAGE LOADING ===
class ProgressiveImageLoader {
    constructor() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                    this.observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '50px'
        });
    }

    observe(img) {
        this.observer.observe(img);
    }

    loadImage(img) {
        const placeholder = img.src;
        const fullSrc = img.dataset.src || img.src;
        
        // Add loading state
        img.style.filter = 'blur(5px)';
        img.style.transition = 'filter 0.3s ease';
        
        const tempImg = new Image();
        tempImg.onload = () => {
            img.src = fullSrc;
            img.style.filter = 'none';
            img.classList.add('hc-image-loaded');
        };
        tempImg.onerror = () => {
            img.src = 'http://via.placeholder.com/200x300?text=No+Image';
            img.style.filter = 'none';
        };
        tempImg.src = fullSrc;
    }
}

// Initialize progressive loading
const imageLoader = new ProgressiveImageLoader();

// === ADVANCED SEARCH WITH DEBOUNCING ===
class SmartSearch {
    constructor(inputElement, callback, delay = 300) {
        this.input = inputElement;
        this.callback = callback;
        this.delay = delay;
        this.timeout = null;
        this.lastQuery = '';
        this.cache = new Map();
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.input.addEventListener('input', (e) => {
            this.handleInput(e.target.value);
        });

        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.executeSearch(this.input.value, true);
            }
        });

        this.input.addEventListener('focus', () => {
            this.input.classList.add('hc-search-focused');
        });

        this.input.addEventListener('blur', () => {
            this.input.classList.remove('hc-search-focused');
        });
    }

    handleInput(query) {
        clearTimeout(this.timeout);
        
        // Don't search if query is the same as last time
        if (query === this.lastQuery) return;
        
        this.timeout = setTimeout(() => {
            this.executeSearch(query);
        }, this.delay);
    }

    executeSearch(query, immediate = false) {
        query = query.trim();
        this.lastQuery = query;

        if (query.length === 0) {
            this.callback('', []);
            return;
        }

        if (query.length < 2 && !immediate) {
            return;
        }

        // Check cache first
        if (this.cache.has(query)) {
            this.callback(query, this.cache.get(query));
            return;
        }

        // Visual feedback
        this.input.classList.add('hc-search-loading');
        
        this.callback(query, null).then(results => {
            // Cache results
            this.cache.set(query, results);
            this.input.classList.remove('hc-search-loading');
        }).catch(error => {
            console.error('Search error:', error);
            this.input.classList.remove('hc-search-loading');
        });
    }

    clearCache() {
        this.cache.clear();
    }
}

// === MODAL MANAGER ===
class ModalManager {
    constructor() {
        this.modals = new Map();
        this.currentModal = null;
        this.setupGlobalListeners();
    }

    setupGlobalListeners() {
        // ESC key closes modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal) {
                this.close(this.currentModal);
            }
        });

        // Prevent body scroll when modal is open
        document.addEventListener('modal-open', () => {
            document.body.style.overflow = 'hidden';
        });

        document.addEventListener('modal-close', () => {
            document.body.style.overflow = '';
        });
    }

    register(id, element) {
        this.modals.set(id, element);
        
        // Setup close button
        const closeBtn = element.querySelector('[data-modal-close]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close(id));
        }

        // Close on overlay click
        element.addEventListener('click', (e) => {
            if (e.target === element) {
                this.close(id);
            }
        });
    }

    open(id, data = null) {
        const modal = this.modals.get(id);
        if (!modal) return;

        this.currentModal = id;
        modal.classList.remove('hc-hidden');
        modal.classList.add('hc-modal-opening');
        
        // Trigger custom event
        document.dispatchEvent(new CustomEvent('modal-open', { detail: { id, data } }));
        
        // Animation
        requestAnimationFrame(() => {
            modal.classList.remove('hc-modal-opening');
            modal.classList.add('hc-modal-open');
        });

        return modal;
    }

    close(id) {
        const modal = this.modals.get(id);
        if (!modal) return;

        modal.classList.add('hc-modal-closing');
        
        setTimeout(() => {
            modal.classList.add('hc-hidden');
            modal.classList.remove('hc-modal-open', 'hc-modal-closing');
            this.currentModal = null;
            
            // Trigger custom event
            document.dispatchEvent(new CustomEvent('modal-close', { detail: { id } }));
        }, 200);
    }

    isOpen(id) {
        return this.currentModal === id;
    }
}

// Global modal manager instance
const modalManager = new ModalManager();

// === INFINITE SCROLL ===
class InfiniteScroll {
    constructor(container, loadMore, options = {}) {
        this.container = container;
        this.loadMore = loadMore;
        this.options = {
            threshold: 200,
            debounce: 100,
            ...options
        };
        
        this.loading = false;
        this.hasMore = true;
        this.page = 1;
        
        this.setupScrollListener();
    }

    setupScrollListener() {
        let timeout;
        
        window.addEventListener('scroll', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.checkScroll();
            }, this.options.debounce);
        });
    }

    checkScroll() {
        if (this.loading || !this.hasMore) return;

        const scrollTop = window.pageYOffset;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        if (scrollTop + windowHeight >= documentHeight - this.options.threshold) {
            this.loadNextPage();
        }
    }

    async loadNextPage() {
        if (this.loading || !this.hasMore) return;
        
        this.loading = true;
        this.showLoadingIndicator();
        
        try {
            const result = await this.loadMore(this.page + 1);
            
            if (result && result.hasMore !== false) {
                this.page++;
            } else {
                this.hasMore = false;
            }
        } catch (error) {
            console.error('Error loading more content:', error);
        } finally {
            this.loading = false;
            this.hideLoadingIndicator();
        }
    }

    showLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'hc-infinite-loading';
        indicator.innerHTML = `
            <div class="hc-spinner"></div>
            <p>Đang tải thêm sách...</p>
        `;
        indicator.style.cssText = `
            text-align: center;
            padding: var(--hc-space-xl);
            grid-column: 1 / -1;
        `;
        this.container.appendChild(indicator);
    }

    hideLoadingIndicator() {
        const indicator = this.container.querySelector('.hc-infinite-loading');
        if (indicator) {
            indicator.remove();
        }
    }

    reset() {
        this.loading = false;
        this.hasMore = true;
        this.page = 1;
        this.hideLoadingIndicator();
    }
}

// === NOTIFICATION SYSTEM ===
class NotificationSystem {
    constructor() {
        this.container = this.createContainer();
        this.notifications = new Map();
        this.maxNotifications = 5;
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'hc-notifications';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1100;
            max-width: 400px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
        return container;
    }

    show(message, type = 'info', duration = 4000, options = {}) {
        const id = Date.now() + Math.random();
        const notification = this.createNotification(id, message, type, options);
        
        this.notifications.set(id, notification);
        this.container.appendChild(notification.element);
        
        // Limit number of notifications
        if (this.notifications.size > this.maxNotifications) {
            const firstId = this.notifications.keys().next().value;
            this.hide(firstId);
        }
        
        // Auto-hide
        if (duration > 0) {
            notification.timeout = setTimeout(() => {
                this.hide(id);
            }, duration);
        }
        
        // Animate in
        requestAnimationFrame(() => {
            notification.element.classList.add('hc-notification-show');
        });
        
        return id;
    }

    createNotification(id, message, type, options) {
        const element = document.createElement('div');
        element.className = `hc-notification hc-notification-${type}`;
        element.style.cssText = `
            background: var(--hc-bg-primary);
            border: 1px solid var(--hc-border-light);
            border-radius: 12px;
            padding: var(--hc-space-md);
            margin-bottom: var(--hc-space-sm);
            box-shadow: var(--hc-shadow-lg);
            transform: translateX(100%);
            transition: transform 0.3s ease, opacity 0.3s ease;
            pointer-events: auto;
            display: flex;
            align-items: flex-start;
            gap: var(--hc-space-sm);
            max-width: 100%;
            word-wrap: break-word;
        `;

        const colors = {
            success: 'var(--hc-success)',
            error: 'var(--hc-danger)',
            warning: 'var(--hc-warning)',
            info: 'var(--hc-accent)'
        };

        const icons = {
            success: 'check-circle',
            error: 'exclamation-triangle',
            warning: 'exclamation-circle',
            info: 'info-circle'
        };

        element.innerHTML = `
            <i class="bi bi-${icons[type]}" style="color: ${colors[type]}; font-size: 1.2rem; margin-top: 2px;"></i>
            <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 4px;">${options.title || this.getDefaultTitle(type)}</div>
                <div style="color: var(--hc-text-secondary); font-size: 0.9rem;">${message}</div>
            </div>
            <button class="hc-notification-close" style="
                background: none;
                border: none;
                color: var(--hc-text-secondary);
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: var(--hc-transition);
            ">
                <i class="bi bi-x"></i>
            </button>
        `;

        // Close button
        const closeBtn = element.querySelector('.hc-notification-close');
        closeBtn.addEventListener('click', () => this.hide(id));
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'var(--hc-bg-secondary)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
        });

        return {
            element,
            timeout: null
        };
    }

    getDefaultTitle(type) {
        const titles = {
            success: 'Thành công',
            error: 'Lỗi',
            warning: 'Cảnh báo',
            info: 'Thông tin'
        };
        return titles[type] || 'Thông báo';
    }

    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        if (notification.timeout) {
            clearTimeout(notification.timeout);
        }

        notification.element.style.transform = 'translateX(100%)';
        notification.element.style.opacity = '0';

        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
        }, 300);
    }

    hideAll() {
        for (const id of this.notifications.keys()) {
            this.hide(id);
        }
    }
}

// CSS for notifications
const notificationCSS = `
.hc-notification-show {
    transform: translateX(0) !important;
}

.hc-notification:hover {
    box-shadow: var(--hc-shadow-xl);
}
`;

// Add CSS to document
const notificationStyle = document.createElement('style');
notificationStyle.textContent = notificationCSS;
document.head.appendChild(notificationStyle);

// Global notification system
const notifications = new NotificationSystem();

// === THEME MANAGER ===
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('hc-theme') || 'light';
        this.applyTheme(this.currentTheme);
        this.setupThemeToggle();
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        localStorage.setItem('hc-theme', theme);
        
        // Emit theme change event
        document.dispatchEvent(new CustomEvent('theme-change', { 
            detail: { theme } 
        }));
    }

    toggle() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    setupThemeToggle() {
        // Create theme toggle button if it doesn't exist
        const existingToggle = document.querySelector('.hc-theme-toggle');
        if (existingToggle) return;

        const toggle = document.createElement('button');
        toggle.className = 'hc-btn hc-btn-secondary hc-theme-toggle';
        toggle.innerHTML = this.currentTheme === 'light' 
            ? '<i class="bi bi-moon"></i>' 
            : '<i class="bi bi-sun"></i>';
        toggle.title = 'Chuyển đổi chế độ sáng/tối';
        
        toggle.addEventListener('click', () => {
            this.toggle();
            toggle.innerHTML = this.currentTheme === 'light' 
                ? '<i class="bi bi-moon"></i>' 
                : '<i class="bi bi-sun"></i>';
        });

        // Add to nav actions
        const navActions = document.querySelector('.hc-nav-actions');
        if (navActions) {
            navActions.insertBefore(toggle, navActions.firstChild);
        }
    }
}

// === PERFORMANCE MONITOR ===
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoad: 0,
            apiCalls: [],
            renderTime: 0,
            imageLoads: 0
        };
        
        this.startTime = performance.now();
        this.setupObservers();
    }

    setupObservers() {
        // Page load time
        window.addEventListener('load', () => {
            this.metrics.pageLoad = performance.now() - this.startTime;
            console.log(`📊 Page loaded in ${this.metrics.pageLoad.toFixed(2)}ms`);
        });

        // API call monitoring
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const startTime = performance.now();
            try {
                const response = await originalFetch(...args);
                const endTime = performance.now();
                this.metrics.apiCalls.push({
                    url: args[0],
                    duration: endTime - startTime,
                    status: response.status,
                    timestamp: Date.now()
                });
                return response;
            } catch (error) {
                const endTime = performance.now();
                this.metrics.apiCalls.push({
                    url: args[0],
                    duration: endTime - startTime,
                    status: 'error',
                    error: error.message,
                    timestamp: Date.now()
                });
                throw error;
            }
        };
    }

    getMetrics() {
        return {
            ...this.metrics,
            averageApiTime: this.getAverageApiTime(),
            slowApiCalls: this.getSlowApiCalls()
        };
    }

    getAverageApiTime() {
        if (this.metrics.apiCalls.length === 0) return 0;
        const total = this.metrics.apiCalls.reduce((sum, call) => sum + call.duration, 0);
        return total / this.metrics.apiCalls.length;
    }

    getSlowApiCalls(threshold = 1000) {
        return this.metrics.apiCalls.filter(call => call.duration > threshold);
    }

    logPerformance() {
        console.group('📊 Performance Metrics');
        console.log('Page Load:', `${this.metrics.pageLoad.toFixed(2)}ms`);
        console.log('Total API Calls:', this.metrics.apiCalls.length);
        console.log('Average API Time:', `${this.getAverageApiTime().toFixed(2)}ms`);
        console.log('Slow API Calls:', this.getSlowApiCalls().length);
        console.groupEnd();
    }
}

// === UTILITY FUNCTIONS ===

// Debounce function
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Format currency
function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
}

// Format date
function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    
    return new Intl.DateTimeFormat('vi-VN', {
        ...defaultOptions,
        ...options
    }).format(new Date(date));
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        notifications.show('Đã sao chép vào clipboard', 'success', 2000);
        return true;
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        notifications.show('Không thể sao chép', 'error', 2000);
        return false;
    }
}

// === GLOBAL INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    // Initialize global components
    window.themeManager = new ThemeManager();
    window.performanceMonitor = new PerformanceMonitor();
    
    // Register main modal
    const bookModal = document.getElementById('bookModal');
    if (bookModal) {
        modalManager.register('bookDetail', bookModal);
    }
    
    // Setup progressive image loading for existing images
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageLoader.observe(img);
    });
    
    // Setup smart search if search input exists
    const searchInput = document.getElementById('searchInput');
    if (searchInput && typeof searchBooks === 'function') {
        window.smartSearch = new SmartSearch(
            searchInput,
            async (query, cachedResults) => {
                if (cachedResults) {
                    // Use cached results
                    return cachedResults;
                }
                
                // Perform actual search
                await searchBooks(query);
                return []; // Return empty array, actual results handled by searchBooks
            }
        );
    }
    
    console.log('🎨 Hardcover UI components initialized');
});

// === EXPORT FOR EXTERNAL USE ===
window.HardcoverUI = {
    ProgressiveImageLoader,
    SmartSearch,
    ModalManager: modalManager,
    InfiniteScroll,
    NotificationSystem: notifications,
    ThemeManager,
    PerformanceMonitor,
    utils: {
        debounce,
        throttle,
        formatCurrency,
        formatDate,
        copyToClipboard,
        smoothScrollTo
    }
};