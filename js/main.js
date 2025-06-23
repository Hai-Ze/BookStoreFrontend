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
    },
    
    clear() {
        this.data.clear();
    }
};

// BOOK DETAILS CACHE
const bookDetailsCache = {
    data: new Map(),
    maxAge: 300000, // 5 phút
    maxSize: 100,
    
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
    },
    
    clear() {
        this.data.clear();
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
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    if (pageSizeSelect) pageSizeSelect.value = '20';
    setupEventListeners();
    showAllBooks();
    setTimeout(() => {
        const loginSection = document.getElementById('loginSection');
        const userSection = document.getElementById('userSection');
        
        if (loginSection && userSection) {
            if (!currentUser) {
                loginSection.classList.remove('d-none');
                userSection.classList.add('d-none');
                console.log('✅ Login button now visible');
            }
        }
    }, 1000);
});

// Setup event listeners
function setupEventListeners() {
    // Sidebar toggle
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Forms
    if (addBookForm) addBookForm.addEventListener('submit', handleAddBook);
    
    // Search
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // Page size
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', function() {
            pageSize = parseInt(this.value);
            currentPage = 1;
            
            if (isSearchMode) {
                performSearch();
            } else {
                loadCurrentSection();
            }
        });
    }

    // Preview image in edit modal
    const editCoverInput = document.getElementById('editBookCoverImg');
    if (editCoverInput) {
        editCoverInput.addEventListener('input', function() {
            previewEditImage(this.value);
        });
    }

    // Close mobile sidebar when clicking outside
    document.addEventListener('click', function(e) {
        if (window.innerWidth < 768 && sidebar && sidebarToggle) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        }
    });
}

// Sidebar functions
function toggleSidebar() {
    if (window.innerWidth < 768 && sidebar) {
        sidebar.classList.toggle('show');
    }
}

function setActiveNavItem(itemId) {
    document.querySelectorAll('.sidebar .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    if (itemId) {
        const activeItem = document.getElementById(`nav-${itemId}`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
}

// Section management
function showAllBooks() {
    if (!booksSection || !pageTitle) return;
    currentSection = 'all-books';
    setActiveNavItem('all-books');
    hideAllSections();
    booksSection.classList.remove('d-none');
    pageTitle.innerHTML = '<i class="bi bi-book-half"></i> Tất cả sách';
    
    isSearchMode = false;
    currentSearchQuery = '';
    if (searchInput) searchInput.value = '';
    
    loadAllBooks(1);
    closeMobileSidebar();
}

function showAddForm() {
    if (!currentUser || currentUser.role !== 'Admin') {
        showNotification('Chỉ Admin mới có quyền thêm sách', 'error');
        return;
    }
    if (!addBookSection || !pageTitle) return;
    currentSection = 'add-book';
    setActiveNavItem('add-book');
    hideAllSections();
    addBookSection.classList.remove('d-none');
    pageTitle.innerHTML = '<i class="bi bi-plus-circle"></i> Thêm sách mới';
    if (addBookForm) addBookForm.reset();
    closeMobileSidebar();
}

function showTopRated() {
    if (!booksSection || !pageTitle) return;
    currentSection = 'top-rated';
    setActiveNavItem('top-rated');
    hideAllSections();
    booksSection.classList.remove('d-none');
    pageTitle.innerHTML = '<i class="bi bi-star-fill"></i> Sách đánh giá cao';
    loadTopRatedBooks(1);
    closeMobileSidebar();
}

function showQuickStats() {
    if (!currentUser || currentUser.role !== 'Admin') {
        showNotification('Chỉ Admin mới có quyền xem thống kê', 'error');
        return;
    }
    if (!statsSection || !pageTitle) return;
    currentSection = 'stats';
    setActiveNavItem('stats');
    hideAllSections();
    statsSection.classList.remove('d-none');
    pageTitle.innerHTML = '<i class="bi bi-graph-up"></i> Thống kê nhanh';
    loadQuickStats();
    closeMobileSidebar();
}

function hideAllSections() {
    if (booksSection) booksSection.classList.add('d-none');
    if (addBookSection) addBookSection.classList.add('d-none');
    if (statsSection) statsSection.classList.add('d-none');
}

function closeMobileSidebar() {
    if (window.innerWidth < 768 && sidebar) {
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
    
    const cachedData = smartCache.get(cacheKey);
    if (cachedData) {
        displayCachedData(cachedData);
        console.log(`⚡ Loaded from cache in ~5ms`);
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
        
        smartCache.set(cacheKey, result);
        displayLoadedData(result, loadTime);
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
    if (!currentUser || currentUser.role !== 'Admin') {
        showNotification('Chỉ Admin mới có quyền xem thống kê', 'error');
        return;
    }
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/quick-stats`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        
        document.getElementById('statsTotal').textContent = result.TotalBooks;
        document.getElementById('statsRecent').textContent = result.RecentBooks.length;
        document.getElementById('statsTopRated').textContent = result.TopRatedBooks.length;
        
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
    const query = searchInput ? searchInput.value.trim() : '';
    
    if (!query) {
        isSearchMode = false;
        currentSearchQuery = '';
        showAllBooks();
        return;
    }
    
    const cacheKey = `search_${query}_${currentPage}_${pageSize}`;
    
    const cachedData = smartCache.get(cacheKey);
    if (cachedData) {
        displaySearchResults(cachedData, query);
        console.log(`⚡ Search results from cache`);
        return;
    }
    
    isSearchMode = true;
    currentSearchQuery = query;
    currentPage = 1;
    
    if (booksSection && pageTitle) {
        hideAllSections();
        booksSection.classList.remove('d-none');
        pageTitle.innerHTML = `<i class="bi bi-search"></i> Tìm kiếm: "${query}"`;
    }
    setActiveNavItem('');
    
    showLoading(true);
    const startTime = performance.now();
    
    try {
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${currentPage}&pageSize=${pageSize}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        const loadTime = performance.now() - startTime;
        
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

async function performSearchForPage(page) {
    const query = currentSearchQuery;
    const cacheKey = `search_${query}_${page}_${pageSize}`;
    
    const cachedData = smartCache.get(cacheKey);
    if (cachedData) {
        displaySearchResults(cachedData, query);
        return;
    }
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        smartCache.set(cacheKey, result);
        displaySearchResults(result, query);
        
    } catch (error) {
        console.error('Error searching books:', error);
        showNotification('Lỗi khi tìm kiếm sách', 'error');
        displayNoBooks();
    } finally {
        showLoading(false);
    }
}

function handleSearch() {
    const query = searchInput ? searchInput.value.trim() : '';
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
    if (!booksContainer) {
        console.error('booksContainer not found');
        return;
    }
    booksContainer.innerHTML = '';
    
    if (books.length === 0) {
        displayNoBooks();
        return;
    }
    
    console.log('Displaying books:', books); // Thêm log để kiểm tra
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
    const price = book.Price ? parseFloat(book.Price).toFixed(2) : '0.00';
    const genres = book.Genres ? book.Genres.replace(/[\[\]"]+/g, '').split(',').join(', ') : '';

    // Parse and convert ratingsByStars to integers
    let ratings = [0, 0, 0, 0, 0];
    if (book.RatingsByStars) {
        try {
            const cleanedRatings = book.RatingsByStars.replace(/'/g, '"');
            const parsedRatings = JSON.parse(cleanedRatings);
            if (Array.isArray(parsedRatings) && parsedRatings.length === 5) {
                ratings = parsedRatings.map(rating => parseInt(rating, 10));
            } else {
                console.warn('Invalid ratingsByStars format or length:', parsedRatings);
            }
        } catch (e) {
            console.error('Error parsing ratingsByStars:', e);
        }
    }
    const totalRatings = ratings.reduce((a, b) => a + b, 0);
    const averageRating = totalRatings > 0 ? (ratings[0] * 5 + ratings[1] * 4 + ratings[2] * 3 + ratings[3] * 2 + ratings[4] * 1) / totalRatings : 0;

    // Truncate genres if too long with tooltip
    const maxGenreLength = 30;
    const displayGenres = genres.length > maxGenreLength ? genres.substring(0, maxGenreLength) + '...' : genres;
    const genreTooltip = genres.length > maxGenreLength ? `title="${genres}"` : '';

    const isAdmin = currentUser && currentUser.role === 'Admin';
    
    col.innerHTML = `
        <div class="card book-card h-100" onclick="showBookDetails(${book.Id})">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='250' viewBox='0 0 200 250'%3E%3Crect width='200' height='250' fill='%23f8f9fa'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='0.3em' fill='%236c757d'%3ELoading...%3C/text%3E%3C/svg%3E" 
                data-src="${coverImage}" 
                class="card-img-top book-cover lazy-load" 
                alt="${book.Title}"
                loading="lazy">
            <div class="card-body d-flex flex-column">
                <h6 class="book-title">${book.Title}</h6>
                <p class="book-author">by ${book.Author}</p>
                <div class="mt-auto">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="book-price">$${price}</span>
                        ${totalRatings > 0 ? `
                            <span class="book-rating">
                                <i class="bi bi-star-fill"></i> ${averageRating.toFixed(1)} (${totalRatings.toLocaleString()} reviews)
                            </span>
                        ` : ''}
                    </div>
                    ${genres ? `
                        <div class="mb-2">
                            <small class="text-muted" ${genreTooltip}>Genres: ${displayGenres}</small>
                        </div>
                    ` : ''}
                    ${totalRatings > 0 ? `
                        <div class="mt-1 rating-breakdown" style="max-height: 3em; overflow: hidden; text-overflow: ellipsis;">
                            <small class="text-muted">Ratings: 5⭐ ${ratings[0].toLocaleString()}, 4⭐ ${ratings[1].toLocaleString()}, 3⭐ ${ratings[2].toLocaleString()}, 2⭐ ${ratings[3].toLocaleString()}, 1⭐ ${ratings[4].toLocaleString()}</small>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="card-actions">
                <div class="btn-group w-100" role="group">
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); showBookDetails(${book.Id})">
                        <i class="bi bi-eye"></i> View
                    </button>
                    ${isAdmin ? `
                        <button class="btn btn-warning btn-sm" onclick="event.stopPropagation(); editBook(${book.Id})">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteBook(${book.Id})">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    ` : `
                        <button class="btn btn-success btn-sm" 
                                onclick="event.stopPropagation(); addToCart(${book.Id})" 
                                ${!currentUser ? 'disabled title="Please log in"' : ''}>
                            <i class="bi bi-cart-plus"></i> Buy
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
    
    col.style.animationDelay = `${index * 0.05}s`;
    return col;
}

// Book detail and edit functions
async function showBookDetails(bookId) {
    let book = bookDetailsCache.get(bookId);
    
    if (!book) {
        try {
            const response = await fetch(`${API_BASE_URL}/${bookId}/details`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            book = await response.json();
            bookDetailsCache.set(bookId, book);
        } catch (error) {
            console.error('Error loading book details:', error);
            showNotification('Error loading book details', 'error');
            return;
        }
    }
    
    currentBookId = bookId;
    
    const modalBookTitle = document.getElementById('modalBookTitle');
    const modalBookContent = document.getElementById('modalBookContent');
    if (!modalBookTitle || !modalBookContent) return;
    
    modalBookTitle.textContent = book.Title || 'No Title';
    
    const defaultImage = 'https://via.placeholder.com/200x300/6c757d/ffffff?text=No+Image';
    const coverImage = book.CoverImg || defaultImage;
    const genres = book.Genres ? book.Genres.replace(/[\[\]"]+/g, '').split(',').join(', ') : '';

    let ratings = [0, 0, 0, 0, 0];
    if (book.RatingsByStars) {
        try {
            const cleanedRatings = book.RatingsByStars.replace(/'/g, '"');
            const parsedRatings = JSON.parse(cleanedRatings);
            if (Array.isArray(parsedRatings) && parsedRatings.length === 5) {
                ratings = parsedRatings.map(rating => parseInt(rating, 10));
            }
        } catch (e) {
            console.error('Error parsing ratingsByStars:', e);
        }
    }
    const totalRatings = ratings.reduce((a, b) => a + b, 0);
    const averageRating = totalRatings > 0 ? (ratings[0] * 5 + ratings[1] * 4 + ratings[2] * 3 + ratings[3] * 2 + ratings[4] * 1) / totalRatings : 0;

    // HTML for book details with Edit and Delete for Admin
    modalBookContent.innerHTML = `
        <div class="row">
            <!-- Book Cover Image -->
            <div class="col-md-4">
                <img src="${coverImage}" 
                     class="img-fluid rounded shadow-sm mb-3" 
                     alt="${book.Title || 'No Title'}"
                     onerror="this.src='${defaultImage}'"
                     style="max-width: 100%; height: auto; max-height: 250px;">
            </div>
            <!-- Book Details -->
            <div class="col-md-8">
                <h2 class="mb-2" style="font-size: 1.5rem;">${book.Title || 'No Title'}</h2>
                <p class="text-muted mb-3" style="font-size: 0.9rem;">by ${book.Author || 'Unknown Author'}</p>
                
                <!-- Basic Information -->
                <div class="row mb-3">
                    <div class="col-6">
                        <p><strong>Price:</strong> $${parseFloat(book.Price || 0).toFixed(2)}</p>
                    </div>
                    <div class="col-6">
                        ${totalRatings > 0 ? `
                            <p><strong>Average Rating:</strong> 
                                <span class="text-warning"><i class="bi bi-star-fill"></i> ${averageRating.toFixed(1)} 
                                (${totalRatings.toLocaleString()} reviews)</span>
                            </p>
                        ` : ''}
                    </div>
                </div>
                <div class="row mb-3">
                    <div class="col-6">
                        ${book.Pages ? `<p><strong>Pages:</strong> ${book.Pages}</p>` : ''}
                    </div>
                    <div class="col-6">
                        ${book.Language ? `<p><strong>Language:</strong> ${book.Language}</p>` : ''}
                    </div>
                </div>
                ${genres ? `<p><strong>Genres:</strong> ${genres}</p>` : ''}
                ${book.Description ? `
                    <p><strong>Description:</strong> 
                        <span class="description-text" style="max-height: 100px; overflow-y: auto; display: block; font-size: 0.9rem;">${book.Description}</span>
                    </p>
                ` : '<p><strong>Description:</strong> No description available</p>'}

                <!-- Rating Distribution with Legend -->
                ${totalRatings > 0 ? `
                    <div class="mt-3">
                        <h4 style="font-size: 1.1rem;">Rating Distribution</h4>
                        <div class="progress mb-1" style="height: 10px;">
                            <div class="progress-bar bg-warning" role="progressbar" 
                                 style="width: ${((ratings[0] / totalRatings) * 100).toFixed(1)}%"></div>
                        </div>
                        <div class="progress mb-1" style="height: 10px;">
                            <div class="progress-bar bg-info" role="progressbar" 
                                 style="width: ${((ratings[1] / totalRatings) * 100).toFixed(1)}%"></div>
                        </div>
                        <div class="progress mb-1" style="height: 10px;">
                            <div class="progress-bar bg-primary" role="progressbar" 
                                 style="width: ${((ratings[2] / totalRatings) * 100).toFixed(1)}%"></div>
                        </div>
                        <div class="progress mb-1" style="height: 10px;">
                            <div class="progress-bar bg-secondary" role="progressbar" 
                                 style="width: ${((ratings[3] / totalRatings) * 100).toFixed(1)}%"></div>
                        </div>
                        <div class="progress mb-1" style="height: 10px;">
                            <div class="progress-bar bg-danger" role="progressbar" 
                                 style="width: ${((ratings[4] / totalRatings) * 100).toFixed(1)}%"></div>
                        </div>
                        <!-- Legend -->
                        <div class="text-muted small mt-1">
                            <span class="me-2"><i class="bi bi-square-fill" style="color: #ffc107;"></i> 5 Stars</span>
                            <span class="me-2"><i class="bi bi-square-fill" style="color: #17a2b8;"></i> 4 Stars</span>
                            <span class="me-2"><i class="bi bi-square-fill" style="color: #007bff;"></i> 3 Stars</span>
                            <span class="me-2"><i class="bi bi-square-fill" style="color: #6c757d;"></i> 2 Stars</span>
                            <span><i class="bi bi-square-fill" style="color: #dc3545;"></i> 1 Star</span>
                        </div>
                    </div>
                ` : ''}

                <!-- Action Buttons for Admin -->
                <div class="mt-4">
                    ${currentUser && currentUser.role === 'Admin' ? `
                        <button type="button" class="btn btn-warning me-2" onclick="editBook(${bookId})">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button type="button" class="btn btn-danger" onclick="deleteBook(${bookId})">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    const modal = new bootstrap.Modal(document.getElementById('bookModal'));
    if (modal) modal.show();
}

async function editBook(bookId) {
    if (!currentUser || currentUser.role !== 'Admin') {
        showNotification('Chỉ Admin mới có quyền chỉnh sửa sách', 'error');
        return;
    }
    
    try {
        const detailModal = bootstrap.Modal.getInstance(document.getElementById('bookModal'));
        if (detailModal) detailModal.hide();
        
        let book = bookDetailsCache.get(bookId);
        
        if (!book) {
            const response = await fetch(`${API_BASE_URL}/${bookId}/details`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            book = await response.json();
            bookDetailsCache.set(bookId, book);
        }
        
        const editBookId = document.getElementById('editBookId');
        const editBookTitle = document.getElementById('editBookTitle');
        const editBookAuthor = document.getElementById('editBookAuthor');
        const editBookPrice = document.getElementById('editBookPrice');
        const editBookPages = document.getElementById('editBookPages');
        const editBookLanguage = document.getElementById('editBookLanguage');
        const editBookDescription = document.getElementById('editBookDescription');
        const editBookGenres = document.getElementById('editBookGenres');
        const editBookCoverImg = document.getElementById('editBookCoverImg');
        
        if (editBookId && editBookTitle && editBookAuthor && editBookPrice && editBookPages && 
            editBookLanguage && editBookDescription && editBookGenres && editBookCoverImg) {
            editBookId.value = book.Id || 0;
            editBookTitle.value = book.Title || '';
            editBookAuthor.value = book.Author || '';
            editBookPrice.value = book.Price || '';
            editBookPages.value = book.Pages || '';
            editBookLanguage.value = book.Language || '';
            editBookDescription.value = book.Description || '';
            editBookGenres.value = book.Genres || '';
            editBookCoverImg.value = book.CoverImg || '';
            
            if (book.CoverImg) {
                previewEditImage(book.CoverImg);
            }
        } else {
            console.error('One or more edit form elements not found');
        }
        
        const editModal = new bootstrap.Modal(document.getElementById('editBookModal'));
        if (editModal) editModal.show();
        
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

async function handleAddBook(e) {
    e.preventDefault();
    
    if (!currentUser || !authToken || currentUser.role !== 'Admin') {
        showNotification('Chỉ Admin mới có quyền thêm sách hoặc cần đăng nhập', 'error');
        return;
    }
    
    const title = document.getElementById('bookTitle')?.value.trim();
    const author = document.getElementById('bookAuthor')?.value.trim();
    const price = document.getElementById('bookPrice')?.value;
    
    if (!title || !author || !price) {
        showNotification('Vui lòng điền đầy đủ thông tin bắt buộc (Tiêu đề, Tác giả, Giá)', 'error');
        return;
    }
    
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
        showNotification('Giá sách phải là số dương', 'error');
        return;
    }
    
    const pagesInput = document.getElementById('bookPages')?.value?.trim();
    let pages = null;
    if (pagesInput && pagesInput !== '') {
        const pagesValue = parseInt(pagesInput);
        if (!isNaN(pagesValue) && pagesValue > 0) {
            pages = pagesValue;
        }
    }
    
    const formData = {
        Id: 0,
        Title: title,
        Author: author,
        Price: Math.round(priceValue * 100) / 100,
        Pages: pages,
        Language: document.getElementById('bookLanguage')?.value?.trim() || null,
        Description: document.getElementById('bookDescription')?.value?.trim() || null,
        Genres: document.getElementById('bookGenres')?.value?.trim() || null,
        CoverImg: document.getElementById('bookCoverImg')?.value?.trim() || null
    };
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-spinner-border spinner-border-sm"></i> Đang thêm...';
    
    try {
        console.log('📤 Sending book data:', formData);
        
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${authToken}`
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
        
        smartCache.clear();
        bookDetailsCache.clear();
        preloadedPages.clear();
        
        addBookForm.reset();
        showAllBooks();
        
    } catch (error) {
        console.error('❌ Error adding book:', error);
        showNotification(`Lỗi khi thêm sách: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function handleEditBook(e) {
    e.preventDefault();
    
    if (!currentUser || !authToken || currentUser.role !== 'Admin') {
        showNotification('Chỉ Admin mới có quyền chỉnh sửa sách hoặc cần đăng nhập', 'error');
        return;
    }
    
    const bookId = parseInt(document.getElementById('editBookId')?.value);
    
    const title = document.getElementById('editBookTitle')?.value.trim();
    const author = document.getElementById('editBookAuthor')?.value.trim();
    const price = document.getElementById('editBookPrice')?.value;
    
    if (!title || !author || !price) {
        showNotification('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
        return;
    }
    
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
        showNotification('Giá sách phải là số dương', 'error');
        return;
    }
    
    const pagesInput = document.getElementById('editBookPages')?.value?.trim();
    let pages = null;
    if (pagesInput && pagesInput !== '') {
        const pagesValue = parseInt(pagesInput);
        if (!isNaN(pagesValue) && pagesValue > 0) {
            pages = pagesValue;
        }
    }
    
    const formData = {
        Id: bookId,
        Title: title,
        Author: author,
        Price: Math.round(priceValue * 100) / 100,
        Pages: pages,
        Language: document.getElementById('editBookLanguage')?.value?.trim() || null,
        Description: document.getElementById('editBookDescription')?.value?.trim() || null,
        Genres: document.getElementById('editBookGenres')?.value?.trim() || null,
        CoverImg: document.getElementById('editBookCoverImg')?.value?.trim() || null
    };
    
    const submitBtn = document.querySelector('#editBookModal .btn-warning');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="bi bi-spinner-border spinner-border-sm"></i> Đang cập nhật...';
    
    try {
        console.log('📤 Updating book:', formData);
        
        const response = await fetch(`${API_BASE_URL}/${bookId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        console.log('✅ Book updated successfully');
        showNotification('Cập nhật sách thành công!', 'success');
        
        smartCache.clear();
        bookDetailsCache.clear();
        preloadedPages.clear();
        
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editBookModal'));
        if (editModal) editModal.hide();
        
        loadCurrentSection();
        
    } catch (error) {
        console.error('❌ Error updating book:', error);
        showNotification(`Lỗi khi cập nhật sách: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function deleteBook(bookId) {
    if (!currentUser || !authToken || currentUser.role !== 'Admin') {
        showNotification('Chỉ Admin mới có quyền xóa sách hoặc cần đăng nhập', 'error');
        return;
    }
    
    if (!confirm('Bạn có chắc chắn muốn xóa cuốn sách này?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/${bookId}`, { 
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        showNotification('Xóa sách thành công!', 'success');
        
        smartCache.clear();
        bookDetailsCache.clear();
        preloadedPages.clear();
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('bookModal'));
        if (modal) modal.hide();
        
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
    
    if (!paginationNav || !paginationList || !paginationInfo) return;
    
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
        
        const prevDisabled = currentPage === 1 ? 'disabled' : '';
        paginationList.innerHTML += `
            <li class="page-item ${prevDisabled}">
                <a class="page-link" href="#" onclick="goToPage(${currentPage - 1})" ${prevDisabled ? 'tabindex="-1"' : ''}>
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;
        
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

// Utility functions
function showLoading(show) {
    if (!loadingSpinner || !booksContainer) return;
    if (show) {
        loadingSpinner.classList.remove('d-none');
        booksContainer.innerHTML = '';
        
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
    if (!booksContainer) return;
    booksContainer.innerHTML = `
        <div class="col-12 text-center py-5">
            <i class="bi bi-book display-1 text-muted"></i>
            <h3 class="text-muted mt-3">Không tìm thấy sách nào</h3>
            <p class="text-muted">Thử điều chỉnh từ khóa tìm kiếm hoặc thêm sách mới.</p>
        </div>
    `;
}

function updateBookCount(count) {
    if (bookCount) bookCount.textContent = `${count} cuốn sách`;
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
    
    if (!notification || !notificationMessage) return;
    
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
    if (window.innerWidth >= 768 && sidebar) {
        sidebar.classList.add('show');
    } else if (sidebar) {
        sidebar.classList.remove('show');
    }
});

// Initialize sidebar state based on screen size
if (window.innerWidth >= 768 && sidebar) {
    sidebar.classList.add('show');
} else if (sidebar) {
    sidebar.classList.remove('show');
}

// GOOGLE AUTHENTICATION FUNCTIONS
const GOOGLE_CLIENT_ID = '198205931206-445vmgejdn1s12d5lr9kqc3jj8o1el3u.apps.googleusercontent.com';
let currentUser = null;
let authToken = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeGoogleAuth();
    checkAuthStatus();
});

function initializeGoogleAuth() {
    if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleLoginResponse,
            auto_select: false
        });

        const loginBtn = document.getElementById('googleLoginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', function() {
                google.accounts.id.prompt();
            });
        }
    } else {
        console.warn('Google Sign-In library not loaded');
        showLoginSection();
    }
}

async function handleGoogleLoginResponse(response) {
    try {
        showNotification('Đang đăng nhập...', 'info');
        
        const apiResponse = await fetch(`${API_BASE_URL.replace('/BookApi', '')}/auth/google-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                googleToken: response.credential
            })
        });

        const result = await apiResponse.json();

        if (result.success) {
            authToken = result.token;
            currentUser = result.user;
            
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            updateAuthUI();
            
            const welcomeMsg = result.isNewUser 
                ? `Chào mừng ${currentUser.fullName}! Tài khoản đã được tạo.`
                : `Chào mừng trở lại, ${currentUser.fullName}!`;
            
            showNotification(welcomeMsg, 'success');
            
            console.log('Login successful:', currentUser);
            
            // Redirect based on role
            if (currentUser.role === 'Admin') {
                window.location.href = 'index_admin.html';
            } else {
                window.location.href = 'index_user.html';
            }
            
        } else {
            throw new Error(result.message || 'Login failed');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showNotification(`Lỗi đăng nhập: ${error.message}`, 'error');
        showLoginSection();
    }
}

function checkAuthStatus() {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        
        verifyTokenWithServer();
    } else {
        showLoginSection();
    }
}

async function verifyTokenWithServer() {
    try {
        const response = await fetch(`${API_BASE_URL.replace('/BookApi', '')}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                updateAuthUI();
                console.log('Token verified, user logged in');
                
                // Redirect based on role if on wrong page
                const currentPath = window.location.pathname;
                if (currentUser.role === 'Admin' && !currentPath.includes('index_admin.html')) {
                    window.location.href = 'index_admin.html';
                } else if (currentUser.role === 'Customer' && !currentPath.includes('index_user.html')) {
                    window.location.href = 'index_user.html';
                }
                return;
            }
        }
        
        logout();
        
    } catch (error) {
        console.error('Token verification failed:', error);
        logout();
    }
}

function updateAuthUI() {
    const loginSection = document.getElementById('loginSection');
    const userSection = document.getElementById('userSection');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userRole = document.getElementById('userRole');
    const adminMenuLink = document.getElementById('adminMenuLink');
    const cartSection = document.getElementById('cartSection');

    if (currentUser && authToken) {
        if (loginSection) loginSection.classList.add('d-none');
        if (userSection) userSection.classList.remove('d-none');
        
        userAvatar.src = currentUser.avatarUrl || 'https://via.placeholder.com/32x32/6c757d/ffffff?text=U';
        userName.textContent = currentUser.fullName || 'User';
        userEmail.textContent = currentUser.email || '';
        
        userRole.textContent = currentUser.role || 'Customer';
        userRole.className = `badge ms-2 ${currentUser.role === 'Admin' ? 'bg-danger' : 'bg-primary'}`;
        
        if (adminMenuLink) {
            adminMenuLink.style.display = currentUser.role === 'Admin' ? 'block' : 'none';
        }
        
        if (cartSection) {
            cartSection.style.display = currentUser.role === 'Customer' ? 'block' : 'none';
        }
        if (currentUser.role === 'Customer') {
            loadCart();
        }
        
    } else {
        showLoginSection();
        if (cartSection) {
            cartSection.style.display = 'none';
        }
    }
}

function showLoginSection() {
    const loginSection = document.getElementById('loginSection');
    const userSection = document.getElementById('userSection');
    
    if (loginSection) loginSection.classList.remove('d-none');
    if (userSection) userSection.classList.add('d-none');
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    showLoginSection();
    
    if (typeof google !== 'undefined') {
        google.accounts.id.disableAutoSelect();
    }
    
    showNotification('Đăng xuất thành công', 'info');
    console.log('User logged out');
    
    window.location.href = 'index_user.html'; // Default to user page after logout
}

function showProfile() {
    if (!currentUser) {
        showNotification('Vui lòng đăng nhập', 'warning');
        return;
    }
    
    alert(`Profile:\nTên: ${currentUser.fullName}\nEmail: ${currentUser.email}\nRole: ${currentUser.role}`);
}

function showAdminPanel() {
    if (!currentUser || currentUser.role !== 'Admin') {
        showNotification('Chỉ Admin mới truy cập được', 'error');
        return;
    }
    
    alert('Admin Panel - Sẽ phát triển sau!');
}

async function makeAuthenticatedRequest(url, options = {}) {
    if (!authToken) {
        throw new Error('Not authenticated');
    }
    
    const headers = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    return fetch(url, {
        ...options,
        headers
    });
}

async function testAdminEndpoint() {
    if (!currentUser || currentUser.role !== 'Admin') {
        showNotification('Chỉ Admin mới truy cập được', 'error');
        return;
    }
    
    try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL.replace('/BookApi', '')}/auth/admin-test`);
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Admin test thành công: ${result.message}`, 'success');
        } else {
            showNotification('Không có quyền admin', 'error');
        }
    } catch (error) {
        showNotification('Lỗi test admin', 'error');
    }
}

function forceShowLoginButton() {
    const loginSection = document.getElementById('loginSection');
    const userSection = document.getElementById('userSection');
    
    if (loginSection) {
        loginSection.classList.remove('d-none');
        console.log('Login section visible');
    }
    if (userSection) {
        userSection.classList.add('d-none');
        console.log('User section hidden');
    }
}

async function addToCart(bookId, quantity = 1) {
    // Bỏ kiểm tra authToken và currentUser tạm thời
    try {
        const response = await fetch(`${API_BASE_URL.replace('/BookApi', '')}/api/cart/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ BookId: bookId, Quantity: quantity })
        });

        const result = await response.json();

        if (result.Success) {
            showNotification(result.Message, 'success');
            updateCartCount(result.TotalCartItems);
        } else {
            showNotification(result.Message, 'error');
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        showNotification('Lỗi khi thêm vào giỏ hàng', 'error');
    }
}

async function loadCart() {
    if (!currentUser || currentUser.role !== 'Customer') return;
    if (!authToken) return;

    try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL.replace('/BookApi', '')}/api/cart`);
        const result = await response.json();

        if (result.Success) {
            displayCart(result);
            updateCartCount(result.TotalItems);
        }
    } catch (error) {
        console.error('Error loading cart:', error);
    }
}

async function updateCartItemQuantity(cartItemId, quantity) {
    if (!currentUser || currentUser.role !== 'Customer') return;
    
    try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL.replace('/BookApi', '')}/api/cart/update`, {
            method: 'PUT',
            body: JSON.stringify({
                CartItemId: cartItemId,
                Quantity: quantity
            })
        });

        const result = await response.json();
        if (result.Success) {
            loadCart();
            showNotification(result.Message, 'success');
        } else {
            showNotification(result.Message, 'error');
        }
    } catch (error) {
        console.error('Error updating cart:', error);
        showNotification('Lỗi khi cập nhật giỏ hàng', 'error');
    }
}

async function removeFromCart(cartItemId) {
    if (!currentUser || currentUser.role !== 'Customer') return;
    
    try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL.replace('/BookApi', '')}/api/cart/remove/${cartItemId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.Success) {
            loadCart();
            showNotification(result.Message, 'success');
        } else {
            showNotification(result.Message, 'error');
        }
    } catch (error) {
        console.error('Error removing from cart:', error);
        showNotification('Lỗi khi xóa khỏi giỏ hàng', 'error');
    }
}

async function clearCart() {
    if (!currentUser || currentUser.role !== 'Customer') return;
    
    if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ giỏ hàng?')) return;
    
    try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL.replace('/BookApi', '')}/api/cart/clear`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.Success) {
            loadCart();
            showNotification(result.Message, 'success');
        } else {
            showNotification(result.Message, 'error');
        }
    } catch (error) {
        console.error('Error clearing cart:', error);
        showNotification('Lỗi khi xóa giỏ hàng', 'error');
    }
}

function updateCartCount(count) {
    const cartBadge = document.getElementById('cartCount');
    const cartSection = document.getElementById('cartSection');
    
    if (cartBadge) {
        cartBadge.textContent = count || 0;
        cartBadge.style.display = count > 0 ? 'inline' : 'none';
    }
    
    if (cartSection && currentUser) {
        cartSection.style.display = currentUser.role === 'Customer' ? 'block' : 'none';
    }
}

function displayCart(cartData) {
    if (!currentUser || currentUser.role !== 'Customer') return;
    
    const cartModal = document.getElementById('cartModal');
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const cartTotalAmount = document.getElementById('cartTotalAmount');
    const cartTotalItems = document.getElementById('cartTotalItems');
    
    if (!cartItemsContainer) return;
    
    cartItemsContainer.innerHTML = '';
    
    if (cartData.Items.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-cart-x display-1 text-muted"></i>
                <h5 class="mt-3">Giỏ hàng trống</h5>
                <p class="text-muted">Thêm sách vào giỏ hàng để bắt đầu mua sắm</p>
            </div>
        `;
    } else {
        cartData.Items.forEach(item => {
            cartItemsContainer.innerHTML += `
                <div class="row align-items-center border-bottom py-3" id="cart-item-${item.Id}">
                    <div class="col-md-2">
                        <img src="${item.BookCoverImg || 'https://via.placeholder.com/80x100'}" 
                             class="img-fluid rounded" 
                             alt="${item.BookTitle}"
                             style="max-height: 80px;">
                    </div>
                    <div class="col-md-5">
                        <h6 class="mb-1">${item.BookTitle}</h6>
                        <small class="text-muted">${item.BookAuthor}</small>
                    </div>
                    <div class="col-md-2">
                        <strong>$${item.BookPrice.toFixed(2)}</strong>
                    </div>
                    <div class="col-md-2">
                        <div class="input-group input-group-sm">
                            <button class="btn btn-outline-secondary" type="button" 
                                    onclick="updateCartItemQuantity(${item.Id}, ${item.Quantity - 1})"
                                    ${item.Quantity <= 1 ? 'disabled' : ''}>-</button>
                            <input type="text" class="form-control text-center" value="${item.Quantity}" readonly>
                            <button class="btn btn-outline-secondary" type="button" 
                                    onclick="updateCartItemQuantity(${item.Id}, ${item.Quantity + 1})"
                                    ${item.Quantity >= 99 ? 'disabled' : ''}>+</button>
                        </div>
                    </div>
                    <div class="col-md-1">
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="removeFromCart(${item.Id})"
                                title="Xóa">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    }
    
    if (cartTotalAmount) cartTotalAmount.textContent = `$${cartData.TotalAmount.toFixed(2)}`;
    if (cartTotalItems) cartTotalItems.textContent = cartData.TotalItems;
}

function showCart() {
    if (!currentUser || currentUser.role !== 'Customer') {
        showNotification('Chỉ Customer mới có thể xem giỏ hàng', 'error');
        return;
    }
    
    loadCart();
    const cartModal = new bootstrap.Modal(document.getElementById('cartModal'));
    if (cartModal) cartModal.show();
}

function proceedToCheckout() {
    if (!currentUser || currentUser.role !== 'Customer') {
        showNotification('Chỉ Customer mới có thể thanh toán', 'error');
        return;
    }
    
    alert('Chức năng thanh toán đang phát triển!');
}