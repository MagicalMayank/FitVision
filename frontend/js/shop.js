// ==========================================
// FITVISION SHOP DATABASE & CONTROLLER
// ==========================================

const PRODUCTS_DATA = [
  // --- PROTEIN ---
  {
    id: 'protein-1',
    category: 'Protein',
    brand: 'AVVATAR',
    name: '100% Performance Whey Protein',
    price: 3499,
    rating: 4.8,
    reviews: '1.4k',
    spec: '28g Protein / Serving',
    desc: 'Ultra-filtered performance whey formulated for rapid muscle synthesis and post-workout recovery.',
    tags: ['28g Protein', 'Fast Absorbing', '1kg'],
    image: 'Products/Protein/Avatar 100% Performance Protein.png'
  },
  {
    id: 'protein-2',
    category: 'Protein',
    brand: 'AVVATAR',
    name: 'Fuel Whey Protein',
    price: 2899,
    rating: 4.6,
    reviews: '920',
    spec: '24g Protein / Serving',
    desc: 'High quality grass-fed whey with natural digestive enzymes for optimal lean muscle growth.',
    tags: ['24g Protein', 'BCAAs', '1.5kg'],
    image: 'Products/Protein/Avatar Fuel Whey.png'
  },
  {
    id: 'protein-3',
    category: 'Protein',
    brand: 'MUSCLEBLAZE',
    name: 'Biozyme Gold 100% Whey',
    price: 4799,
    rating: 4.9,
    reviews: '3.8k',
    spec: '25g Protein / Serving',
    desc: "India's first clinically tested whey for 50% higher protein absorption and fastest muscle recovery.",
    tags: ['50% Higher Absorption', 'Clinically Tested', '2kg'],
    image: 'Products/Protein/Muscle Blaze Gold 100% Whey.png'
  },
  {
    id: 'protein-4',
    category: 'Protein',
    brand: 'MUSCLEBLAZE',
    name: 'Whey Protein PR Series',
    price: 2649,
    rating: 4.7,
    reviews: '1.8k',
    spec: '25g Protein / 5.5g BCAA',
    desc: 'Premium raw whey protein isolate with added digestive enzymes for maximum strength gain.',
    tags: ['25g Protein', '5.5g BCAA', '1kg'],
    image: 'Products/Protein/MuscleBlaze Whey Protein PR.png'
  },
  {
    id: 'protein-5',
    category: 'Protein',
    brand: 'MUSCLEBLAZE',
    name: '100% Raw Whey Concentrate',
    price: 2299,
    rating: 4.5,
    reviews: '2.1k',
    spec: '24g Protein / Unflavored',
    desc: 'Zero sugar, zero added flavor raw whey concentrate for versatile meal and smoothie mixing.',
    tags: ['Zero Sugar', 'Raw Whey', '1kg'],
    image: 'Products/Protein/Muscleblaze whey protein.png'
  },

  // --- SNACKS ---
  {
    id: 'snack-1',
    category: 'Snacks',
    brand: 'SUPER YOU',
    name: 'High Protein Crisp Wafers',
    price: 499,
    rating: 4.8,
    reviews: '640',
    spec: '15g Protein / Pack of 6',
    desc: 'Delicious crunch wafer packed with multi-source protein and minimal sugar for daily cravings.',
    tags: ['15g Protein', 'Crispy Cocoa', 'Box of 6'],
    image: 'Products/Snacks/Super you protein wafer.webp'
  },
  {
    id: 'snack-2',
    category: 'Snacks',
    brand: 'THE WHOLE TRUTH',
    name: 'All-In-One Protein Bar',
    price: 799,
    rating: 4.9,
    reviews: '1.2k',
    spec: '20g Protein / Box of 6',
    desc: '100% clean ingredients made with dates, cashew nuts, and whey isolate. No artificial syrups.',
    tags: ['100% Clean', 'No Added Sugar', '20g Protein'],
    image: 'Products/Snacks/The whole truth All in one protein bar.webp'
  },
  {
    id: 'snack-3',
    category: 'Snacks',
    brand: 'YOGA BAR',
    name: '26g High Protein Oats (1kg)',
    price: 599,
    rating: 4.7,
    reviews: '2.4k',
    spec: '26g Protein / 100g',
    desc: 'Power-packed breakfast oats enriched with chia, pumpkin seeds, and whey protein.',
    tags: ['26g Protein', 'Probiotics', '1kg Tub'],
    image: 'Products/Snacks/Yoga Bar 26g High Protein Oats 1kg.webp'
  },
  {
    id: 'snack-4',
    category: 'Snacks',
    brand: 'YOGA BAR',
    name: 'Dark Chocolate Breakfast Bar',
    price: 399,
    rating: 4.6,
    reviews: '890',
    spec: '12g Protein / Box of 6',
    desc: 'Rich dark chocolate breakfast bar crafted with whole grains and crunchy almond bits.',
    tags: ['Dark Cocoa', 'Whole Grains', 'Box of 6'],
    image: 'Products/Snacks/Yoga Bar Breakfast Protein Bar Dark Chocolate.webp'
  },
  {
    id: 'snack-5',
    category: 'Snacks',
    brand: 'THE WHOLE TRUTH',
    name: 'Fudgy Cocoa Protein Bar',
    price: 149,
    rating: 4.8,
    reviews: '1.5k',
    spec: '15g Protein / Single Bar',
    desc: 'Real cocoa and date-sweetened clean protein bar for guilt-free energy boosts anywhere.',
    tags: ['Fudgy Cocoa', '100% Clean', '15g Protein'],
    image: 'Products/Snacks/the whole truth protein bar.webp'
  },

  // --- SUPPLEMENTS ---
  {
    id: 'supp-1',
    category: 'Supplements',
    brand: 'AVVATAR',
    name: 'Micronised Creatine Fruit Punch',
    price: 1199,
    rating: 4.8,
    reviews: '950',
    spec: '3g Creatine / 250g Tub',
    desc: 'Refreshing fruit punch flavored micronised creatine monohydrate for explosive strength.',
    tags: ['3g Creatine', 'Fruit Punch', '250g'],
    image: 'Products/Supplements/Avvatar Micronised Creatine Monohydrate Fruit Punch.webp'
  },
  {
    id: 'supp-2',
    category: 'Supplements',
    brand: 'MUSCLEBLAZE',
    name: 'Biozyme Performance Iso-Whey',
    price: 3699,
    rating: 4.9,
    reviews: '2.8k',
    spec: '27g Isolate Protein',
    desc: 'Clinically tested highest absorption formula designed for intense training sessions.',
    tags: ['27g Isolate', 'Clinically Tested', '1kg'],
    image: 'Products/Supplements/MuscleBlaze Biozyme Whey PR.jpg'
  },
  {
    id: 'supp-3',
    category: 'Supplements',
    brand: 'MUSCLEBLAZE',
    name: 'Creatine Monohydrate Creapro',
    price: 999,
    rating: 4.7,
    reviews: '3.4k',
    spec: '100% Pure / Unflavored',
    desc: 'Ultra-pure 200 mesh micronised creatine monohydrate for muscle hydration and ATP power.',
    tags: ['Creapure®', '250g Tub', '83 Servings'],
    image: 'Products/Supplements/MuscleBlaze Creatine Monohydrate.webp'
  },
  {
    id: 'supp-4',
    category: 'Supplements',
    brand: 'MUSCLEBLAZE',
    name: 'Omega-3 Fish Oil (1000mg)',
    price: 699,
    rating: 4.6,
    reviews: '1.9k',
    spec: '180mg EPA / 120mg DHA',
    desc: 'Triple purified mercury-free softgel capsules supporting joint flexibility and heart wellness.',
    tags: ['Triple Purified', '90 Softgels', 'Zero Fishy Aftertaste'],
    image: 'Products/Supplements/MuscleBlaze Fish Oil Omega-3.jpg'
  },

  // --- HOME GYM ---
  {
    id: 'hg-1',
    category: 'Home Gym',
    brand: 'AEROLAP',
    name: 'Aerolap X All-in-One Multi-Gym Machine',
    price: 34999,
    rating: 4.9,
    reviews: '310',
    spec: 'Cable Pulley + Smith Rack',
    desc: 'Professional grade dual cable cross and squat rack system for full-body home strength training.',
    tags: ['Dual Cable Pulley', 'Heavy Duty', 'Commercial Steel'],
    image: 'Products/Home Gym/Aerolap X Strength Training Machine.jpg'
  },
  {
    id: 'hg-2',
    category: 'Home Gym',
    brand: 'FLEXNEST',
    name: 'Flexbike Lite Smart Exercise Bike',
    price: 16999,
    rating: 4.7,
    reviews: '780',
    spec: 'Bluetooth Sync / Magnetic',
    desc: 'Smart indoor exercise bike with app-connected virtual rides and silent magnetic resistance.',
    tags: ['App Sync', 'Silent Magnetic', 'Compact'],
    image: 'Products/Home Gym/Flexnest Flexbike Lite.webp'
  },
  {
    id: 'hg-3',
    category: 'Home Gym',
    brand: 'FLEXNEST',
    name: 'Flexbike Plus HD Touchscreen Bike',
    price: 39999,
    rating: 4.9,
    reviews: '520',
    spec: '22" HD Touchscreen',
    desc: 'Ultimate smart bike featuring rotating 22" HD screen and immersive live trainer-led workouts.',
    tags: ['22" HD Screen', 'Live Trainer Classes', 'Pro Edition'],
    image: 'Products/Home Gym/Flexnest Flexbike Plus.webp'
  },
  {
    id: 'hg-4',
    category: 'Home Gym',
    brand: 'FLEXNEST',
    name: 'Flexbike Connected Smart Bike',
    price: 24999,
    rating: 4.8,
    reviews: '1.1k',
    spec: '100 Resistance Levels',
    desc: 'Premium smart fitness bike with real-time cadence tracking and trainer leaderboard integration.',
    tags: ['100 Resistance Levels', 'Leaderboard Sync', 'Ergonomic'],
    image: 'Products/Home Gym/Flexnest Flexbike.webp'
  },

  // --- DUMBBELLS ---
  {
    id: 'db-1',
    category: 'Dumbbells',
    brand: 'AEROFIT',
    name: 'Aerofit Rubber Coated Hex Dumbbells',
    price: 3499,
    rating: 4.7,
    reviews: '620',
    spec: '10kg Hex Pair',
    desc: 'Heavy duty cast iron dumbbell pair with protective rubber casing and contoured knurled grip.',
    tags: ['Rubber Coated', 'Anti-Roll Hex', '10kg Pair'],
    image: 'Products/Dumbbells/Aerofit Dumbbell Pair.webp'
  },
  {
    id: 'db-2',
    category: 'Dumbbells',
    brand: 'COCKATOO',
    name: '3-in-1 Modular Dumbbell & Barbell Set',
    price: 2999,
    rating: 4.8,
    reviews: '1.4k',
    spec: '20kg Combo Kit',
    desc: 'Versatile 3-in-1 modular weight set convertible into dumbbells, barbell, or kettlebell.',
    tags: ['3-in-1 Convertible', '20kg Kit', 'Non-Slip Grip'],
    image: 'Products/Dumbbells/Cockatoo Dumbbell 3 in 1.webp'
  },
  {
    id: 'db-3',
    category: 'Dumbbells',
    brand: 'PROTONER',
    name: 'Protoner PVC Hex Dumbbells',
    price: 899,
    rating: 4.5,
    reviews: '2.9k',
    spec: '5kg Pair',
    desc: 'Budget-friendly floor-safe PVC coated hex dumbbells ideal for home workout routines.',
    tags: ['PVC Hex', 'Floor Safe', '5kg Pair'],
    image: 'Products/Dumbbells/Protoner PVC hex dumbbells 1 Pair.webp'
  },

  // --- WEARABLES ---
  {
    id: 'wear-1',
    category: 'Wearables',
    brand: 'AMAZFIT',
    name: 'Amazfit Helio Smart Fitness Ring / Strap',
    price: 12999,
    rating: 4.8,
    reviews: '410',
    spec: 'BioTracker™ Recovery',
    desc: 'Next-gen titanium recovery tracker measuring heart rate variability, skin temp, and readiness.',
    tags: ['Titanium Body', 'HRV & Sleep', 'Waterproof 50m'],
    image: 'Products/Wearables/Amazefit Helio Strap.jpg'
  },
  {
    id: 'wear-2',
    category: 'Wearables',
    brand: 'FITBIT',
    name: 'Fitbit Inspire 3 Health & Fitness Tracker',
    price: 7999,
    rating: 4.7,
    reviews: '3.1k',
    spec: '24/7 HR / 10-Day Battery',
    desc: 'Sleek lightweight fitness tracker with Active Zone Minutes and stress management score.',
    tags: ['10-Day Battery', 'SpO2 & HR', 'Water Resistant'],
    image: 'Products/Wearables/Fitbit Inspire 3.jpg'
  },
  {
    id: 'wear-3',
    category: 'Wearables',
    brand: 'PEBBLE',
    name: 'Pebble Qore Smart Fitness Band',
    price: 2499,
    rating: 4.6,
    reviews: '840',
    spec: 'HD AMOLED / SpO2',
    desc: 'Vibrant HD display fitness band with multi-sport tracking and smart notifications.',
    tags: ['AMOLED Display', 'Blood Oxygen', 'Multi-Sport'],
    image: 'Products/Wearables/Pebble Qore Fitness Band.webp'
  }
];

let activeCategory = 'All';
let searchQuery = '';
let currentSort = 'featured';

function initShop() {
  bindCategoryChips();
  bindSearchInput();
  bindFilterSort();
  renderProducts();
}

function bindCategoryChips() {
  const chips = document.querySelectorAll('.shop-cat-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => {
        c.classList.remove('bg-primary-fixed', 'text-on-primary-fixed', 'shadow-[0_0_15px_rgba(227,236,0,0.2)]');
        c.classList.add('bg-surface-container-high', 'text-on-surface', 'border', 'border-outline-variant/15');
      });
      chip.classList.remove('bg-surface-container-high', 'text-on-surface', 'border', 'border-outline-variant/15');
      chip.classList.add('bg-primary-fixed', 'text-on-primary-fixed', 'shadow-[0_0_15px_rgba(227,236,0,0.2)]');

      activeCategory = chip.getAttribute('data-category') || 'All';
      renderProducts();
    });
  });
}

function bindSearchInput() {
  const input = document.getElementById('storeSearchInput');
  if (input) {
    input.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderProducts();
    });
  }
}

function bindFilterSort() {
  const filterBtn = document.getElementById('storeFilterBtn');
  const sortSelect = document.getElementById('storeSortSelect');

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderProducts();
    });
  }

  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      const modal = document.getElementById('filterSortModal');
      if (modal) modal.style.display = 'flex';
    });
  }
}

function getFilteredProducts() {
  let list = PRODUCTS_DATA.filter(p => {
    const matchesCat = (activeCategory === 'All') || (p.category === activeCategory);
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery) ||
      p.brand.toLowerCase().includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery) ||
      p.desc.toLowerCase().includes(searchQuery);

    return matchesCat && matchesSearch;
  });

  if (currentSort === 'price-low') {
    list.sort((a, b) => a.price - b.price);
  } else if (currentSort === 'price-high') {
    list.sort((a, b) => b.price - a.price);
  } else if (currentSort === 'rating') {
    list.sort((a, b) => b.rating - a.rating);
  }

  return list;
}

function renderProducts() {
  const container = document.getElementById('productsGridContainer');
  const countEl = document.getElementById('productResultsCount');
  if (!container) return;

  const products = getFilteredProducts();

  if (countEl) {
    countEl.textContent = `Showing ${products.length} ${products.length === 1 ? 'product' : 'products'}`;
  }

  if (products.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
        <span class="material-symbols-outlined" style="font-size: 3.5rem; color: var(--on-surface-variant); opacity: 0.5;">search_off</span>
        <h3 class="font-headline" style="color: white; font-size: 1.2rem; margin-top: 0.75rem;">No Products Found</h3>
        <p style="color: var(--on-surface-variant); font-size: 0.85rem; margin-top: 0.25rem;">Try adjusting your search terms or selecting another category.</p>
        <button onclick="resetShopFilters()" class="btn-primary" style="display: inline-flex; margin-top: 1.25rem; padding: 0.65rem 1.25rem; font-size: 0.85rem;">
          RESET FILTERS
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="ref-card">
      <div class="ref-card__img-container">
        <img src="${p.image}" alt="${p.name}" loading="lazy" style="object-fit: contain; padding: 0.75rem; background: #0e0e11;">
        <button class="ref-card__fav" onclick="toggleWishlist(event, '${p.id}')" title="Save Product">
          <span class="material-symbols-outlined" id="fav-icon-${p.id}">favorite_border</span>
        </button>
      </div>
      <div class="ref-card__content">
        <div class="ref-card__header">
          <span class="ref-card__brand">${p.brand}</span>
          <h3 class="ref-card__title">${p.name}</h3>
        </div>
        <div class="ref-card__meta">
          <div class="ref-card__meta-item">
            <span class="material-symbols-outlined ref-card__rating-star">star</span>
            <span style="color:#e5e2e1; font-weight:700;">${p.rating}</span>
            <span>(${p.reviews})</span>
          </div>
        </div>
        <p class="ref-card__desc">${p.desc}</p>
        <div class="ref-card__tags">
          ${p.tags.map((t, idx) => `<span class="ref-card__tag ${idx === 0 ? 'ref-card__tag--highlight' : ''}">${t}</span>`).join('')}
        </div>
        <div class="ref-card__divider"></div>
        <div class="ref-card__footer">
          <div class="ref-card__price-box">
            <span class="ref-card__price-label">Price</span>
            <span class="ref-card__price">₹${p.price.toLocaleString('en-IN')}</span>
          </div>
          <button onclick="addShopItemToCart(event, '${p.id}')" class="ref-card__action-btn" title="Add to Cart">
            <span>Add to Cart</span>
            <span class="material-symbols-outlined">add_shopping_cart</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function resetShopFilters() {
  activeCategory = 'All';
  searchQuery = '';
  currentSort = 'featured';

  const input = document.getElementById('storeSearchInput');
  if (input) input.value = '';

  const chips = document.querySelectorAll('.shop-cat-chip');
  chips.forEach(chip => {
    const isAll = chip.getAttribute('data-category') === 'All';
    if (isAll) {
      chip.classList.remove('bg-surface-container-high', 'text-on-surface', 'border', 'border-outline-variant/15');
      chip.classList.add('bg-primary-fixed', 'text-on-primary-fixed', 'shadow-[0_0_15px_rgba(227,236,0,0.2)]');
    } else {
      chip.classList.remove('bg-primary-fixed', 'text-on-primary-fixed', 'shadow-[0_0_15px_rgba(227,236,0,0.2)]');
      chip.classList.add('bg-surface-container-high', 'text-on-surface', 'border', 'border-outline-variant/15');
    }
  });

  renderProducts();
}

function toggleWishlist(e, productId) {
  e.preventDefault();
  e.stopPropagation();
  const icon = document.getElementById(`fav-icon-${productId}`);
  if (icon) {
    if (icon.textContent === 'favorite_border') {
      icon.textContent = 'favorite';
      icon.style.color = '#e3ec00';
      showToast('Added to Wishlist ❤️');
    } else {
      icon.textContent = 'favorite_border';
      icon.style.color = '#e5e2e1';
      showToast('Removed from Wishlist');
    }
  }
}

function addShopItemToCart(e, productId) {
  e.preventDefault();
  e.stopPropagation();

  const product = PRODUCTS_DATA.find(p => p.id === productId);
  if (!product) return;

  try {
    let cart = [];
    const stored = localStorage.getItem('fitvision_cart');
    if (stored) cart = JSON.parse(stored);

    const existingIndex = cart.findIndex(item => item.id === product.id || item.name === product.name);
    if (existingIndex >= 0) {
      cart[existingIndex].qty = (cart[existingIndex].qty || 1) + 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        spec: product.spec || (product.tags ? product.tags.join(' • ') : ''),
        price: product.price,
        qty: 1,
        image: product.image
      });
    }

    localStorage.setItem('fitvision_cart', JSON.stringify(cart));
    
    // Update header cart badge counter
    if (typeof initCartBadges === 'function') {
      initCartBadges();
    } else {
      const totalItems = cart.reduce((acc, i) => acc + (i.qty || 1), 0);
      const badges = document.querySelectorAll('#cartBadgeCount');
      badges.forEach(b => b.textContent = totalItems);
    }

    showToast(`Added "${product.name}" to cart! 🛒`);
  } catch(err) {
    console.error('Cart add error:', err);
  }
}

function showToast(msg) {
  let toast = document.getElementById('shopToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'shopToast';
    toast.style.cssText = `
      position: fixed;
      bottom: 5.5rem;
      left: 50%;
      transform: translateX(-50%);
      background: var(--surface-container-highest, #2c2c2c);
      color: white;
      border: 1px solid var(--primary-fixed, #F5FF00);
      padding: 0.75rem 1.25rem;
      border-radius: 999px;
      font-family: var(--font-headline, 'Space Grotesk', sans-serif);
      font-size: 0.85rem;
      font-weight: 700;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      z-index: 2000;
      transition: opacity 0.3s, transform 0.3s;
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
  }, 2500);
}

document.addEventListener('DOMContentLoaded', initShop);
