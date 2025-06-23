// API Configuration
const API_BASE = 'https://localhost:7288/api';
const GOOGLE_CLIENT_ID = '198205931206-445vmgejdn1s12d5lr9kqc3jj8o1el3u.apps.googleusercontent.com';

// Auth Functions
function checkAuth() {
    // const token = localStorage.getItem('authToken');
    // const user = localStorage.getItem('currentUser');
    
    // if (!token || !user) {
    //     window.location.href = '/login.html';
    //     return null;
    // }
    
    // return JSON.parse(user);
    const fakeUser = {
        id: 1,
        email: 'admin@test.com',
        fullName: 'Test Admin',
        role: 'Admin', // Đổi thành 'Customer' để test User
        avatarUrl: 'https://via.placeholder.com/40'
    };
    
    localStorage.setItem('currentUser', JSON.stringify(fakeUser));
    return fakeUser;
}

function checkAdminAuth() {
    const user = checkAuth();
    if (user && user.role !== 'Admin') {
        alert('Không có quyền truy cập!');
        window.location.href = '/user/index.html';
        return null;
    }
    return user;
}

function logout() {
    localStorage.clear();
    window.location.href = '/login.html';
}

// API Helper
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const data = await response.json();
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
        el.innerHTML = show ? '<div class="spinner-border" role="status"></div>' : '';
    }
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
}

// Format helpers
function formatPrice(price) {
    return `$${parseFloat(price).toFixed(2)}`;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('vi-VN');
}

// Update header user info
function updateUserInfo() {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    
    if (userNameEl) userNameEl.textContent = user.fullName || 'User';
    if (userAvatarEl) userAvatarEl.src = user.avatarUrl || 'https://via.placeholder.com/40';
}