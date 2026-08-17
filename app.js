// app.js
import {
  auth,
  db,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from './firebase-config.js';

// ============================================
// DOM References
// ============================================
const bookList = document.getElementById('bookList');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');
const barcodeInput = document.getElementById('barcodeInput');
const searchInput = document.getElementById('searchInput');
const customerSearch = document.getElementById('customerSearch');
const customerSuggestions = document.getElementById('customerSuggestions');

// ============================================
// State
// ============================================
let books = [];
let cart = [];
let selectedCustomer = null;
let currentUser = null;

// ============================================
// Auth Check
// ============================================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'index.html';
  } else {
    currentUser = user;
    userName.textContent = `👋 ${user.email}`;
    loadBooks();
    loadCustomers();
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'index.html';
});

// ============================================
// Load Books (Real-time)
// ============================================
function loadBooks() {
  const q = query(collection(db, 'books'), orderBy('title'));
  onSnapshot(q, (snapshot) => {
    books = [];
    snapshot.forEach((doc) => {
      books.push({ id: doc.id, ...doc.data() });
    });
    renderBooks(books);
  });
}

function renderBooks(booksToShow) {
  bookList.innerHTML = '';
  booksToShow.forEach((book) => {
    const card = document.createElement('div');
    card.className = `book-card ${book.stock <= 0 ? 'out-of-stock' : ''}`;
    card.innerHTML = `
      <div class="book-icon">📖</div>
      <h3 title="${book.title}">${book.title}</h3>
      <div class="author">${book.author || 'Unknown'}</div>
      <div class="price">$${book.price?.toFixed(2) || '0.00'}</div>
      <div class="stock">Stock: ${book.stock || 0}</div>
    `;
    if (book.stock > 0) {
      card.addEventListener('click', () => addToCart(book));
    }
    bookList.appendChild(card);
  });
}

// Search functionality
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase();
  const filtered = books.filter(b =>
    b.title.toLowerCase().includes(query) ||
    (b.author && b.author.toLowerCase().includes(query)) ||
    (b.isbn && b.isbn.includes(query))
  );
  renderBooks(filtered);
});

// Barcode scan
barcodeInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const isbn = barcodeInput.value.trim();
    if (isbn) {
      const found = books.find(b => b.isbn === isbn);
      if (found && found.stock > 0) {
        addToCart(found);
        barcodeInput.value = '';
      } else {
        alert('Book not found or out of stock');
      }
    }
  }
});

// ============================================
// Cart Functions
// ============================================
function addToCart(book) {
  const existing = cart.find(item => item.id === book.id);
  if (existing) {
    if (existing.quantity < book.stock) {
      existing.quantity++;
    } else {
      alert('Not enough stock!');
      return;
    }
  } else {
    cart.push({ ...book, quantity: 1 });
  }
  renderCart();
}

function removeFromCart(bookId) {
  cart = cart.filter(item => item.id !== bookId);
  renderCart();
}

function updateQuantity(bookId, delta) {
  const item = cart.find(i => i.id === bookId);
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    removeFromCart(bookId);
    return;
  }
  const book = books.find(b => b.id === bookId);
  if (newQty > book.stock) {
    alert('Not enough stock!');
    return;
  }
  item.quantity = newQty;
  renderCart();
}

function renderCart() {
  cartItems.innerHTML = '';
  let total = 0;
  cart.forEach((item) => {
    total += item.price * item.quantity;
    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <div class="item-info">
        <div class="item-title">${item.title}</div>
        <div class="item-price">$${item.price.toFixed(2)} x ${item.quantity}</div>
      </div>
      <div class="item-actions">
        <button onclick="window.updateQty('${item.id}', -1)">−</button>
        <span class="qty">${item.quantity}</span>
        <button onclick="window.updateQty('${item.id}', 1)">+</button>
        <button onclick="window.removeFromCart('${item.id}')" style="color:#e74c3c;border:none;background:transparent;font-size:18px;">✕</button>
      </div>
    `;
    cartItems.appendChild(div);
  });
  cartTotal.textContent = `$${total.toFixed(2)}`;
  checkoutBtn.disabled = cart.length === 0;
}

// Expose functions to global scope for inline onclick
window.updateQty = updateQuantity;
window.removeFromCart = removeFromCart;

// ============================================
// Customer Search
// ============================================
let customers = [];

function loadCustomers() {
  onSnapshot(collection(db, 'customers'), (snapshot) => {
    customers = [];
    snapshot.forEach((doc) => {
      customers.push({ id: doc.id, ...doc.data() });
    });
  });
}

customerSearch.addEventListener('input', () => {
  const query = customerSearch.value.toLowerCase();
  if (query.length < 2) {
    customerSuggestions.style.display = 'none';
    return;
  }
  const matches = customers.filter(c =>
    c.name.toLowerCase().includes(query) ||
    (c.phone && c.phone.includes(query))
  );
  if (matches.length === 0) {
    customerSuggestions.style.display = 'none';
    return;
  }
  customerSuggestions.innerHTML = '';
  matches.forEach(c => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = `${c.name} ${c.phone ? '📞 ' + c.phone : ''}`;
    div.addEventListener('click', () => {
      selectedCustomer = c;
      customerSearch.value = c.name;
      customerSuggestions.style.display = 'none';
    });
    customerSuggestions.appendChild(div);
  });
  customerSuggestions.style.display = 'block';
});

customerSearch.addEventListener('blur', () => {
  setTimeout(() => {
    customerSuggestions.style.display = 'none';
  }, 300);
});

// ============================================
// Checkout
// ============================================
checkoutBtn.addEventListener('click', async () => {
  if (cart.length === 0) return;

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const orderData = {
    items: cart.map(i => ({
      bookId: i.id,
      title: i.title,
      price: i.price,
      quantity: i.quantity
    })),
    total: total,
    customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
    customerId: selectedCustomer ? selectedCustomer.id : null,
    paymentMethod: 'cash',
    status: 'completed',
    createdAt: new Date().toISOString(),
    userId: currentUser.uid
  };

  try {
    // 1. Create order
    await addDoc(collection(db, 'orders'), orderData);

    // 2. Update stock
    for (const item of cart) {
      const bookRef = doc(db, 'books', item.id);
      const book = books.find(b => b.id === item.id);
      if (book) {
        await updateDoc(bookRef, { stock: book.stock - item.quantity });
      }
    }

    // 3. Update customer loyalty points
    if (selectedCustomer) {
      const customerRef = doc(db, 'customers', selectedCustomer.id);
      const points = Math.floor(total / 10);
      await updateDoc(customerRef, {
        loyaltyPoints: (selectedCustomer.loyaltyPoints || 0) + points
      });
    }

    alert('✅ Order placed successfully!');

    // Reset cart
    cart = [];
    selectedCustomer = null;
    customerSearch.value = '';
    renderCart();

  } catch (err) {
    alert('❌ Error placing order: ' + err.message);
  }
});