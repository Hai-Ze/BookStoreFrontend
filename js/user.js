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
                <img src="${book.CoverImg || 'https://via.placeholder.com/200x300'}" 
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
                    <img src="${book.CoverImg || 'https://via.placeholder.com/300x400'}" 
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

// Cart functions - FIXED VERSION với absolute URLs
async function quickAddToCart(bookId) {
    try {
        console.log('Adding to cart, BookId:', bookId);
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            showAlert('Vui lòng đăng nhập để thêm vào giỏ hàng', 'warning');
            return;
        }

        // Sử dụng absolute URL từ API_BASE
        const API_BASE = 'https://localhost:7288/api';
        
        // Debug: Test token first
        try {
            const debugResult = await fetch(`${API_BASE}/cart/debug-user`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (debugResult.ok) {
                const debugData = await debugResult.json();
                console.log('Debug user info:', debugData);
            } else {
                console.warn('Debug endpoint failed:', debugResult.status);
            }
        } catch (debugError) {
            console.warn('Debug request failed:', debugError);
        }

        // Make the actual add to cart request
        console.log(`Making request to: ${API_BASE}/cart/add`);
        
        const response = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                BookId: bookId, 
                Quantity: 1 
            })
        });

        console.log('Add to cart response status:', response.status);
        console.log('Response headers:', [...response.headers.entries()]);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Add to cart error response:', errorText);
            
            if (response.status === 405) {
                throw new Error(`Method Not Allowed (405): POST method not supported on ${API_BASE}/cart/add`);
            } else {
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
        }

        const result = await response.json();
        console.log('Add to cart result:', result);

        if (result.Success || result.success) {
            showAlert('Đã thêm vào giỏ hàng!', 'success');
            updateCartCount();
        } else {
            throw new Error(result.Message || result.message || 'Không thể thêm vào giỏ hàng');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        
        // Handle specific error cases
        if (error.message.includes('405')) {
            showAlert('Lỗi API: Method not allowed. Kiểm tra backend cart endpoint.', 'danger');
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            showAlert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'warning');
        } else if (error.message.includes('400')) {
            showAlert('Dữ liệu không hợp lệ. Vui lòng thử lại.', 'danger');
        } else if (error.message.includes('500')) {
            showAlert('Lỗi server. Vui lòng thử lại sau.', 'danger');
        } else {
            showAlert('Lỗi khi thêm vào giỏ hàng: ' + error.message, 'danger');
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

        const API_BASE = 'https://localhost:7288/api';
        
        const response = await fetch(`${API_BASE}/cart/count`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            const count = result.Count || result.count || 0;
            document.getElementById('cartCount').textContent = count;
            console.log('Updated cart count:', count);
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
    const API_BASE = 'https://localhost:7288/api';
    const token = localStorage.getItem('authToken');
    
    console.log('=== Testing Cart API Endpoints ===');
    
    if (!token) {
        console.error('❌ No auth token found');
        showAlert('No auth token found', 'danger');
        return;
    }
    
    // Test endpoints
    const endpoints = [
        { url: `${API_BASE}/cart/debug-user`, method: 'GET' },
        { url: `${API_BASE}/cart/count`, method: 'GET' },
        { url: `${API_BASE}/cart`, method: 'GET' }
    ];
    
    for (const endpoint of endpoints) {
        try {
            console.log(`Testing ${endpoint.method} ${endpoint.url}`);
            
            const response = await fetch(endpoint.url, {
                method: endpoint.method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`✅ ${endpoint.method} ${endpoint.url} - Status: ${response.status}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Response:', data);
            } else {
                const errorText = await response.text();
                console.log('Error:', errorText);
            }
        } catch (error) {
            console.error(`❌ ${endpoint.method} ${endpoint.url} - Error:`, error);
        }
        
        // Delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Test POST add to cart with a sample book ID
    try {
        console.log('Testing POST /cart/add');
        
        const response = await fetch(`${API_BASE}/cart/add`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ BookId: 1, Quantity: 1 })
        });
        
        console.log(`✅ POST /cart/add - Status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Add to cart response:', data);
            showAlert('Cart API test completed successfully!', 'success');
        } else {
            const errorText = await response.text();
            console.log('Add to cart error:', errorText);
            
            if (response.status === 405) {
                showAlert('❌ Method Not Allowed - Cart endpoint không hỗ trợ POST', 'danger');
            } else {
                showAlert(`❌ Cart API test failed: ${response.status}`, 'danger');
            }
        }
    } catch (error) {
        console.error('❌ POST /cart/add - Error:', error);
        showAlert('❌ Cart API connection failed', 'danger');
    }
}

// Test backend connection
async function testBackendConnection() {
    const API_BASE = 'https://localhost:7288/api';
    
    console.log('=== Testing Backend Connection ===');
    
    const testEndpoints = [
        `${API_BASE}/BookApi/quick-stats`,
        `${API_BASE}/auth/verify`,
        `https://localhost:7288/`, // Root endpoint
        `https://localhost:7288/swagger` // Swagger endpoint
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