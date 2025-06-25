// User specific functions

let currentBookId = null;

// Load books for users
async function loadUserBooks(page = 1) {
    showLoading('booksContainer');
    
    try {
        const result = await apiCall(`/BookApi/paged?page=${page}&pageSize=12`);
        displayUserBooks(result);
    } catch (error) {
        showAlert('Lỗi tải sách: ' + error.message, 'danger');
    }
}

function displayUserBooks(result) {
    const container = document.getElementById('booksContainer');
    const books = result.Data || [];
    
    container.innerHTML = books.map(book => `
        <div class="col-md-3 mb-4">
            <div class="card h-100 book-card" onclick="showBookDetail(${book.Id})">
                <img src="${book.CoverImg || 'http://via.placeholder.com/200x300'}" 
                     class="card-img-top" style="height: 250px; object-fit: cover;">
                <div class="card-body">
                    <h6 class="card-title">${book.Title}</h6>
                    <p class="card-text text-muted">${book.Author}</p>
                    <div class="d-flex justify-content-between">
                        <span class="text-success fw-bold">${formatPrice(book.Price)}</span>
                        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); quickAddToCart(${book.Id})">
                            <i class="bi bi-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add pagination
    if (result.TotalPages > 1) {
        addUserPagination(result.Page, result.TotalPages);
    }
}

function addUserPagination(currentPage, totalPages) {
    const pagination = document.getElementById('pagination');
    let html = '<ul class="pagination justify-content-center">';
    
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
            <a class="page-link" href="#" onclick="loadUserBooks(${i})">${i}</a>
        </li>`;
    }
    
    html += '</ul>';
    pagination.innerHTML = html;
}

// Book detail
async function showBookDetail(bookId) {
    currentBookId = bookId;
    const modal = new bootstrap.Modal(document.getElementById('bookModal'));
    
    try {
        const book = await apiCall(`/BookApi/${bookId}/details`);
        
        document.getElementById('modalTitle').textContent = book.Title;
        document.getElementById('modalBody').innerHTML = `
            <div class="row">
                <div class="col-md-4">
                    <img src="${book.CoverImg || 'http://via.placeholder.com/300x400'}" 
                         class="img-fluid rounded">
                </div>
                <div class="col-md-8">
                    <h4>${book.Title}</h4>
                    <p class="text-muted">Tác giả: ${book.Author}</p>
                    <h5 class="text-success">${formatPrice(book.Price)}</h5>
                    <p>${book.Description || 'Không có mô tả'}</p>
                    ${book.Pages ? `<p>Số trang: ${book.Pages}</p>` : ''}
                    ${book.Language ? `<p>Ngôn ngữ: ${book.Language}</p>` : ''}
                </div>
            </div>
        `;
        
        modal.show();
    } catch (error) {
        showAlert('Lỗi tải chi tiết sách', 'danger');
    }
}

function animateAddToCart(bookId) {
    // Tìm element của sách
    const bookElement = document.querySelector(`[onclick*="quickAddToCart(${bookId})"]`);
    if (bookElement) {
        bookElement.classList.add('pulse-animation');
        setTimeout(() => {
            bookElement.classList.remove('pulse-animation');
        }, 600);
    }
}

// Cart functions - FIXED VERSION với absolute URLs
async function quickAddToCart(bookId) {
    try {
        console.log('=== Starting Add to Cart ===');
        console.log('BookId:', bookId);
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            showAlert('Vui lòng đăng nhập để thêm vào giỏ hàng', 'warning');
            setTimeout(() => {
                window.location.href = '/auth/login.html';
            }, 2000);
            return;
        }

        // API Configuration
        const API_BASE = 'http://localhost:5209/api';
        
        // Validate bookId
        if (!bookId || isNaN(bookId)) {
            showAlert('ID sách không hợp lệ', 'danger');
            return;
        }

        // Prepare request body
        const requestBody = {
            BookId: parseInt(bookId),
            Quantity: 1
        };

        console.log('Request URL:', `${API_BASE}/cart/add`);
        console.log('Request Body:', JSON.stringify(requestBody));
        console.log('Authorization:', `Bearer ${token.substring(0, 20)}...`);

        // Make the request
        const response = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody),
            credentials: 'include' // Include cookies if any
        });

        console.log('Response Status:', response.status);
        console.log('Response Headers:', [...response.headers.entries()]);

        // Handle response based on status
        if (response.status === 401) {
            // Unauthorized - token expired or invalid
            showAlert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'warning');
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            setTimeout(() => {
                window.location.href = '/auth/login.html';
            }, 2000);
            return;
        }

        if (response.status === 404) {
            showAlert('Không tìm thấy API endpoint. Kiểm tra backend.', 'danger');
            return;
        }

        if (response.status === 405) {
            showAlert('Method not allowed. Backend không hỗ trợ POST cho endpoint này.', 'danger');
            console.error('405 Error - Check if CartController is properly configured');
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Parse successful response
        const result = await response.json();
        console.log('Add to cart result:', result);

        if (result.Success || result.success) {
            showAlert(result.Message || 'Đã thêm vào giỏ hàng!', 'success');
            
            // Update cart count
            await updateCartCount();
            
            // Optional: Show cart preview or animation
            animateAddToCart(bookId);
        } else {
            showAlert(result.Message || result.message || 'Không thể thêm vào giỏ hàng', 'warning');
        }

    } catch (error) {
        console.error('=== Add to Cart Error ===');
        console.error('Error:', error);
        
        // Handle different error types
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            showAlert('Không thể kết nối đến server. Kiểm tra backend đang chạy ở http://localhost:5209', 'danger');
        } else if (error.message.includes('405')) {
            showAlert('Lỗi 405: API endpoint không hỗ trợ POST method', 'danger');
        } else if (error.message.includes('404')) {
            showAlert('Lỗi 404: Không tìm thấy API endpoint', 'danger');
        } else {
            showAlert('Lỗi: ' + error.message, 'danger');
        }
    }
}

async function updateCartCount() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            document.getElementById('cartCount').textContent = '0';
            return;
        }

        const API_BASE = 'http://localhost:5209/api';
        
        const response = await fetch(`${API_BASE}/cart/count`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            credentials: 'include'
        });

        if (response.ok) {
            const result = await response.json();
            const count = result.Count || result.count || 0;
            document.getElementById('cartCount').textContent = count;
            console.log('Cart count updated:', count);
        } else if (response.status === 401) {
            // Silently set to 0 if unauthorized
            document.getElementById('cartCount').textContent = '0';
        } else {
            console.warn('Failed to update cart count:', response.status);
            document.getElementById('cartCount').textContent = '0';
        }
    } catch (error) {
        console.error('Error updating cart count:', error);
        document.getElementById('cartCount').textContent = '0';
    }
}

// Search
async function searchBooks() {
    const query = document.getElementById('searchInput').value;
    
    if (query.length < 2) {
        loadUserBooks();
        return;
    }
    
    try {
        const result = await apiCall(`/BookApi/search?q=${query}&page=1&pageSize=12`);
        displayUserBooks(result);
    } catch (error) {
        showAlert('Lỗi tìm kiếm', 'danger');
    }
}

// Helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Test auth function
async function testAuth() {
    try {
        const token = localStorage.getItem('authToken');
        console.log('Token:', token ? 'Present' : 'Missing');
        
        if (!token) {
            console.log('No token found');
            return;
        }

        const response = await fetch('/api/auth/verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        console.log('Auth verify result:', result);

        if (response.ok && result.Success) {
            console.log('✅ Auth token is valid');
            console.log('User info:', result.User);
        } else {
            console.log('❌ Auth token is invalid');
        }
    } catch (error) {
        console.error('Auth test error:', error);
    }
}

// Add to cart from modal
document.getElementById('addToCartBtn')?.addEventListener('click', () => {
    if (currentBookId) {
        quickAddToCart(currentBookId);
        bootstrap.Modal.getInstance(document.getElementById('bookModal')).hide();
    }
});

// Test cart API endpoints
async function testCartAPI() {
    const API_BASE = 'http://localhost:5209/api';
    const token = localStorage.getItem('authToken');
    
    console.log('=== Testing Cart API Endpoints ===');
    console.log('Token exists:', !!token);
    
    if (!token) {
        showAlert('Không có token. Vui lòng đăng nhập trước.', 'warning');
        return;
    }
    
    // Test 1: Test basic endpoint
    try {
        console.log('\n1. Testing GET /api/cart/test');
        const testResponse = await fetch(`${API_BASE}/cart/test`, {
            method: 'GET'
        });
        console.log('Test endpoint status:', testResponse.status);
        if (testResponse.ok) {
            const testData = await testResponse.json();
            console.log('Test endpoint response:', testData);
        }
    } catch (error) {
        console.error('Test endpoint error:', error);
    }
    
    // Test 2: Debug user info
    try {
        console.log('\n2. Testing GET /api/cart/debug-user');
        const debugResponse = await fetch(`${API_BASE}/cart/debug-user`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        console.log('Debug user status:', debugResponse.status);
        if (debugResponse.ok) {
            const debugData = await debugResponse.json();
            console.log('User debug info:', debugData);
            console.log('User ID:', debugData.UserId);
            console.log('Claims:', debugData.Claims);
        }
    } catch (error) {
        console.error('Debug user error:', error);
    }
    
    // Test 3: Get cart count
    try {
        console.log('\n3. Testing GET /api/cart/count');
        const countResponse = await fetch(`${API_BASE}/cart/count`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        console.log('Cart count status:', countResponse.status);
        if (countResponse.ok) {
            const countData = await countResponse.json();
            console.log('Cart count:', countData);
        }
    } catch (error) {
        console.error('Cart count error:', error);
    }
    
    // Test 4: Add to cart with test book
    try {
        console.log('\n4. Testing POST /api/cart/add');
        const addResponse = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                BookId: 1, 
                Quantity: 1 
            })
        });
        
        console.log('Add to cart status:', addResponse.status);
        console.log('Response headers:', [...addResponse.headers.entries()]);
        
        if (addResponse.ok) {
            const addData = await addResponse.json();
            console.log('Add to cart success:', addData);
            showAlert('✅ Cart API test successful!', 'success');
        } else {
            const errorText = await addResponse.text();
            console.error('Add to cart error:', errorText);
            showAlert(`❌ Cart API test failed: ${addResponse.status}`, 'danger');
        }
    } catch (error) {
        console.error('Add to cart exception:', error);
        showAlert('❌ Cart API connection failed', 'danger');
    }
    
    console.log('\n=== Cart API Test Complete ===');
}

// Test backend connection
async function testBackendConnection() {
    const API_BASE = 'http://localhost:5209/api';
    
    console.log('=== Testing Backend Connection ===');
    
    const testEndpoints = [
        `${API_BASE}/BookApi/quick-stats`,
        `${API_BASE}/auth/verify`,
        `http://localhost:5209/`, // Root endpoint
        `http://localhost:5209/swagger` // Swagger endpoint
    ];
    
    for (const url of testEndpoints) {
        try {
            console.log(`Testing: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            console.log(`✅ ${url} - Status: ${response.status}`);
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    console.log('Response:', data);
                } else {
                    console.log('Non-JSON response received');
                }
            }
        } catch (error) {
            console.error(`❌ ${url} - Error:`, error);
        }
    }
    
    showAlert('Backend connection test completed - check console', 'info');
}
const style = document.createElement('style');
style.textContent = `
    .pulse-animation {
        animation: pulse 0.6s ease-out;
    }
    
    @keyframes pulse {
        0% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.1);
            box-shadow: 0 0 20px rgba(0, 123, 255, 0.5);
        }
        100% {
            transform: scale(1);
        }
    }
`;
document.head.appendChild(style);