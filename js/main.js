// Configuration
const API_BASE_URL = 'https://localhost:7288/api/BookApi';
let currentBooks = [];
let currentBookId = null;
let isSearchMode = false;
let currentSearchQuery = '';

// Pagination variables
let currentPage = 1;
let pageSize = 15; 
let totalBooks = 0;
let totalPages = 0; 

// Current section
let currentSection = 'all-books';

// SMART CACHE SYSTEM
const smartCache = {
    data: new Map(),
    maxAge: 60000, // 1 phút
    maxSize: 50,   // Tối đa 50 entries
    
    set(key, value) {
        if (this.data.size >= this.maxSize) {
            const firstKey = this.data.keys().next().value;
            this.data.delete(firstKey);
        }
        this.data.set(key, {
            value,
            timestamp: Date.now()
        });
    },
    
    get(key) {
        const entry = this.data.get(key);
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > this.maxAge) {
            this.data.delete(key);
            return null;
        }
        
        return entry.value;
    }
};

// PRELOAD NEXT PAGE
let preloadedPages = new Set();

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const loadingSpinner = document.getElementById('loadingSpinner');
const booksSection = document.getElementById('booksSection');
const addBookSection = document.getElementById('addBookSection');
const statsSection = document.getElementById('statsSection');
const booksContainer = document.getElementById('booksContainer');
const bookCount = document.getElementById('bookCount');
const addBookForm = document.getElementById('addBookForm');
const editBookForm = document.getElementById('editBookForm');
const searchInput = document.getElementById('searchInput');
const pageTitle = document.getElementById('pageTitle');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('pageSizeSelect').value = '20';
    setupEventListeners();
    showAllBooks();
});

// Setup event listeners
function setupEventListeners() {
    // Sidebar toggle
    sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Forms
    addBookForm.addEventListener('submit', handleAddBook);
    
    // Search
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Page size
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    pageSizeSelect.addEventListener('change', function() {
        pageSize = parseInt(this.value);
        currentPage = 1;
        
        if (isSearchMode) {
            performSearch();
        } else {
            loadCurrentSection();
        }
    });

    // Preview image in edit modal
    const editCoverInput = document.getElementById('editBookCoverImg');
    if (editCoverInput) {
        editCoverInput.addEventListener('input', function() {
            previewEditImage(this.value);
        });
    }

    // Close mobile sidebar when clicking outside
    document.addEventListener('click', function(e) {
        if (window.innerWidth < 768) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        }
    });
}

// Sidebar functions
function toggleSidebar() {
    if (window.innerWidth < 768) {
        sidebar.classList.toggle('show');
    }
}

function setActiveNavItem(itemId) {
    // Remove active class from all nav items
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class to selected item
    if (itemId) {
        const activeItem = document.getElementById(`nav-${itemId}`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
}

// Section management
function showAllBooks() {
    currentSection = 'all-books';
    setActiveNavItem('all-books');
    hideAllSections();
    booksSection.classList.remove('d-none');
    pageTitle.innerHTML = '<i class="bi bi-book-half"></i> Tất cả sách';
    
    // Reset search
    isSearchMode = false;
    currentSearchQuery = '';
    searchInput.value = '';
    
    loadAllBooks(1);
    closeMobileSidebar();
}

function showAddForm() {
    currentSection = 'add-book';
    setActiveNavItem('add-book');
    hideAllSections();
    addBookSection.classList.remove('d-none');
    pageTitle.innerHTML = '<i class="bi bi-plus-circle"></i> Thêm sách mới';
    addBookForm.reset();
    closeMobileSidebar();
}

function showTopRated() {
    currentSection = 'top-rated';
    setActiveNavItem('top-rated');
    hideAllSections();
    booksSection.classList.remove('d-none');
    pageTitle.innerHTML = '<i class="bi bi-star-fill"></i> Sách đánh giá cao';
    loadTopRatedBooks(1);
    closeMobileSidebar();
}

function showQuickStats() {
    currentSection = 'stats';
    setActiveNavItem('stats');
    hideAllSections();
    statsSection.classList.remove('d-none');
    pageTitle.innerHTML = '<i class="bi bi-graph-up"></i> Thống kê nhanh';
    loadQuickStats();
    closeMobileSidebar();
}

function hideAllSections() {
    booksSection.classList.add('d-none');
    addBookSection.classList.add('d-none');
    statsSection.classList.add('d-none');
}

function closeMobileSidebar() {
    if (window.innerWidth < 768) {
        sidebar.classList.remove('show');
    }
}

function loadCurrentSection() {
    switch(currentSection) {
        case 'all-books':
            loadAllBooks(currentPage);
            break;
        case 'top-rated':
            loadTopRatedBooks(currentPage);
            break;
        default:
            showAllBooks();
    }
}

// API calls
async function loadAllBooks(page = 1) {
    const cacheKey = `books_${page}_${pageSize}`;
    
    // 1. CHECK CACHE TRƯỚC
    const cachedData = smartCache.get(cacheKey);
    if (cachedData) {
        displayCachedData(cachedData);
        console.log(`⚡ Loaded from cache in ~5ms`);
        
        // Preload next page trong background
        preloadNextPage(page);
        return;
    }
    
    showLoading(true);
    const startTime = performance.now();
    
    try {
        const response = await fetch(`${API_BASE_URL}/paged?page=${page}&pageSize=${pageSize}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        const loadTime = performance.now() - startTime;
        
        // 2. LƯU VÀO CACHE
        smartCache.set(cacheKey, result);
        
        // 3. DISPLAY
        displayLoadedData(result, loadTime);
        
        // 4. PRELOAD NEXT PAGE
        preloadNextPage(page);
        
    } catch (error) {
        console.error('Error loading books:', error);
        showNotification('Lỗi khi tải sách', 'error');
        displayNoBooks();
    } finally {
        showLoading(false);
    }
}

function displayCachedData(result) {
    currentPage = result.Page;
    totalBooks = result.TotalBooks;
    totalPages = result.TotalPages;
    currentBooks = result.Data;
    
    displayBooks(result.Data);
    updateBookCount(totalBooks);
    updateSidebarStats(totalBooks);
    updatePagination();
    
    showNotification(`⚡ Instant load từ cache`, 'success');
}

function displayLoadedData(result, loadTime) {
    currentPage = result.Page;
    totalBooks = result.TotalBooks;
    totalPages = result.TotalPages;
    currentBooks = result.Data;
    
    displayBooks(result.Data);
    updateBookCount(totalBooks);
    updateSidebarStats(totalBooks);
    updatePagination();
    
    console.log(`📊 Loaded ${result.Data.length} books in ${loadTime.toFixed(0)}ms`);
    showNotification(`Tải ${result.Data.length} sách trong ${loadTime.toFixed(0)}ms`, 'success');
}

// PRELOAD NEXT PAGE
async function preloadNextPage(currentPage) {
    const nextPage = currentPage + 1;
    const cacheKey = `books_${nextPage}_${pageSize}`;
    
    if (nextPage <= totalPages && !preloadedPages.has(nextPage) && !smartCache.get(cacheKey)) {
        preloadedPages.add(nextPage);
        
        try {
            console.log(`🔄 Preloading page ${nextPage}...`);
            const response = await fetch(`${API_BASE_URL}/paged?page=${nextPage}&pageSize=${pageSize}`);
            const result = await response.json();
            smartCache.set(cacheKey, result);
            console.log(`✅ Preloaded page ${nextPage}`);
        } catch (error) {
            console.log(`❌ Failed to preload page ${nextPage}`);
            preloadedPages.delete(nextPage);
        }
    }
}

async function loadTopRatedBooks(page = 1) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/top-rated?page=${page}&pageSize=${pageSize}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        
        currentPage = result.Page;
        totalBooks = result.TotalBooks;
        totalPages = result.TotalPages;
        
        currentBooks = result.Data;
        displayBooks(result.Data);
        updateBookCount(totalBooks);
        updatePagination();
        
    } catch (error) {
        console.error('Error loading top rated books:', error);
        showNotification('Lỗi khi tải sách đánh giá cao', 'error');
        displayNoBooks();
    } finally {
        showLoading(false);
    }
}

async function loadQuickStats() {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/quick-stats`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        
        // Update stats cards
        document.getElementById('statsTotal').textContent = result.AvailableRecords;
        document.getElementById('statsRecent').textContent = result.RecentBooks.length;
        document.getElementById('statsTopRated').textContent = result.TopRatedBooks.length;
        
        // Display top rated books in stats section
        displayTopRatedInStats(result.TopRatedBooks);
        
    } catch (error) {
        console.error('Error loading quick stats:', error);
        showNotification('Lỗi khi tải thống kê', 'error');
    } finally {
        showLoading(false);
    }
}

function displayTopRatedInStats(books) {
    const container = document.getElementById('topRatedBooksContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (books.length === 0) {
        container.innerHTML = '<p class="text-muted">Không có dữ liệu</p>';
        return;
    }
    
    books.forEach(book => {
        const defaultImage = 'https://via.placeholder.com/150x200/6c757d/ffffff?text=No+Image';
        const coverImage = book.CoverImg || defaultImage;
        const rating = book.Rating ? parseFloat(book.Rating).toFixed(1) : 'N/A';
        const price = book.Price ? parseFloat(book.Price).toFixed(2) : '0.00';
        
        container.innerHTML += `
            <div class="col-md-6 col-lg-3 mb-3">
                <div class="card h-100" onclick="showBookDetails(${book.Id})" style="cursor: pointer;">
                    <img src="${coverImage}" class="card-img-top" style="height: 200px; object-fit: cover;" alt="${book.Title}">
                    <div class="card-body p-2">
                        <h6 class="card-title" style="font-size: 0.9rem;">${book.Title}</h6>
                        <p class="card-text text-muted" style="font-size: 0.8rem;">by ${book.Author}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-success fw-bold">$${price}</small>
                            <small class="text-warning">
                                <i class="bi bi-star-fill"></i> ${rating}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

// Search functions
async function performSearch() {
    const query = searchInput.value.trim();
    
    if (!query) {
        isSearchMode = false;
        currentSearchQuery = '';
        showAllBooks();
        return;
    }
    
    isSearchMode = true;
    currentSearchQuery = query;
    currentPage = 1;
    
    // Update page title and show books section
    hideAllSections();
    booksSection.classList.remove('d-none');
    pageTitle.innerHTML = `<i class="bi bi-search"></i> Kết quả tìm kiếm: "${query}"`;
    setActiveNavItem(''); // Remove active from all nav items
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${currentPage}&pageSize=${pageSize}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        
        currentPage = result.Page;
        totalBooks = result.TotalBooks;
        totalPages = result.TotalPages;
        
        currentBooks = result.Data;
        displayBooks(result.Data);
        updateBookCount(totalBooks);
        updatePagination();
        
        if (result.Data.length === 0) {
            showNotification(`Không tìm thấy sách nào cho "${query}"`, 'info');
        }
        
    } catch (error) {
        console.error('Error searching books:', error);
        showNotification('Lỗi khi tìm kiếm sách', 'error');
        displayNoBooks();
    } finally {
        showLoading(false);
    }
}

function handleSearch() {
    const query = searchInput.value.trim();
    if (query.length >= 2) {
        performSearch();
    } else if (query.length === 0 && isSearchMode) {
        showAllBooks();
    }
}

function searchBooks() {
    performSearch();
}

// Display functions
function displayBooks(books) {
    booksContainer.innerHTML = '';
    
    if (books.length === 0) {
        displayNoBooks();
        return;
    }
    
    const fragment = document.createDocumentFragment();
    
    books.forEach((book, index) => {
        const bookCard = createBookCard(book, index);
        fragment.appendChild(bookCard);
    });
    
    booksContainer.appendChild(fragment);
    setTimeout(initLazyLoading, 100);
}

function createBookCard(book, index) {
    const col = document.createElement('div');
    col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
    
    const defaultImage = 'https://via.placeholder.com/200x250/6c757d/ffffff?text=No+Image';
    const coverImage = book.CoverImg || defaultImage;
    const rating = book.Rating ? parseFloat(book.Rating).toFixed(1) : 'N/A';
    const price = book.Price ? parseFloat(book.Price).toFixed(2) : '0.00';
    
    col.innerHTML = `
        <div class="card book-card h-100" onclick="showBookDetails(${book.Id})">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='250' viewBox='0 0 200 250'%3E%3Crect width='200' height='250' fill='%23f8f9fa'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='0.3em' fill='%236c757d'%3EĐang tải...%3C/text%3E%3C/svg%3E" 
                data-src="${coverImage}" 
                class="card-img-top book-cover lazy-load" 
                alt="${book.Title}"
                loading="lazy">
            <div class="card-body d-flex flex-column">
                <h6 class="book-title">${book.Title}</h6>
                <p class="book-author">tác giả ${book.Author}</p>
                <div class="mt-auto">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="book-price">$${price}</span>
                        ${rating !== 'N/A' ? `
                            <span class="book-rating">
                                <i class="bi bi-star-fill"></i> ${rating}
                            </span>
                        ` : ''}
                    </div>
                    ${book.Genres ? `
                        <div class="mb-2">
                            <small class="text-muted">${book.Genres}</small>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-primary btn-sm w-100" onclick="event.stopPropagation(); showBookDetails(${book.Id})">
                    <i class="bi bi-eye"></i> Xem chi tiết
                </button>
            </div>
        </div>
    `;
    
    col.style.animationDelay = `${index * 0.05}s`;
    return col;
}

// Book detail and edit functions
async function showBookDetails(bookId) {
    // CHECK CACHE TRƯỚC
    let book = bookDetailsCache.get(bookId);
    
    if (!book) {
        try {
            const response = await fetch(`${API_BASE_URL}/${bookId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            book = await response.json();
            // LƯU VÀO CACHE
            bookDetailsCache.set(bookId, book);
        } catch (error) {
            console.error('Error loading book details:', error);
            showNotification('Lỗi khi tải thông tin sách', 'error');
            return;
        }
    }
    
    currentBookId = bookId;
    
    document.getElementById('modalBookTitle').textContent = book.Title;
    
    const modalContent = document.getElementById('modalBookContent');
    const defaultImage = 'https://via.placeholder.com/200x300/6c757d/ffffff?text=No+Image';
    const coverImage = book.CoverImg || defaultImage;
    
    modalContent.innerHTML = `
        <div class="row">
            <div class="col-md-4">
                <img src="${coverImage}" 
                     class="img-fluid rounded" 
                     alt="${book.Title}"
                     onerror="this.src='${defaultImage}'">
            </div>
            <div class="col-md-8">
                <h5>${book.Title}</h5>
                <p class="text-muted">tác giả ${book.Author}</p>
                
                <div class="row mb-2">
                    <div class="col-sm-6">
                        <strong>Giá:</strong> $${parseFloat(book.Price || 0).toFixed(2)}
                    </div>
                    <div class="col-sm-6">
                        ${book.Rating ? `<strong>Đánh giá:</strong> <span class="text-warning"><i class="bi bi-star-fill"></i> ${parseFloat(book.Rating).toFixed(1)}</span>` : ''}
                    </div>
                </div>
                
                <div class="row mb-2">
                    <div class="col-sm-6">
                        ${book.Pages ? `<strong>Số trang:</strong> ${book.Pages}` : ''}
                    </div>
                    <div class="col-sm-6">
                        ${book.Language ? `<strong>Ngôn ngữ:</strong> ${book.Language}` : ''}
                    </div>
                </div>
                
                ${book.Series ? `<p><strong>Series:</strong> ${book.Series}</p>` : ''}
                ${book.Genres ? `<p><strong>Thể loại:</strong> ${book.Genres}</p>` : ''}
                ${book.Description ? `<p><strong>Mô tả:</strong> ${book.Description}</p>` : ''}
                ${book.NumRatings ? `<p><strong>Tổng số đánh giá:</strong> ${book.NumRatings}</p>` : ''}
            </div>
        </div>
    `;
    
    document.getElementById('editBookBtn').onclick = () => editBook(bookId);
    document.getElementById('deleteBookBtn').onclick = () => deleteBook(bookId);
    
    const modal = new bootstrap.Modal(document.getElementById('bookModal'));
    modal.show();
}

async function editBook(bookId) {
    try {
        // Close detail modal
        const detailModal = bootstrap.Modal.getInstance(document.getElementById('bookModal'));
        if (detailModal) detailModal.hide();
        
        // SỬ DỤNG CACHE THAY VÌ FETCH MỚI
        let book = bookDetailsCache.get(bookId);
        
        if (!book) {
            // Nếu không có trong cache, fetch một lần
            const response = await fetch(`${API_BASE_URL}/${bookId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            book = await response.json();
            bookDetailsCache.set(bookId, book);
        }
        
        // Fill edit form NGAY LẬP TỨC
        document.getElementById('editBookId').value = book.Id;
        document.getElementById('editBookTitle').value = book.Title || '';
        document.getElementById('editBookAuthor').value = book.Author || '';
        document.getElementById('editBookPrice').value = book.Price || '';
        document.getElementById('editBookPages').value = book.Pages || '';
        document.getElementById('editBookLanguage').value = book.Language || '';
        document.getElementById('editBookDescription').value = book.Description || '';
        document.getElementById('editBookGenres').value = book.Genres || '';
        document.getElementById('editBookCoverImg').value = book.CoverImg || '';
        
        if (book.CoverImg) {
            previewEditImage(book.CoverImg);
        }
        
        // Show edit modal
        const editModal = new bootstrap.Modal(document.getElementById('editBookModal'));
        editModal.show();
        
        console.log(`⚡ Edit form loaded instantly from cache`);
        
    } catch (error) {
        console.error('Error loading book for edit:', error);
        showNotification('Lỗi khi tải thông tin sách để chỉnh sửa', 'error');
    }
}

function previewEditImage(imageUrl) {
    const previewDiv = document.getElementById('editImagePreview');
    const previewImg = document.getElementById('editPreviewImg');
    
    if (previewDiv && previewImg && imageUrl && imageUrl.trim() !== '') {
        previewImg.src = imageUrl;
        previewImg.onerror = () => previewDiv.style.display = 'none';
        previewImg.onload = () => previewDiv.style.display = 'block';
    } else if (previewDiv) {
        previewDiv.style.display = 'none';
    }
}

// Form handlers
async function handleAddBook(e) {
    e.preventDefault();
    
    // Kiểm tra validation
    const title = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const price = document.getElementById('bookPrice').value;
    
    if (!title || !author || !price) {
        showNotification('Vui lòng điền đầy đủ thông tin bắt buộc (Tiêu đề, Tác giả, Giá)', 'error');
        return;
    }
    
    if (parseFloat(price) < 0) {
        showNotification('Giá sách phải là số dương', 'error');
        return;
    }
    
    const formData = {
        Title: title,
        Author: author,
        Price: Math.round(parseFloat(price) * 100) / 100, // ĐẢM BẢO 2 CHỮ SỐ THẬP PHÂN
        Pages: parseInt(document.getElementById('bookPages').value) || null,
        Language: document.getElementById('bookLanguage').value?.trim() || null,
        Description: document.getElementById('bookDescription').value?.trim() || null,
        Genres: document.getElementById('bookGenres').value?.trim() || null,
        CoverImg: document.getElementById('bookCoverImg').value?.trim() || null
    };
    
    // Disable form để tránh double submit
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-spinner-border"></i> Đang thêm...';
    
    try {
        console.log('📤 Sending book data:', formData);
        
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Server error:', errorText);
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('✅ Book added successfully:', result);
        
        showNotification('Thêm sách thành công!', 'success');
        
        // XÓA CACHE ĐỂ RELOAD FRESH DATA
        smartCache.data.clear();
        bookDetailsCache.clear();
        preloadedPages.clear();
        
        // Reset form
        addBookForm.reset();
        
        // Về trang 1 để thấy sách mới
        showAllBooks();
        
    } catch (error) {
        console.error('❌ Error adding book:', error);
        showNotification(`Lỗi khi thêm sách: ${error.message}`, 'error');
    } finally {
        // Re-enable form
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Handle edit book - sử dụng onclick thay vì form submit
async function handleEditBook(e) {
    e.preventDefault();
    
    const bookId = parseInt(document.getElementById('editBookId').value);
    const formData = {
        Id: bookId,
        Title: document.getElementById('editBookTitle').value,
        Author: document.getElementById('editBookAuthor').value,
        Price: parseFloat(document.getElementById('editBookPrice').value),
        Pages: parseInt(document.getElementById('editBookPages').value) || null,
        Language: document.getElementById('editBookLanguage').value || null,
        Description: document.getElementById('editBookDescription').value || null,
        Genres: document.getElementById('editBookGenres').value || null,
        CoverImg: document.getElementById('editBookCoverImg').value || null
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/${bookId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        showNotification('Cập nhật sách thành công!', 'success');
        
        // Close edit modal
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editBookModal'));
        if (editModal) editModal.hide();
        
        // Reload current view
        loadCurrentSection();
        
    } catch (error) {
        console.error('Error updating book:', error);
        showNotification('Lỗi khi cập nhật sách', 'error');
    }
}

async function deleteBook(bookId) {
    if (!confirm('Bạn có chắc chắn muốn xóa cuốn sách này?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/${bookId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        showNotification('Xóa sách thành công!', 'success');
        
        // Close detail modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('bookModal'));
        if (modal) modal.hide();
        
        // Reload current view
        loadCurrentSection();
        
    } catch (error) {
        console.error('Error deleting book:', error);
        showNotification('Lỗi khi xóa sách', 'error');
    }
}

// Pagination functions
function updatePagination() {
    const paginationNav = document.getElementById('paginationNav');
    const paginationList = document.getElementById('paginationList');
    const paginationInfo = document.getElementById('paginationInfo');
    
    if (totalPages > 1) {
        paginationNav.classList.remove('d-none');
        
        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(currentPage * pageSize, totalBooks);
        
        let infoText = `Hiển thị ${startItem}-${endItem} trong ${totalBooks} cuốn sách`;
        if (isSearchMode) {
            infoText += ` (tìm kiếm: "${currentSearchQuery}")`;
        }
        paginationInfo.textContent = infoText;
        
        paginationList.innerHTML = '';
        
        // Previous button
        const prevDisabled = currentPage === 1 ? 'disabled' : '';
        paginationList.innerHTML += `
            <li class="page-item ${prevDisabled}">
                <a class="page-link" href="#" onclick="goToPage(${currentPage - 1})" ${prevDisabled ? 'tabindex="-1"' : ''}>
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;
        
        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            paginationList.innerHTML += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="goToPage(1)">1</a>
                </li>
            `;
            if (startPage > 2) {
                paginationList.innerHTML += `
                    <li class="page-item disabled">
                        <span class="page-link">...</span>
                    </li>
                `;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const active = i === currentPage ? 'active' : '';
            paginationList.innerHTML += `
                <li class="page-item ${active}">
                    <a class="page-link" href="#" onclick="goToPage(${i})">${i}</a>
                </li>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationList.innerHTML += `
                    <li class="page-item disabled">
                        <span class="page-link">...</span>
                    </li>
                `;
            }
            paginationList.innerHTML += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="goToPage(${totalPages})">${totalPages}</a>
                </li>
            `;
        }
        
        // Next button
        const nextDisabled = currentPage === totalPages ? 'disabled' : '';
        paginationList.innerHTML += `
            <li class="page-item ${nextDisabled}">
                <a class="page-link" href="#" onclick="goToPage(${currentPage + 1})" ${nextDisabled ? 'tabindex="-1"' : ''}>
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        `;
    } else {
        paginationNav.classList.add('d-none');
    }
}

function goToPage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    currentPage = page;
    
    if (isSearchMode) {
        performSearchForPage(page);
    } else {
        loadCurrentSection();
    }
}

async function performSearch() {
    const query = searchInput.value.trim();
    
    if (!query) {
        isSearchMode = false;
        currentSearchQuery = '';
        showAllBooks();
        return;
    }
    
    const cacheKey = `search_${query}_${currentPage}_${pageSize}`;
    
    // CHECK CACHE
    const cachedData = smartCache.get(cacheKey);
    if (cachedData) {
        displaySearchResults(cachedData, query);
        console.log(`⚡ Search results from cache`);
        return;
    }
    
    isSearchMode = true;
    currentSearchQuery = query;
    currentPage = 1;
    
    hideAllSections();
    booksSection.classList.remove('d-none');
    pageTitle.innerHTML = `<i class="bi bi-search"></i> Tìm kiếm: "${query}"`;
    setActiveNavItem('');
    
    showLoading(true);
    const startTime = performance.now();
    
    try {
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${currentPage}&pageSize=${pageSize}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        const loadTime = performance.now() - startTime;
        
        // CACHE RESULTS
        smartCache.set(cacheKey, result);
        
        displaySearchResults(result, query);
        console.log(`🔍 Search completed in ${loadTime.toFixed(0)}ms`);
        
    } catch (error) {
        console.error('Error searching books:', error);
        showNotification('Lỗi khi tìm kiếm sách', 'error');
        displayNoBooks();
    } finally {
        showLoading(false);
    }
}

function displaySearchResults(result, query) {
    currentPage = result.Page;
    totalBooks = result.TotalBooks;
    totalPages = result.TotalPages;
    
    currentBooks = result.Data;
    displayBooks(result.Data);
    updateBookCount(totalBooks);
    updatePagination();
    
    if (result.Data.length === 0) {
        showNotification(`Không tìm thấy sách nào cho "${query}"`, 'info');
    }
}

// Utility functions
function showLoading(show) {
    if (show) {
        loadingSpinner.classList.remove('d-none');
        booksContainer.innerHTML = '';
        
        // Show skeleton cards
        for (let i = 0; i < Math.min(pageSize, 12); i++) {
            booksContainer.innerHTML += `
                <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
                    <div class="card book-card loading skeleton h-100">
                        <div class="card-img-top" style="height: 250px;"></div>
                        <div class="card-body">
                            <div class="book-title skeleton" style="height: 20px; margin-bottom: 10px;"></div>
                            <div class="book-author skeleton" style="height: 16px; width: 70%;"></div>
                            <div class="book-price skeleton" style="height: 18px; width: 50%; margin-top: 10px;"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    } else {
        loadingSpinner.classList.add('d-none');
    }
}

function displayNoBooks() {
    booksContainer.innerHTML = `
        <div class="col-12 text-center py-5">
            <i class="bi bi-book display-1 text-muted"></i>
            <h3 class="text-muted mt-3">Không tìm thấy sách nào</h3>
            <p class="text-muted">Thử điều chỉnh từ khóa tìm kiếm hoặc thêm sách mới.</p>
        </div>
    `;
}

function updateBookCount(count) {
    bookCount.textContent = `${count} cuốn sách`;
}

function updateSidebarStats(count) {
    const totalBooksElement = document.getElementById('totalBooksCount');
    const sidebarBookElement = document.getElementById('sidebarBookCount');
    
    if (totalBooksElement) totalBooksElement.textContent = count;
    if (sidebarBookElement) sidebarBookElement.textContent = count;
}

function initLazyLoading() {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const defaultImage = 'https://via.placeholder.com/200x250/6c757d/ffffff?text=No+Image';
                img.src = img.dataset.src || defaultImage;
                img.onerror = () => { img.src = defaultImage; };
                img.classList.remove('lazy-load');
                imageObserver.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px'
    });

    document.querySelectorAll('.lazy-load').forEach(img => {
        imageObserver.observe(img);
    });
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    
    notificationMessage.textContent = message;
    
    notification.className = `toast`;
    if (type === 'success') {
        notification.classList.add('text-bg-success');
    } else if (type === 'error') {
        notification.classList.add('text-bg-danger');
    } else if (type === 'warning') {
        notification.classList.add('text-bg-warning');
    } else {
        notification.classList.add('text-bg-info');
    }
    
    const toast = new bootstrap.Toast(notification);
    toast.show();
}

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

// Handle window resize for sidebar
window.addEventListener('resize', function() {
    if (window.innerWidth >= 768) {
        sidebar.classList.add('show');
    } else {
        sidebar.classList.remove('show');
    }
});

// Initialize sidebar state based on screen size
if (window.innerWidth >= 768) {
    sidebar.classList.add('show');
} else {
    sidebar.classList.remove('show');
}
// DEBUG HELPER
function debugAddBook() {
    console.log('🔍 Debug Add Book Form:');
    console.log('Title:', document.getElementById('bookTitle').value);
    console.log('Author:', document.getElementById('bookAuthor').value);
    console.log('Price:', document.getElementById('bookPrice').value);
    console.log('Pages:', document.getElementById('bookPages').value);
    console.log('Language:', document.getElementById('bookLanguage').value);
    console.log('Description:', document.getElementById('bookDescription').value);
    console.log('Genres:', document.getElementById('bookGenres').value);
    console.log('Cover:', document.getElementById('bookCoverImg').value);
    
    // Test API connection
    fetch(`${API_BASE_URL}/quick-stats`)
        .then(r => r.json())
        .then(data => console.log('✅ API Connection OK:', data))
        .catch(err => console.error('❌ API Connection Failed:', err));
}

// Gọi debugAddBook() trong Console để kiểm tra