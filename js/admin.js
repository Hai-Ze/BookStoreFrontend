// Admin specific functions

// Dashboard
async function loadDashboard() {
    try {
        const stats = await apiCall('/BookApi/quick-stats');
        
        document.getElementById('totalBooks').textContent = stats.TotalBooks || 0;
        document.getElementById('topRated').textContent = stats.TopRatedBooks?.length || 0;
        document.getElementById('newBooks').textContent = stats.RecentBooks?.length || 0;
        
        // Load recent books table
        displayRecentBooks(stats.RecentBooks || []);
        
    } catch (error) {
        showAlert('Lỗi tải dashboard: ' + error.message, 'danger');
    }
}

function displayRecentBooks(books) {
    const container = document.getElementById('recentBooks');
    
    if (books.length === 0) {
        container.innerHTML = '<p>Không có sách nào</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Tên sách</th>
                    <th>Tác giả</th>
                    <th>Giá</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${books.map(book => `
                    <tr>
                        <td>${book.Id}</td>
                        <td>${book.Title}</td>
                        <td>${book.Author}</td>
                        <td>${formatPrice(book.Price)}</td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="editBook(${book.Id})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteBook(${book.Id})">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Books Management
async function loadBooks(page = 1) {
    showLoading('booksContainer');
    
    try {
        const result = await apiCall(`/BookApi/paged?page=${page}&pageSize=20`);
        displayBooks(result);
    } catch (error) {
        showAlert('Lỗi tải sách: ' + error.message, 'danger');
    }
}

function displayBooks(result) {
    const container = document.getElementById('booksContainer');
    const books = result.Data || [];
    
    container.innerHTML = `
        <div class="row">
            ${books.map(book => `
                <div class="col-md-3 mb-3">
                    <div class="card">
                        <img src="${book.CoverImg || 'https://via.placeholder.com/200x300'}" 
                             class="card-img-top" style="height: 200px; object-fit: cover;">
                        <div class="card-body">
                            <h6>${book.Title}</h6>
                            <p class="text-muted">${book.Author}</p>
                            <p class="text-success">${formatPrice(book.Price)}</p>
                            <button class="btn btn-sm btn-warning" onclick="editBook(${book.Id})">Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteBook(${book.Id})">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Add pagination
    if (result.TotalPages > 1) {
        addPagination(result.Page, result.TotalPages);
    }
}

function addPagination(currentPage, totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    let html = '<ul class="pagination">';
    
    // Previous
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadBooks(${currentPage - 1})">Previous</a>
    </li>`;
    
    // Pages
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
            <a class="page-link" href="#" onclick="loadBooks(${i})">${i}</a>
        </li>`;
    }
    
    // Next
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="loadBooks(${currentPage + 1})">Next</a>
    </li>`;
    
    html += '</ul>';
    pagination.innerHTML = html;
}

// Book operations
async function addBook(bookData) {
    try {
        await apiCall('/BookApi', {
            method: 'POST',
            body: JSON.stringify(bookData)
        });
        showAlert('Thêm sách thành công!', 'success');
        loadBooks();
    } catch (error) {
        showAlert('Lỗi thêm sách: ' + error.message, 'danger');
    }
}

async function editBook(id) {
    window.location.href = `/admin/books.html?edit=${id}`;
}

async function deleteBook(id) {
    if (!confirm('Xác nhận xóa sách này?')) return;
    
    try {
        await apiCall(`/BookApi/${id}`, { method: 'DELETE' });
        showAlert('Xóa sách thành công!', 'success');
        loadBooks();
    } catch (error) {
        showAlert('Lỗi xóa sách: ' + error.message, 'danger');
    }
}