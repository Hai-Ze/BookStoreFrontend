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

// Cart functions
async function quickAddToCart(bookId) {
    try {
        const result = await apiCall('/cart/add', {
            method: 'POST',
            body: JSON.stringify({ BookId: bookId, Quantity: 1 })
        });
        
        if (result.Success) {
            showAlert('Đã thêm vào giỏ hàng!', 'success');
            updateCartCount();
        }
    } catch (error) {
        showAlert('Lỗi thêm vào giỏ', 'danger');
    }
}

async function updateCartCount() {
    try {
        const result = await apiCall('/cart/count');
        document.getElementById('cartCount').textContent = result.Count || 0;
    } catch (error) {
        console.error('Error updating cart count');
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

// Add to cart from modal
document.getElementById('addToCartBtn')?.addEventListener('click', () => {
    if (currentBookId) {
        quickAddToCart(currentBookId);
        bootstrap.Modal.getInstance(document.getElementById('bookModal')).hide();
    }
});