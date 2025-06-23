// Supabase Configuration
const SUPABASE_URL = 'https://kajpxaorxhrmwwgpieaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthanB4YW9yeGhybXd3Z3BpZWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQxNjc0NzQsImV4cCI6MjA0OTc0MzQ3NH0.Tb4yRzWFXFYUqKACQ5RdOo6i8xJhfpfFWYJyJRQ-YdU';

// Initialize Supabase (assuming Supabase JS is loaded)
let supabase;
if (typeof window !== 'undefined' && window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Auth Functions
function checkAuth() {
    const user = localStorage.getItem('currentUser');
    
    if (!user) {
        window.location.href = '/auth/login.html';
        return null;
    }
    
    try {
        return JSON.parse(user);
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.clear();
        window.location.href = '/auth/login.html';
        return null;
    }
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

async function logout() {
    try {
        // Sign out từ Supabase
        if (supabase) {
            await supabase.auth.signOut();
        }
        
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

// Supabase API Helper
async function supabaseCall(table, operation, options = {}) {
    if (!supabase) {
        throw new Error('Supabase not initialized');
    }

    try {
        let query = supabase.from(table);
        
        switch (operation) {
            case 'select':
                query = query.select(options.select || '*');
                if (options.eq) {
                    query = query.eq(options.eq.column, options.eq.value);
                }
                if (options.range) {
                    query = query.range(options.range.from, options.range.to);
                }
                if (options.order) {
                    query = query.order(options.order.column, { ascending: options.order.ascending !== false });
                }
                if (options.limit) {
                    query = query.limit(options.limit);
                }
                break;
                
            case 'insert':
                query = query.insert(options.data);
                break;
                
            case 'update':
                query = query.update(options.data);
                if (options.eq) {
                    query = query.eq(options.eq.column, options.eq.value);
                }
                break;
                
            case 'delete':
                if (options.eq) {
                    query = query.delete().eq(options.eq.column, options.eq.value);
                }
                break;
        }

        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        return data;
    } catch (error) {
        console.error('Supabase call error:', error);
        throw error;
    }
}

// Legacy API Helper (để backward compatibility với book API)
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
        const API_BASE = 'https://localhost:7288/api';
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
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
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}

// Format helpers
function formatPrice(price) {
    return `$${parseFloat(price || 0).toFixed(2)}`;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
}

// Update header user info
function updateUserInfo() {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    
    if (userNameEl) userNameEl.textContent = user.full_name || user.fullName || 'User';
    if (userAvatarEl) userAvatarEl.src = user.avatar_url || user.avatarUrl || 'https://via.placeholder.com/40';
}

// Supabase Auth State Listener
function initAuthListener() {
    if (supabase) {
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            
            if (event === 'SIGNED_OUT') {
                localStorage.clear();
                if (window.location.pathname !== '/auth/login.html') {
                    window.location.href = '/auth/login.html';
                }
            } else if (event === 'SIGNED_IN' && session) {
                // Cập nhật user info từ database
                try {
                    const userData = await supabaseCall('users', 'select', {
                        eq: { column: 'id', value: session.user.id }
                    });
                    
                    if (userData && userData[0]) {
                        localStorage.setItem('currentUser', JSON.stringify(userData[0]));
                        localStorage.setItem('authToken', session.access_token);
                        updateUserInfo();
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
            }
        });
    }
}

// Initialize when DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize auth listener
    initAuthListener();
    
    // Update user info if logged in
    const user = localStorage.getItem('currentUser');
    if (user) {
        updateUserInfo();
    }
});

// Load Supabase JS if not already loaded
if (typeof window !== 'undefined' && !window.supabase) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        initAuthListener();
    };
    document.head.appendChild(script);
}