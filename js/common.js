// Common functions with fixed API configuration

// API Configuration - SỬA URL CHO ĐÚNG
const API_BASE = 'http://localhost:5209/api'; // URL backend

// Kiểm tra nếu đang ở localhost khác
if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    // Có thể backend đang chạy ở port khác
    console.log('Detected localhost, using API_BASE:', API_BASE);
}

// Auth Functions
function checkAuth() {
    const user = localStorage.getItem('currentUser');
    const token = localStorage.getItem('authToken');
    
    if (!user || !token) {
        console.log('No auth data found, redirecting to login');
        window.location.href = '/auth/login.html';
        return null;
    }
    
    try {
        const parsedUser = JSON.parse(user);
        console.log('Current user:', parsedUser);
        return parsedUser;
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.clear();
        window.location.href = '/auth/login.html';
        return null;
    }
}

function checkAdminAuth() {
    const user = checkAuth();
    if (user && user.role !== 'Admin' && user.Role !== 'Admin') {
        alert('Không có quyền truy cập!');
        window.location.href = '/user/index.html';
        return null;
    }
    return user;
}

async function logout() {
    try {
        // Clear localStorage
        localStorage.clear();
        
        // Redirect về trang login
        window.location.href = '/auth/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Force logout bằng cách clear storage và redirect
        localStorage.clear();
        window.location.href = '/auth/login.html';
    }
}

// API Helper with better error handling
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    
    const config = {
        method: 'GET',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    // Add Authorization header if token exists
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        console.log(`Making API call to: ${API_BASE}${endpoint}`);
        console.log('Config:', config);
        
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        console.log(`API Response status: ${response.status}`);
        
        if (!response.ok) {
            // Handle different error status codes
            if (response.status === 401) {
                console.warn('Unauthorized - token may be expired');
                // Don't auto-logout here, let the calling function handle it
                throw new Error(`Unauthorized (401): Token may be expired`);
            } else if (response.status === 403) {
                throw new Error(`Forbidden (403): Access denied`);
            } else if (response.status === 404) {
                throw new Error(`Not Found (404): ${endpoint}`);
            } else if (response.status === 500) {
                throw new Error(`Server Error (500): Internal server error`);
            } else {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
        }
        
        const data = await response.json();
        console.log('API Response data:', data);
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// UI Helpers
function showLoading(elementId, show = true) {
    const el = document.getElementById(elementId);
    if (el) {
        if (show) {
            el.innerHTML = `
                <div class="d-flex justify-content-center py-4">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;
        } else {
            el.innerHTML = '';
        }
    }
}

function showAlert(message, type = 'info') {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert.position-fixed');
    existingAlerts.forEach(alert => alert.remove());

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        max-width: 500px;
    `;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv && alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Format helpers
function formatPrice(price) {
    const numPrice = parseFloat(price || 0);
    return `$${numPrice.toFixed(2)}`;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleDateString('vi-VN');
    } catch (error) {
        return 'Invalid Date';
    }
}

function cleanGenres(genres) {
    if (!genres) return 'Not specified';
    
    if (genres.startsWith('[') && genres.endsWith(']')) {
        try {
            const parsed = JSON.parse(genres);
            if (Array.isArray(parsed)) {
                return parsed.filter(g => g && g.trim()).join(', ');
            }
        } catch (e) {
            // Fallback
            return genres
                .slice(1, -1)
                .replace(/"/g, '')
                .split(',')
                .map(g => g.trim())
                .filter(g => g)
                .join(', ');
        }
    }
    
    return genres.trim();
}

// Update header user info
function updateUserInfo() {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return;

    try {
        const user = JSON.parse(userStr);
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl) {
            userNameEl.textContent = user.FullName || user.fullName || user.name || user.email || 'User';
        }
        
        if (userAvatarEl) {
            userAvatarEl.src = user.AvatarUrl || user.avatarUrl || user.picture || 'http://via.placeholder.com/40';
        }
        
        console.log('Updated user info:', {
            name: user.FullName || user.fullName || user.name,
            avatar: user.AvatarUrl || user.avatarUrl || user.picture
        });
    } catch (error) {
        console.error('Error updating user info:', error);
    }
}

// Debug function to test API connection
async function testAPIConnection() {
    try {
        console.log('Testing API connection...');
        const response = await fetch(`${API_BASE}/BookApi/quick-stats`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API connection successful:', data);
            showAlert('API connection successful!', 'success');
        } else {
            console.log('❌ API connection failed:', response.status);
            showAlert(`API connection failed: ${response.status}`, 'danger');
        }
    } catch (error) {
        console.error('❌ API connection error:', error);
        showAlert(`API connection error: ${error.message}`, 'danger');
    }
}

// Debug function to test auth
async function testAuth() {
    try {
        const token = localStorage.getItem('authToken');
        console.log('Testing auth...');
        console.log('Token exists:', !!token);
        
        if (!token) {
            showAlert('No auth token found', 'warning');
            return;
        }

        const response = await fetch(`${API_BASE}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Auth token valid:', data);
            showAlert('Auth token is valid!', 'success');
        } else {
            console.log('❌ Auth token invalid:', response.status);
            showAlert(`Auth token invalid: ${response.status}`, 'danger');
        }
    } catch (error) {
        console.error('❌ Auth test error:', error);
        showAlert(`Auth test error: ${error.message}`, 'danger');
    }
}

// Initialize when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    // Update user info if logged in
    const user = localStorage.getItem('currentUser');
    if (user) {
        updateUserInfo();
    }

    console.log('Common.js initialized');
    console.log('API Base:', API_BASE);
    console.log('Current user:', localStorage.getItem('currentUser'));
    console.log('Auth token exists:', !!localStorage.getItem('authToken'));
});

// Make functions globally available
window.testAPIConnection = testAPIConnection;
window.testAuth = testAuth;
window.showAlert = showAlert;
window.apiCall = apiCall;
window.checkAuth = checkAuth;
window.logout = logout;
window.updateUserInfo = updateUserInfo;
window.cleanGenres = cleanGenres;