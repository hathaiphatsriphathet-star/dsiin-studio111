// ===== LAZY LOAD BACKGROUND IMAGES =====
(function() {
  if (!('IntersectionObserver' in window)) {
    // Fallback: load all immediately for old browsers
    document.querySelectorAll('[data-bg]').forEach(el => {
      el.style.backgroundImage = "url('" + el.dataset.bg + "')";
    });
    return;
  }
  const bgObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.style.backgroundImage = "url('" + el.dataset.bg + "')";
        bgObserver.unobserve(el);
      }
    });
  }, { rootMargin: '200px' });

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-bg]').forEach(el => bgObserver.observe(el));
  });
})();

// ===== CART UTILITIES =====
function cartGet() { return JSON.parse(localStorage.getItem('dsiin_cart') || '[]'); }
function cartSave(cart) { localStorage.setItem('dsiin_cart', JSON.stringify(cart)); }
function cartAdd(name, price, license) {
  const cart = cartGet();
  const key = name + '|' + license;
  if (!cart.find(i => i.key === key)) {
    cart.push({ key, name, price: parseInt(price) || 149, license: license || 'Personal Use' });
    cartSave(cart);
  }
  cartUpdateBadge();
}
function cartRemove(key) { cartSave(cartGet().filter(i => i.key !== key)); cartUpdateBadge(); }
function cartUpdateBadge() {
  const count = cartGet().length;
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-flex' : 'none';
  });
}
document.addEventListener('DOMContentLoaded', cartUpdateBadge);

// ===== PAGE LOADER =====
document.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('pageLoader');
  if (loader) loader.classList.add('hidden');
});

// ===== MOBILE NAV =====
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');
const mobileNavClose = document.getElementById('mobileNavClose');

if (hamburger && mobileNav) {
  hamburger.addEventListener('click', () => mobileNav.classList.add('open'));
  mobileNavClose?.addEventListener('click', () => mobileNav.classList.remove('open'));
  mobileNav.addEventListener('click', e => { if (e.target === mobileNav) mobileNav.classList.remove('open'); });
}

// ===== SCROLL TO TOP =====
const scrollTopBtn = document.getElementById('scrollTop');
window.addEventListener('scroll', () => {
  if (scrollTopBtn) {
    scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
  }
}, { passive: true });
scrollTopBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ===== ACTIVE NAV =====
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    link.classList.add('active');
  }
});

// ===== FAQ ACCORDION =====
let openFaq = null;
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item === openFaq;
    if (openFaq) openFaq.classList.remove('open');
    openFaq = isOpen ? null : item;
    if (openFaq) openFaq.classList.add('open');
  });
});

// ===== LIVE FONT PREVIEW =====
const previewTextarea = document.getElementById('previewTextarea');
const previewDisplay = document.getElementById('previewDisplay');
const sizeRange = document.getElementById('sizeRange');
const sizeValue = document.getElementById('sizeValue');

if (previewTextarea && previewDisplay) {
  previewTextarea.addEventListener('input', () => {
    previewDisplay.textContent = previewTextarea.value || 'Aa สวัสดี';
  });
}

if (sizeRange && previewDisplay) {
  previewDisplay.style.fontSize = sizeRange.value + 'px';
  sizeRange.addEventListener('input', () => {
    const size = sizeRange.value;
    previewDisplay.style.fontSize = size + 'px';
    if (sizeValue) sizeValue.textContent = size + 'px';
  });
}

// ===== LICENSE SELECTOR =====
document.querySelectorAll('.license-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.license-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    // Update price display
    const price = card.querySelector('.license-price')?.textContent;
    const mainPrice = document.getElementById('mainPrice');
    if (mainPrice && price) mainPrice.textContent = price;
  });
});

// ===== WISHLIST =====
function wishlistGet() { return JSON.parse(localStorage.getItem('ds_wishlist') || '[]'); }
function wishlistSave(w) { localStorage.setItem('ds_wishlist', JSON.stringify(w)); }

const wishlistBtn = document.getElementById('wishlistBtn');
if (wishlistBtn) {
  // Load saved state
  const fontName = new URLSearchParams(window.location.search).get('name') || document.querySelector('.product-title')?.textContent?.trim() || '';
  const saved = wishlistGet().includes(fontName);
  wishlistBtn.textContent = saved ? '❤️' : '🤍';
  if (saved) wishlistBtn.classList.add('active');

  wishlistBtn.addEventListener('click', () => {
    const name = new URLSearchParams(window.location.search).get('name') || document.querySelector('.product-title')?.textContent?.trim() || '';
    let list = wishlistGet();
    if (list.includes(name)) {
      list = list.filter(n => n !== name);
      wishlistBtn.textContent = '🤍';
      wishlistBtn.classList.remove('active');
    } else {
      list.push(name);
      wishlistBtn.textContent = '❤️';
      wishlistBtn.classList.add('active');
    }
    wishlistSave(list);
  });
}

// ===== SHOP FILTERS =====
document.querySelectorAll('.filter-item').forEach(item => {
  item.addEventListener('click', () => {
    const siblings = item.closest('ul').querySelectorAll('.filter-item');
    siblings.forEach(s => s.classList.remove('active'));
    item.classList.add('active');
  });
});

// ===== VIEW TOGGLE =====
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    const grid = document.getElementById('fontsGrid');
    if (grid) {
      grid.style.gridTemplateColumns = view === 'list'
        ? '1fr'
        : 'repeat(auto-fill, minmax(260px, 1fr))';
    }
  });
});

// ===== FILTER TAGS REMOVE =====
document.querySelectorAll('.filter-tag').forEach(tag => {
  tag.addEventListener('click', () => tag.remove());
});

// ===== SEARCH =====
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
if (searchBtn && searchInput) {
  searchBtn.addEventListener('click', () => {
    const q = searchInput.value.trim();
    if (!q) return;
    if (window.location.pathname.endsWith('shop.html')) {
      // อยู่บน shop.html แล้ว — live search จัดการแล้ว ไม่ต้อง redirect
      searchInput.dispatchEvent(new Event('input'));
    } else {
      window.location.href = `shop.html?q=${encodeURIComponent(q)}`;
    }
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchBtn.click();
  });
}

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ===== CONTACT FORM =====
const contactForm = document.getElementById('contactForm');
contactForm?.addEventListener('submit', e => {
  e.preventDefault();
  const btn = contactForm.querySelector('[type="submit"]');
  btn.textContent = 'กำลังส่ง...';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = 'ส่งสำเร็จแล้ว ✓';
    btn.style.background = '#2E9962';
    setTimeout(() => {
      btn.textContent = 'ส่งข้อความ';
      btn.style.background = '';
      btn.disabled = false;
      contactForm.reset();
    }, 3000);
  }, 1500);
});

// ===== NEWSLETTER =====
document.querySelectorAll('.newsletter-form').forEach(form => {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const btn = form.querySelector('button');
    if (!input || !input.value.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
      input.style.borderColor = '#e11d48';
      setTimeout(() => input.style.borderColor = '', 2000);
      return;
    }
    // Save email to localStorage
    const emails = JSON.parse(localStorage.getItem('ds_newsletter') || '[]');
    if (!emails.includes(input.value.trim())) {
      emails.push(input.value.trim());
      localStorage.setItem('ds_newsletter', JSON.stringify(emails));
    }
    input.value = '';
    input.placeholder = 'สมัครรับข่าวสารสำเร็จแล้ว ✓';
    input.disabled = true;
    if (btn) { btn.textContent = '✓'; btn.disabled = true; }
  });
});

// ===== SEARCH NORMALIZATION =====
function normalizeSearch(str) {
  return str
    .toLowerCase()
    .replace(/ว์/g, '์')       // ฮอว์กินส์ → ฮอ์กินส์
    .replace(/[่้๊๋็]/g, '');  // ตัดวรรณยุกต์และพินทุ
}

// ===== HOME FONTS SEARCH & FILTER =====
(function() {
  const grid = document.getElementById('homeFontsGrid');
  if (!grid) return;

  const searchInput = document.getElementById('homeFontsSearch');
  const filterPills = document.querySelectorAll('#homeFilterPills .home-filter-pill');
  const resultCount = document.getElementById('homeResultCount');
  const noResult = document.getElementById('homeNoResult');
  const cards = Array.from(grid.querySelectorAll('.font-card'));

  const INITIAL_LIMIT = 11;
  let currentFilter = 'all';
  let currentQuery = '';
  let currentSort = 'popular';
  let isLimited = true;

  // Store original DOM order for "ความนิยม" sort
  const originalOrder = [...cards];

  // --- Sort helpers ---
  function getPrice(card) {
    const txt = card.querySelector('.font-price')?.textContent || '';
    const m = txt.match(/[\d,]+/);
    return m ? parseInt(m[0].replace(',', '')) : 0;
  }
  function getName(card) {
    return card.querySelector('.font-card-name')?.textContent?.trim() || '';
  }
  function isNew(card) {
    return (card.querySelector('.card-badge')?.textContent || '').includes('ใหม่');
  }

  function applySort() {
    let sorted = [...originalOrder];
    if (currentSort === 'price-asc')  sorted.sort((a, b) => getPrice(a) - getPrice(b));
    if (currentSort === 'price-desc') sorted.sort((a, b) => getPrice(b) - getPrice(a));
    if (currentSort === 'newest')     sorted.sort((a, b) => (isNew(b) ? 1 : 0) - (isNew(a) ? 1 : 0));
    if (currentSort === 'name-az')    sorted.sort((a, b) => getName(a).localeCompare(getName(b), 'th'));
    sorted.forEach(card => grid.insertBefore(card, loadMoreCard));
  }

  // --- Sort dropdown ---
  const sortWrap = document.getElementById('homeSortWrap');
  const sortBtn  = document.getElementById('homeSortBtn');
  const sortLabel = document.getElementById('homeSortLabel');
  const sortOptions = document.querySelectorAll('#homeSortMenu .sort-option');

  if (sortBtn && sortWrap) {
    sortBtn.addEventListener('click', e => {
      e.stopPropagation();
      sortWrap.classList.toggle('open');
    });
    document.addEventListener('click', () => sortWrap.classList.remove('open'));
  }

  sortOptions.forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation();
      currentSort = opt.dataset.sort;
      sortOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      if (sortLabel) sortLabel.textContent = opt.textContent.replace('✓ ', '');
      sortWrap.classList.remove('open');
      isLimited = true;
      applySort();
      updateDisplay();
    });
  });

  // Create load-more card (same size slot as a font-card)
  const loadMoreCard = document.createElement('div');
  loadMoreCard.className = 'font-card font-card-load-more';
  loadMoreCard.innerHTML = `
    <div class="load-more-inner">
      <div class="load-more-icon">＋</div>
      <div class="load-more-text">ดูเพิ่มเติม</div>
      <div class="load-more-sub"></div>
    </div>
  `;
  grid.appendChild(loadMoreCard);

  loadMoreCard.addEventListener('click', () => {
    isLimited = false;
    updateDisplay();
  });

  function updateDisplay() {
    const isFiltering = currentQuery || currentFilter !== 'all';
    let visible = 0;
    let shown = 0;

    cards.forEach(card => {
      const name = (card.querySelector('.font-card-name')?.textContent || '').toLowerCase();
      const tags = Array.from(card.querySelectorAll('.font-card-tag')).map(t => t.textContent.toLowerCase());
      const badge = (card.querySelector('.card-badge')?.textContent || '').toLowerCase();

      const normQuery = normalizeSearch(currentQuery);
      const normName = normalizeSearch(name);
      const matchSearch = !currentQuery || normName.includes(normQuery) || name.includes(currentQuery) || tags.some(t => normalizeSearch(t).includes(normQuery));
      const matchFilter = currentFilter === 'all' || tags.includes(currentFilter) || badge.includes(currentFilter);
      const matches = matchSearch && matchFilter;

      if (matches) {
        visible++;
        if (!isFiltering && isLimited && shown >= INITIAL_LIMIT) {
          card.style.display = 'none';
        } else {
          card.style.display = '';
          shown++;
        }
      } else {
        card.style.display = 'none';
      }
    });

    const showLoadMore = !isFiltering && isLimited && visible > INITIAL_LIMIT;
    loadMoreCard.style.display = showLoadMore ? '' : 'none';
    if (showLoadMore) {
      loadMoreCard.querySelector('.load-more-sub').textContent = 'อีก ' + (visible - INITIAL_LIMIT) + ' แบบ';
    }

    const displayed = showLoadMore ? INITIAL_LIMIT : visible;
    if (resultCount) resultCount.textContent = 'แสดง ' + displayed + ' จาก ' + visible + ' ฟอนต์';
    if (noResult) noResult.style.display = visible === 0 ? '' : 'none';
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentQuery = searchInput.value.trim().toLowerCase();
      isLimited = true;
      updateDisplay();
    });
  }

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      isLimited = true;
      updateDisplay();
    });
  });

  updateDisplay();
})();

// ===== PASS FONT NAME TO PRODUCT PAGE =====
document.querySelectorAll('a.font-card').forEach(card => {
  card.addEventListener('click', e => {
    const nameEl = card.querySelector('.font-card-name');
    if (nameEl) {
      e.preventDefault();
      const name = nameEl.textContent.trim();
      const url = new URL(card.href, window.location.href);
      url.searchParams.set('name', name);
      window.location.href = url.toString();
    }
  });
});

// ===== HERO FONT SPECIMEN ROTATOR =====
(function() {
  const display  = document.getElementById('heroSpecimenDisplay');
  const nameEl   = document.getElementById('heroSpecimenName');
  const dots     = document.querySelectorAll('#heroSpecimenDots .hero-specimen-dot');
  const cardLink = document.getElementById('heroSpecimenLink');
  if (!display) return;

  function updateLink(name) {
    if (cardLink) cardLink.href = 'product.html?name=' + encodeURIComponent(name);
  }

  const allFonts = [
    { family: 'DSPetnoi',           name: 'ฟอนต์เป็ดน้อย',    text: 'สวัสดี'    },
    { family: 'DSKamin',            name: 'ฟอนต์คามิน',        text: 'ลายมือ'    },
    { family: 'DSKhanomtan',        name: 'ฟอนต์ขนมตาล',       text: 'น่ารัก'    },
    { family: 'DSBluewhale',        name: 'ฟอนต์บลูวาฬ',       text: 'สวยงาม'    },
    { family: 'DSLookpeach',        name: 'ฟอนต์ลูกพีช',       text: 'ครีเอทีฟ'  },
    { family: 'DSPasta',            name: 'ฟอนต์พาสต้า',       text: 'ดีไซน์'    },
    { family: 'DSMaphrao',          name: 'ฟอนต์มะพร้าว',      text: 'สวัสดี'    },
    { family: 'DSMatoer',           name: 'ฟอนต์ม้าเต่อ',      text: 'ลายมือ'    },
    { family: 'DSOilpastel',        name: 'ฟอนต์สีชอล์ค',      text: 'สไตล์'     },
    { family: 'DSNangsue',          name: 'ฟอนต์หนังสือ',       text: 'อักษรไทย'  },
    { family: 'DSKhaiwan',          name: 'ฟอนต์ไข่หวาน',      text: 'น่ารัก'    },
    { family: 'DSGoodday',          name: 'ฟอนต์กู๊ดเดย์',     text: 'สวยงาม'    },
    { family: 'DSInter',            name: 'ฟอนต์อินเตอร์',     text: 'สวัสดี'    },
    { family: 'DSCalculus',         name: 'ฟอนต์แคลคูลัส',     text: 'ดีไซน์'    },
    { family: 'DSCharlotte',        name: 'ฟอนต์ชาร์ลอตต์',    text: 'สไตล์'     },
    { family: 'DSNewyear',          name: 'ฟอนต์นิวเยียร์',    text: 'ความสุข'   },
    { family: 'DSLandokmai',        name: 'ฟอนต์ลานดอกไม้',    text: 'สวยงาม'    },
    { family: 'DSChaingmai',        name: 'ฟอนต์เชียงใหม่',    text: 'ลายมือ'    },
    { family: 'DSNoodle',           name: 'ฟอนต์ก๋วยเตี๋ยว',   text: 'น่ารัก'    },
    { family: 'TKGorya',            name: 'ฟอนต์กอหญ้า',       text: 'สวัสดี'    },
    { family: 'TKMooji',            name: 'ฟอนต์มูจิ',          text: 'ลายมือ'    },
    { family: 'DSfongnom',          name: 'ฟอนต์ฟองนม',         text: 'น่ารัก'    },
    { family: 'DSKhamuu',           name: 'ฟอนต์ขาหมู',         text: 'สวัสดี'    },
    { family: 'TKThanos',           name: 'ฟอนต์ธานอส',         text: 'ดีไซน์'    },
    { family: 'DSpadlom',           name: 'ฟอนต์พัดลม',         text: 'สวยงาม'    },
    { family: 'DSPhukhao',          name: 'ฟอนต์ภูเขา',         text: 'สไตล์'     },
    { family: 'TKVenus',            name: 'ฟอนต์วีนัส',         text: 'ลายมือ'    },
    { family: 'DSmooyor',           name: 'ฟอนต์หมูยอ',         text: 'สวัสดี'    },
    { family: 'DSGanesh',           name: 'ฟอนต์กาเนส',         text: 'ครีเอทีฟ'  },
    { family: 'DSBualoy',           name: 'ฟอนต์บัวลอย',        text: 'น่ารัก'    },
    { family: 'DSmaple',            name: 'ฟอนต์เมเปิล',        text: 'สวยงาม'    },
    { family: 'DSdiana',            name: 'ฟอนต์ไดอาน่า',       text: 'สไตล์'     },
    { family: 'DScyclone',          name: 'ฟอนต์ไซโคลน',        text: 'ดีไซน์'    },
    { family: 'TKPeter',            name: 'ฟอนต์ปีเตอร์',       text: 'สวัสดี'    },
    { family: 'DSstevia',           name: 'ฟอนต์สตีเวีย',       text: 'ลายมือ'    },
    { family: 'DSEclairs',          name: 'ฟอนต์เอแคลร์',       text: 'น่ารัก'    },
    { family: 'DSSubway',           name: 'ฟอนต์ซับเวย์',       text: 'สวยงาม'    },
    { family: 'TKDragon',           name: 'ฟอนต์ดราก้อน',       text: 'ครีเอทีฟ'  },
    { family: 'DSMotor',            name: 'ฟอนต์มอเตอร์',       text: 'สไตล์'     },

    { family: 'DSSomwhan',          name: 'ฟอนต์ส้มหวาน',       text: 'สวัสดี'    },
    { family: 'TKMooDeng',          name: 'ฟอนต์หมูเด้ง',       text: 'น่ารัก'    },
    { family: 'DSPhloenWan',        name: 'ฟอนต์เพลินวาน',      text: 'ความสุข'   },
    { family: 'DSChanomnueb',       name: 'ฟอนต์ชานมหนึบ',      text: 'สวยงาม'    },
    { family: 'DSAroimak',          name: 'ฟอนต์อร่อยมาก',      text: 'ดีไซน์'    },
    { family: 'DSCoachella',        name: 'ฟอนต์โคเชลล่า',      text: 'สไตล์'     },
    { family: 'DSValentine',        name: 'ฟอนต์วาเลนไทน์',     text: 'ลายมือ'    },
    { family: 'TKCayla',            name: 'ฟอนต์เซล่า',          text: 'สวัสดี'    },
    { family: 'TKAnis',             name: 'ฟอนต์เอนิส',          text: 'ครีเอทีฟ'  },
    { family: 'DSMustang',          name: 'ฟอนต์มัสแตง',         text: 'น่ารัก'    },
    { family: 'DSMala',             name: 'ฟอนต์หมาล่า',         text: 'สวยงาม'    },
    { family: 'TKMoobin',           name: 'ฟอนต์หมูบิน',         text: 'สไตล์'     },
    { family: 'DSBagel',            name: 'ฟอนต์เบเกิล',         text: 'ดีไซน์'    },
    { family: 'DSWelcome',          name: 'ฟอนต์เวลคัม',         text: 'สวัสดี'    },
    { family: 'DSKaphrao',          name: 'ฟอนต์กะเพรา',         text: 'ลายมือ'    },
    { family: 'DSBangsaen',         name: 'ฟอนต์บางแสน',         text: 'สวยงาม'    },
    { family: 'DSMaltese',          name: 'ฟอนต์มอลทีส',         text: 'ครีเอทีฟ'  },
    { family: 'DSmannoei',          name: 'ฟอนต์มันเนย',         text: 'น่ารัก'    },
    { family: 'DSMascot',           name: 'ฟอนต์มาสคอส',         text: 'สไตล์'     },
    { family: 'TKRasta',            name: 'ฟอนต์ราสต้า',          text: 'สวัสดี'    },
    { family: 'DSHomok',            name: 'ฟอนต์ห่อหมก',          text: 'ดีไซน์'    },
    { family: 'DSAn-ko',            name: 'ฟอนต์อันโกะ',          text: 'ลายมือ'    },
    { family: 'DShippie',           name: 'ฟอนต์ฮิปปี้',          text: 'สวยงาม'    },
    { family: 'RGHongkong',         name: 'ฟอนต์ฮ่องกง',          text: 'สไตล์'     },
    { family: 'TKNeptune',          name: 'ฟอนต์เนปจูน',          text: 'สวัสดี'    },
    { family: 'DSMendel',           name: 'ฟอนต์เมนเดล',          text: 'ครีเอทีฟ'  },
    { family: 'DSMelon',            name: 'ฟอนต์เมล่อน',          text: 'น่ารัก'    },
    { family: 'DSLepan',            name: 'ฟอนต์เลอแปง',          text: 'ดีไซน์'    },
    { family: 'TKPatty',            name: 'ฟอนต์แพตตี้',          text: 'ลายมือ'    },
    { family: 'TKAnlene',           name: 'ฟอนต์แอนลีน',          text: 'สวยงาม'    },
    { family: 'DSKhonglen',         name: 'ฟอนต์ของเล่น',          text: 'สวัสดี'    },
    { family: 'TKKhaosoi',          name: 'ฟอนต์ข้าวซอย',          text: 'สไตล์'     },
    { family: 'TKKhaopad',          name: 'ฟอนต์ข้าวผัด',          text: 'ครีเอทีฟ'  },
    { family: 'TKCreampuff',        name: 'ฟอนต์ครีมพัฟ',          text: 'น่ารัก'    },
    { family: 'DSCaramel',          name: 'ฟอนต์คาราเมล',          text: 'สวยงาม'    },
    { family: 'TKCanele',           name: 'ฟอนต์คาเนเล่',          text: 'ลายมือ'    },
    { family: 'DSCheesecake',        name: 'ฟอนต์ชีสเค้ก',          text: 'สวัสดี'    },
    { family: 'DSSunday',           name: 'ฟอนต์ซันเดย์',          text: 'ความสุข'   },
    { family: 'DSSydney',           name: 'ฟอนต์ซิดนีย์',          text: 'ดีไซน์'    },
    { family: 'DScynthia',          name: 'ฟอนต์ซินเทีย',          text: 'สไตล์'     },
    { family: 'DStakeab',           name: 'ฟอนต์ตะเกียบ',          text: 'ลายมือ'    },
    { family: 'DSBallet',           name: 'ฟอนต์บัลเลต์',          text: 'สวยงาม'    },
    { family: 'DSBanball',          name: 'ฟอนต์บ้านบอล',          text: 'สวัสดี'    },
    { family: 'DSBansuan',          name: 'ฟอนต์บ้านสวน',          text: 'น่ารัก'    },
    { family: 'DSpangyen',          name: 'ฟอนต์ปังเย็น',          text: 'ครีเอทีฟ'  },
    { family: 'DSpakkrob',          name: 'ฟอนต์ผักกรอบ',          text: 'ดีไซน์'    },
    { family: 'TKPudding',          name: 'ฟอนต์พุดดิ้ง',          text: 'ลายมือ'    },
    { family: 'DSMorgan',           name: 'ฟอนต์มอร์แกน',          text: 'สวยงาม'    },
    { family: 'TKManmuang',         name: 'ฟอนต์มันม่วง',          text: 'สวัสดี'    },
    { family: 'DSMalfeil',          name: 'ฟอนต์มัลเฟิล',          text: 'สไตล์'     },
    { family: 'TKBobtailFull',      name: 'ฟอนต์บ็อบเทล',          text: 'น่ารัก'    },
    { family: 'TKMartin',           name: 'ฟอนต์มาร์ติน',          text: 'ลายมือ'    },
    { family: 'DSMarvel',           name: 'ฟอนต์มาร์เวล',          text: 'ครีเอทีฟ'  },
    { family: 'DSminako',           name: 'ฟอนต์มินาโกะ',          text: 'สวยงาม'    },
    { family: 'DSMeter',            name: 'ฟอนต์มิเตอร์',          text: 'ดีไซน์'    },
    { family: 'DSwaidek',           name: 'ฟอนต์วัยเด็ก',          text: 'สวัสดี'    },
    { family: 'DSScalar',           name: 'ฟอนต์สเกลาร์',          text: 'สไตล์'     },
    { family: 'DSMonThong',         name: 'ฟอนต์หมอนทอง',          text: 'ลายมือ'    },
    { family: 'DSMookrobThin',      name: 'ฟอนต์หมูกรอบ',          text: 'น่ารัก'    },
    { family: 'DSMokaeng', name: 'ฟอนต์หม้อแกง',       text: 'สวัสดี'    },
    { family: 'DSJaonaay',          name: 'ฟอนต์เจ้านาย',          text: 'สวยงาม'    },
    { family: 'TKTeddy',            name: 'ฟอนต์เท็ดดี้',          text: 'ครีเอทีฟ'  },
    { family: 'DSmajor',            name: 'ฟอนต์เมเจอร์',          text: 'ดีไซน์'    },
    { family: 'DSgalileo',          name: 'ฟอนต์กาลิเลโอ',         text: 'สไตล์'     },
    { family: 'TKConnor',           name: 'ฟอนต์คอนเนอร์',         text: 'ลายมือ'    },
    { family: 'DScatier',           name: 'ฟอนต์คาเทียร์',         text: 'สวยงาม'    },
    { family: 'DSsummer',           name: 'ฟอนต์ซัมเมอร์',         text: 'สวัสดี'    },
    { family: 'DSDaosao',           name: 'ฟอนต์ดาวเสาร์',         text: 'น่ารัก'    },
    { family: 'DSThunder',          name: 'ฟอนต์ธันเดอร์',         text: 'ครีเอทีฟ'  },
    { family: 'DSfigure',           name: 'ฟอนต์ฟิกเกอร์',         text: 'ดีไซน์'    },
    { family: 'DSMustard',          name: 'ฟอนต์มัสตาร์ด',         text: 'สไตล์'     },
    { family: 'DSSpacebar',         name: 'ฟอนต์สเปซบาร์',         text: 'ลายมือ'    },
    { family: 'DSAlmond',           name: 'ฟอนต์อัลมอนด์',         text: 'สวยงาม'    },
    { family: 'DSMerlin',           name: 'ฟอนต์เมอร์ลิน',         text: 'สวัสดี'    },
    { family: 'DSMueangjeen',       name: 'ฟอนต์เมืองจีน',         text: 'สไตล์'     },
    { family: 'DSkhaoklong',        name: 'ฟอนต์ข้าวกล่อง',        text: 'ครีเอทีฟ'  },
    { family: 'DSMelbourne',        name: 'ฟอนต์เมลเบิร์น',        text: 'น่ารัก'    },
    { family: 'DSReindeer',         name: 'ฟอนต์เรนเดียร์',        text: 'ดีไซน์'    },
    { family: 'DSWednesday',        name: 'ฟอนต์เวนส์เดย์',        text: 'ลายมือ'    },
    { family: 'DSpanfilm',          name: 'ฟอนต์แผ่นฟิล์ม',        text: 'สวัสดี'    },
    { family: 'DSNewclear',         name: 'ฟอนต์นิวเคลียร์',       text: 'สวยงาม'    },
    { family: 'DSBirthday',         name: 'ฟอนต์เบิร์ดเดย์',       text: 'ความสุข'   },
    { family: 'DSCarrot',           name: 'ฟอนต์แครอท',            text: 'น่ารัก'    },
  ];

  // Fisher-Yates shuffle
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let queue = shuffle(allFonts);
  let current = 0;

  display.style.fontFamily = `'${queue[0].family}', sans-serif`;
  display.textContent = queue[0].text;
  nameEl.textContent  = queue[0].name;
  updateLink(queue[0].name);
  dots.forEach((d, i) => d.classList.toggle('active', i === 0));

  function next() {
    display.style.opacity = '0';
    display.style.transform = 'translateY(10px)';
    nameEl.style.opacity = '0';
    setTimeout(() => {
      current++;
      if (current >= queue.length) {
        queue = shuffle(allFonts);
        current = 0;
      }
      const f = queue[current];
      display.style.fontFamily = `'${f.family}', sans-serif`;
      display.textContent = f.text;
      nameEl.textContent  = f.name;
      updateLink(f.name);
      dots.forEach((d, i) => d.classList.toggle('active', i === current % dots.length));
      display.style.opacity = '1';
      display.style.transform = 'translateY(0)';
      nameEl.style.opacity = '1';
    }, 360);
  }

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(next, 2800);
  }
})();

// ===== 3D CARD TILT =====
(function() {
  // Only on devices that support hover (not touch-only)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover)').matches) return;

  let activeCard = null;
  let rafId = null;

  function resetCard(card) {
    card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    card.style.transform = '';
    setTimeout(() => { if (card.style.transition) card.style.transition = ''; }, 520);
  }

    // Only enable 3D hover on devices with a fine pointer (mouse)
    const isDesktop = window.matchMedia('(pointer: fine)').matches;
    if (isDesktop) {
      grid.addEventListener('mousemove', e => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const card = e.target.closest('.font-card');
          if (!card || card.classList.contains('font-card-load-more')) return;

          if (activeCard && activeCard !== card) resetCard(activeCard);
          activeCard = card;

          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const rotY =  ((x - cx) / cx) * 9;
          const rotX = -((y - cy) / cy) * 6;

          card.style.transition = 'box-shadow 0.25s ease, border-color 0.25s ease';
          card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-8px) scale(1.02)`;
        });
      }, { passive: true });

      grid.addEventListener('mouseleave', () => {
        if (activeCard) { resetCard(activeCard); activeCard = null; }
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      });
    }
})();

// ===== SCROLL ANIMATIONS =====
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReducedMotion && 'IntersectionObserver' in window) {
  const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        scrollObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px 50px 0px' });

  document.querySelectorAll('.testimonial-card, .value-card, .team-card, .category-card').forEach((el, i) => {
    el.classList.add('animate-on-scroll');
    // stagger within siblings (faster stagger for better feel)
    const siblingIndex = Array.from(el.parentElement?.children || []).indexOf(el);
    const delay = Math.min(siblingIndex * 0.04, 0.24);
    el.style.transitionDelay = delay + 's';
    scrollObserver.observe(el);
  });
}

// ===== FIX PAGE LOADER =====
const loaderEl = document.getElementById('pageLoader');
if (loaderEl) {
  loaderEl.addEventListener('transitionend', () => {
    if (loaderEl.classList.contains('hidden')) {
      loaderEl.style.display = 'none';
    }
  });
}

// ===== PAGE TRANSITION =====
(function() {
  const overlay = document.createElement('div');
  overlay.className = 'page-transition-overlay';
  document.body.appendChild(overlay);

  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || link.target === '_blank') return;
    link.addEventListener('click', e => {
      e.preventDefault();
      overlay.classList.add('fade-out');
      setTimeout(() => { window.location.href = href; }, 240);
    });
  });
})();

// ===== FONT CARD STAGGER ENTRANCE =====
(function() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced || !('IntersectionObserver' in window)) return;

  const grids = document.querySelectorAll('.fonts-grid');
  grids.forEach(grid => {
    const cards = grid.querySelectorAll('.font-card:not(.font-card-load-more)');
    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          const idx = card.dataset.cardIdx || 0;
          card.style.animationDelay = (idx * 0.06) + 's';
          card.classList.add('card-animate');
          cardObserver.unobserve(card);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px 60px 0px' });

    cards.forEach((card, i) => {
      card.dataset.cardIdx = i % 8;
      cardObserver.observe(card);
    });
  });
})();
