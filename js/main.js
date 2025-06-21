// Configuration
const API_BASE_URL = 'https://localhost:7288/api/BookApi'; // Thay xxx bằng port của bạn
let currentBooks = [];
let currentBookId = null;

// Pagination variables
let currentPage = 1;
let pageSize = 15; // 15 books per page
let totalBooks = 0;
let totalPages = 0; 

// DOM Elements
const loadingSpinner = document.getElementById('loadingSpinner');
const booksSection = document.getElementById('booksSection');
const addBookSection = document.getElementById('addBookSection');
const booksContainer = document.getElementById('booksContainer');
const bookCount = document.getElementById('bookCount');
const addBookForm = document.getElementById('addBookForm');
const searchInput = document.getElementById('searchInput');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadAllBooks();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Add book form submission
    addBookForm.addEventListener('submit', handleAddBook);
    
    // Search functionality
    searchInput.addEventListener('input', debounce(handleSearch, 300));
    
    // Enter key for search
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBooks();
        }
    })
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    pageSizeSelect.addEventListener('change', function() {
        pageSize = parseInt(this.value);
        currentPage = 1; // Reset to first page
        loadAllBooks(1);
    });
}
function updatePagination() {
    const paginationNav = document.getElementById('paginationNav');
    const paginationList = document.getElementById('paginationList');
    const paginationInfo = document.getElementById('paginationInfo');
    
    // Hiển thị pagination nếu có nhiều hơn 1 trang
    if (totalPages > 1) {
        paginationNav.classList.remove('d-none');
        
        // Update pagination info
        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(currentPage * pageSize, totalBooks);
        paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalBooks} books`;
        
        // Generate pagination buttons
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
        
        // First page if not in range
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
        
        // Page range
        for (let i = startPage; i <= endPage; i++) {
            const active = i === currentPage ? 'active' : '';
            paginationList.innerHTML += `
                <li class="page-item ${active}">
                    <a class="page-link" href="#" onclick="goToPage(${i})">${i}</a>
                </li>
            `;
        }
        
        // Last page if not in range
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
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Load new page
    loadAllBooks(page);
}

// Load all books
async function loadAllBooks(page = 1) {
    showLoading(true);
    try {
        // Sử dụng API paged có sẵn
        const response = await fetch(`${API_BASE_URL}/paged?page=${page}&pageSize=${pageSize}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Update pagination info
        currentPage = result.Page;
        totalBooks = result.TotalBooks;
        totalPages = result.TotalPages;
        
        // Display books
        currentBooks = result.Data;
        displayBooks(result.Data);
        updateBookCount(totalBooks);
        updatePagination();
        
        showNotification(`Loaded page ${currentPage} successfully!`, 'success');
    } catch (error) {
        console.error('Error loading books:', error);
        showNotification('Error loading books. Please check your connection.', 'error');
        displayNoBooks();
    } finally {
        showLoading(false);
    }
}

// Display books in grid
function displayBooks(books) {
    booksContainer.innerHTML = '';
    
    if (books.length === 0) {
        displayNoBooks();
        return;
    }
    
    books.forEach((book, index) => {
        const bookCard = createBookCard(book, index);
        booksContainer.appendChild(bookCard);
    });
    
    // Thêm lazy loading cho images
    setTimeout(initLazyLoading, 100);
}

// Create individual book card
function createBookCard(book, index) {
    const col = document.createElement('div');
    col.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
    
    const defaultImage = 'https://via.placeholder.com/200x250/6c757d/ffffff?text=No+Image';
    const coverImage = book.CoverImg || defaultImage;
    const rating = book.Rating ? parseFloat(book.Rating).toFixed(1) : 'N/A';
    const price = book.Price ? parseFloat(book.Price).toFixed(2) : '0.00';
    
    col.innerHTML = `
        <div class="card book-card h-100">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='250' viewBox='0 0 200 250'%3E%3Crect width='200' height='250' fill='%23f8f9fa'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='0.3em' fill='%236c757d'%3ELoading...%3C/text%3E%3C/svg%3E" 
                data-src="${coverImage}" 
                class="card-img-top book-cover lazy-load" 
                alt="${book.Title}"
                onclick="showBookDetails(${book.Id})"
                loading="lazy">
            <div class="card-body d-flex flex-column">
                <h6 class="book-title">${book.Title}</h6>
                <p class="book-author">by ${book.Author}</p>
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
            <div class="card-actions d-flex gap-1">
                <button class="btn btn-primary btn-sm flex-fill" onclick="showBookDetails(${book.Id})">
                    <i class="bi bi-eye"></i> View
                </button>
                <button class="btn btn-warning btn-sm" onclick="editBook(${book.Id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteBook(${book.Id})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    // Add stagger animation delay
    col.style.animationDelay = `${index * 0.1}s`;
    
    return col;
}

// Show book details in modal
async function showBookDetails(bookId) {
    try {
        const response = await fetch(`${API_BASE_URL}/${bookId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const book = await response.json();
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
                    <p class="text-muted">by ${book.Author}</p>
                    
                    <div class="row mb-2">
                        <div class="col-sm-6">
                            <strong>Price:</strong> $${parseFloat(book.Price || 0).toFixed(2)}
                        </div>
                        <div class="col-sm-6">
                            ${book.Rating ? `<strong>Rating:</strong> <span class="text-warning"><i class="bi bi-star-fill"></i> ${parseFloat(book.Rating).toFixed(1)}</span>` : ''}
                        </div>
                    </div>
                    
                    <div class="row mb-2">
                        <div class="col-sm-6">
                            ${book.Pages ? `<strong>Pages:</strong> ${book.Pages}` : ''}
                        </div>
                        <div class="col-sm-6">
                            ${book.Language ? `<strong>Language:</strong> ${book.Language}` : ''}
                        </div>
                    </div>
                    
                    ${book.Series ? `<p><strong>Series:</strong> ${book.Series}</p>` : ''}
                    ${book.Genres ? `<p><strong>Genres:</strong> ${book.Genres}</p>` : ''}
                    ${book.Description ? `<p><strong>Description:</strong> ${book.Description}</p>` : ''}
                    ${book.NumRatings ? `<p><strong>Total Ratings:</strong> ${book.NumRatings}</p>` : ''}
                </div>
            </div>
        `;
        
        // Setup modal buttons
        document.getElementById('editBookBtn').onclick = () => editBook(bookId);
        document.getElementById('deleteBookBtn').onclick = () => deleteBook(bookId);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('bookModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error loading book details:', error);
        showNotification('Error loading book details', 'error');
    }
}

// Show/hide sections
function showAllBooks() {
    booksSection.classList.remove('d-none');
    addBookSection.classList.add('d-none');
    loadAllBooks();
}

function showAddForm() {
    booksSection.classList.add('d-none');
    addBookSection.classList.remove('d-none');
    addBookForm.reset();
}

// Handle add book form submission
async function handleAddBook(e) {
    e.preventDefault();
    
    const formData = {
        Title: document.getElementById('bookTitle').value,
        Author: document.getElementById('bookAuthor').value,
        Price: parseFloat(document.getElementById('bookPrice').value),
        Pages: parseInt(document.getElementById('bookPages').value) || null,
        Language: document.getElementById('bookLanguage').value || null,
        Description: document.getElementById('bookDescription').value || null,
        Genres: document.getElementById('bookGenres').value || null,
        CoverImg: document.getElementById('bookCoverImg').value || null
    };
    
    try {
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        showNotification('Book added successfully!', 'success');
        showAllBooks();
        
    } catch (error) {
        console.error('Error adding book:', error);
        showNotification('Error adding book. Please try again.', 'error');
    }
}

// Delete book
async function deleteBook(bookId) {
    if (!confirm('Are you sure you want to delete this book?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/${bookId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        showNotification('Book deleted successfully!', 'success');
        
        // Close modal if open
        const modal = bootstrap.Modal.getInstance(document.getElementById('bookModal'));
        if (modal) {
            modal.hide();
        }
        
        loadAllBooks();
        
    } catch (error) {
        console.error('Error deleting book:', error);
        showNotification('Error deleting book. Please try again.', 'error');
    }
}

// Edit book (placeholder - would need edit form)
function editBook(bookId) {
    showNotification('Edit functionality coming soon!', 'info');
}

// Search books
function searchBooks() {
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query) {
        displayBooks(currentBooks);
        updateBookCount(currentBooks.length);
        return;
    }
    
    const filteredBooks = currentBooks.filter(book => 
        book.Title.toLowerCase().includes(query) ||
        book.Author.toLowerCase().includes(query) ||
        (book.Genres && book.Genres.toLowerCase().includes(query))
    );
    
    displayBooks(filteredBooks);
    updateBookCount(filteredBooks.length);
    
    if (filteredBooks.length === 0) {
        showNotification(`No books found for "${query}"`, 'info');
    }
}

// Handle search input
function handleSearch(e) {
    searchBooks();
}

// Utility functions
function showLoading(show) {
    if (show) {
        loadingSpinner.classList.add('d-none'); // Ẩn spinner cũ
        booksSection.classList.remove('d-none');
        
        // Hiển thị skeleton cards
        booksContainer.innerHTML = '';
        for (let i = 0; i < 8; i++) {
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
        booksSection.classList.remove('d-none');
    }
}

function displayNoBooks() {
    booksContainer.innerHTML = `
        <div class="col-12 text-center py-5">
            <i class="bi bi-book display-1 text-muted"></i>
            <h3 class="text-muted mt-3">No books found</h3>
            <p class="text-muted">Try adjusting your search or add some books to get started.</p>
        </div>
    `;
}

// Lazy loading cho images
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
    });

    document.querySelectorAll('.lazy-load').forEach(img => {
        imageObserver.observe(img);
    });
}

// Search cache để tăng tốc tìm kiếm
const searchCache = new Map();

// Tối ưu search function (thay thế function searchBooks hiện tại)
function searchBooks() {
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query) {
        // Reset to normal pagination
        currentPage = 1;
        loadAllBooks(1);
        return;
    }
    
    // Search trong current books hoặc gọi API search
    const filteredBooks = currentBooks.filter(book => 
        book.Title.toLowerCase().includes(query) ||
        book.Author.toLowerCase().includes(query) ||
        (book.Genres && book.Genres.toLowerCase().includes(query))
    );
    
    // Hiển thị kết quả search (không có pagination cho search)
    displayBooks(filteredBooks);
    updateBookCount(filteredBooks.length);
    
    // Ẩn pagination khi search
    document.getElementById('paginationNav').classList.add('d-none');
    
    if (filteredBooks.length === 0) {
        showNotification(`No books found for "${query}"`, 'info');
    }
}
function updateBookCount(count) {
    bookCount.textContent = `${count} book${count !== 1 ? 's' : ''}`;
}

function showPageLoading(show) {
    const paginationList = document.getElementById('paginationList');
    if (show) {
        paginationList.classList.add('pagination-loading');
    } else {
        paginationList.classList.remove('pagination-loading');
    }
}

// SỬA function loadAllBooks để có loading state
async function loadAllBooks(page = 1) {
    showLoading(true);
    showPageLoading(true);
    
    try {
        // ... existing code ...
    } finally {
        showLoading(false);
        showPageLoading(false);
    }
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    
    // Set message
    notificationMessage.textContent = message;
    
    // Set type class
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
    
    // Show toast
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