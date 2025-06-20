// Configuration
const API_BASE_URL = 'https://localhost:7288/api/BookApi'; // Thay xxx bằng port của bạn
let currentBooks = [];
let currentBookId = null;

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
    });
}

// Load all books
async function loadAllBooks() {
    showLoading(true);
    try {
        const response = await fetch(API_BASE_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const books = await response.json();
        currentBooks = books;
        displayBooks(books);
        updateBookCount(books.length);
        showNotification('Books loaded successfully!', 'success');
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
            <img src="${coverImage}" 
                 class="card-img-top book-cover" 
                 alt="${book.Title}"
                 onclick="showBookDetails(${book.Id})"
                 onerror="this.src='${defaultImage}'">
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
        loadingSpinner.classList.remove('d-none');
        booksSection.classList.add('d-none');
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

function updateBookCount(count) {
    bookCount.textContent = `${count} book${count !== 1 ? 's' : ''}`;
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