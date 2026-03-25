// ===== AUTH SYSTEM =====
(function () {
  // ---- Storage Helpers ----
  function getUsers() { return JSON.parse(localStorage.getItem('ds_users') || '[]'); }
  function saveUsers(u) { localStorage.setItem('ds_users', JSON.stringify(u)); }
  function getUser() { return JSON.parse(localStorage.getItem('ds_session') || 'null'); }
  function setUser(u) { localStorage.setItem('ds_session', JSON.stringify(u)); }
  function clearUser() { localStorage.removeItem('ds_session'); }

  // ---- Purchase History ----
  window.savePurchaseHistory = function (items) {
    const user = getUser();
    if (!user) return;
    const key = 'ds_orders_' + user.email;
    const orders = JSON.parse(localStorage.getItem(key) || '[]');
    const now = new Date();
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const date = now.getDate() + ' ' + months[now.getMonth()] + ' ' + (now.getFullYear() + 543);
    orders.unshift({ date, items: JSON.parse(JSON.stringify(items)), total: items.reduce((s, i) => s + i.price, 0) });
    localStorage.setItem(key, JSON.stringify(orders));
  };

  function getPurchaseHistory() {
    const user = getUser();
    if (!user) return [];
    return JSON.parse(localStorage.getItem('ds_orders_' + user.email) || '[]');
  }

  // ---- Profile Modal HTML ----
  const profileHTML = `
<div id="profileOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;align-items:center;justify-content:center;">
  <div style="background:white;border-radius:20px;padding:32px;width:100%;max-width:500px;margin:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15);position:relative;max-height:85vh;overflow-y:auto;">
    <button onclick="document.getElementById('profileOverlay').style.display='none'" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#888;">✕</button>
    <div id="profileContent"></div>
  </div>
</div>`;

  // ---- Auth Modal HTML ----
  const modalHTML = `
<div id="authOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9998;align-items:center;justify-content:center;">
  <div style="background:white;border-radius:20px;padding:36px 32px;width:100%;max-width:420px;margin:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15);position:relative;">
    <div id="authCloseBtn" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#888;display:none;" onclick="authClose()">✕</div>

    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:1.5rem;font-weight:800;color:#1a1a2e;">สถานีฟอนต์</div>
      <div style="font-size:0.8rem;color:#888;">Dsiin Studio</div>
      <div id="authRequiredNote" style="font-size:0.78rem;color:#ec4899;margin-top:6px;display:none;">กรุณาเข้าสู่ระบบเพื่อใช้งาน</div>
    </div>

    <div style="display:flex;border-radius:12px;background:#f5f5f5;padding:4px;margin-bottom:24px;">
      <button id="tabLogin" onclick="authTab('login')" style="flex:1;padding:9px;border:none;border-radius:9px;font-size:0.9rem;font-weight:600;cursor:pointer;background:white;color:#1a1a2e;box-shadow:0 2px 6px rgba(0,0,0,0.08);">เข้าสู่ระบบ</button>
      <button id="tabRegister" onclick="authTab('register')" style="flex:1;padding:9px;border:none;border-radius:9px;font-size:0.9rem;font-weight:600;cursor:pointer;background:transparent;color:#888;">สมัครสมาชิก</button>
    </div>

    <div id="formLogin">
      <div style="margin-bottom:14px;">
        <label style="font-size:0.82rem;color:#666;display:block;margin-bottom:6px;">อีเมล</label>
        <input id="loginEmail" type="email" placeholder="your@email.com" style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:0.9rem;font-family:inherit;box-sizing:border-box;outline:none;" onfocus="this.style.borderColor='#f9a8d4'" onblur="this.style.borderColor='#e5e7eb'">
      </div>
      <div style="margin-bottom:20px;">
        <label style="font-size:0.82rem;color:#666;display:block;margin-bottom:6px;">รหัสผ่าน</label>
        <input id="loginPassword" type="password" placeholder="รหัสผ่าน" style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:0.9rem;font-family:inherit;box-sizing:border-box;outline:none;" onfocus="this.style.borderColor='#f9a8d4'" onblur="this.style.borderColor='#e5e7eb'" onkeydown="if(event.key==='Enter')doLogin()">
      </div>
      <div id="loginMsg" style="font-size:0.82rem;text-align:center;margin-bottom:12px;min-height:18px;"></div>
      <button onclick="doLogin()" style="width:100%;padding:13px;background:linear-gradient(135deg,#f9a8d4,#c4b5fd);border:none;border-radius:12px;font-size:0.95rem;font-weight:700;color:#1a1a2e;cursor:pointer;">เข้าสู่ระบบ</button>
      <p style="text-align:center;font-size:0.82rem;color:#888;margin-top:10px;">
        <a href="#" onclick="authTab('forgot');return false;" style="color:#ec4899;font-weight:600;text-decoration:none;">ลืมรหัสผ่าน?</a>
        &nbsp;·&nbsp; ยังไม่มีบัญชี? <a href="#" onclick="authTab('register');return false;" style="color:#ec4899;font-weight:600;text-decoration:none;">สมัครสมาชิก</a>
      </p>
    </div>

    <div id="formForgot" style="display:none;">
      <div style="text-align:center;margin-bottom:16px;font-size:0.88rem;color:#555;">ใส่อีเมลและรหัสผ่านใหม่</div>
      <div style="margin-bottom:14px;">
        <label style="font-size:0.82rem;color:#666;display:block;margin-bottom:6px;">อีเมล</label>
        <input id="forgotEmail" type="email" placeholder="your@email.com" style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:0.9rem;font-family:inherit;box-sizing:border-box;outline:none;" onfocus="this.style.borderColor='#f9a8d4'" onblur="this.style.borderColor='#e5e7eb'">
      </div>
      <div style="margin-bottom:20px;">
        <label style="font-size:0.82rem;color:#666;display:block;margin-bottom:6px;">รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</label>
        <input id="forgotPassword" type="password" placeholder="รหัสผ่านใหม่" style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:0.9rem;font-family:inherit;box-sizing:border-box;outline:none;" onfocus="this.style.borderColor='#f9a8d4'" onblur="this.style.borderColor='#e5e7eb'">
      </div>
      <div id="forgotMsg" style="font-size:0.82rem;text-align:center;margin-bottom:12px;min-height:18px;"></div>
      <button onclick="doForgot()" style="width:100%;padding:13px;background:linear-gradient(135deg,#f9a8d4,#c4b5fd);border:none;border-radius:12px;font-size:0.95rem;font-weight:700;color:#1a1a2e;cursor:pointer;">ตั้งรหัสผ่านใหม่</button>
      <p style="text-align:center;font-size:0.82rem;color:#888;margin-top:14px;"><a href="#" onclick="authTab('login');return false;" style="color:#ec4899;font-weight:600;text-decoration:none;">← กลับเข้าสู่ระบบ</a></p>
    </div>

    <div id="formRegister" style="display:none;">
      <div style="margin-bottom:14px;">
        <label style="font-size:0.82rem;color:#666;display:block;margin-bottom:6px;">ชื่อ-นามสกุล</label>
        <input id="regName" type="text" placeholder="ชื่อของคุณ" style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:0.9rem;font-family:inherit;box-sizing:border-box;outline:none;" onfocus="this.style.borderColor='#f9a8d4'" onblur="this.style.borderColor='#e5e7eb'">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:0.82rem;color:#666;display:block;margin-bottom:6px;">อีเมล</label>
        <input id="regEmail" type="email" placeholder="your@email.com" style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:0.9rem;font-family:inherit;box-sizing:border-box;outline:none;" onfocus="this.style.borderColor='#f9a8d4'" onblur="this.style.borderColor='#e5e7eb'">
      </div>
      <div style="margin-bottom:20px;">
        <label style="font-size:0.82rem;color:#666;display:block;margin-bottom:6px;">รหัสผ่าน (อย่างน้อย 6 ตัว)</label>
        <input id="regPassword" type="password" placeholder="รหัสผ่าน" style="width:100%;padding:11px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:0.9rem;font-family:inherit;box-sizing:border-box;outline:none;" onfocus="this.style.borderColor='#f9a8d4'" onblur="this.style.borderColor='#e5e7eb'" onkeydown="if(event.key==='Enter')doRegister()">
      </div>
      <div id="registerMsg" style="font-size:0.82rem;text-align:center;margin-bottom:12px;min-height:18px;"></div>
      <button onclick="doRegister()" style="width:100%;padding:13px;background:linear-gradient(135deg,#f9a8d4,#c4b5fd);border:none;border-radius:12px;font-size:0.95rem;font-weight:700;color:#1a1a2e;cursor:pointer;">สมัครสมาชิก</button>
      <p style="text-align:center;font-size:0.82rem;color:#888;margin-top:14px;">มีบัญชีอยู่แล้ว? <a href="#" onclick="authTab('login');return false;" style="color:#ec4899;font-weight:600;text-decoration:none;">เข้าสู่ระบบ</a></p>
    </div>
  </div>
</div>`;

  document.body.insertAdjacentHTML('beforeend', modalHTML + profileHTML);

  // ---- Navbar ----
  function updateNavAuth() {
    const user = getUser();
    const navLinks = document.querySelector('.nav-links');
    const mobileLinks = document.querySelector('.mobile-nav-links');
    document.querySelectorAll('.nav-auth-item').forEach(el => el.remove());

    if (user) {
      const initial = user.name[0].toUpperCase();
      if (navLinks) {
        const el = document.createElement('li');
        el.className = 'nav-auth-item';
        el.innerHTML = `<a href="#" onclick="authShowProfile();return false;" style="display:flex;align-items:center;gap:8px;font-weight:600;">
          <span style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#f9a8d4,#c4b5fd);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:#1a1a2e;">${initial}</span>
          <span style="font-size:0.85rem;">${user.name.split(' ')[0]}</span>
        </a>`;
        navLinks.appendChild(el);
      }
      if (mobileLinks) {
        const el = document.createElement('li');
        el.className = 'nav-auth-item';
        el.innerHTML = `<a href="#" onclick="authShowProfile();return false;">👤 ${user.name}</a>`;
        mobileLinks.appendChild(el);
      }
    } else {
      if (navLinks) {
        const el = document.createElement('li');
        el.className = 'nav-auth-item';
        el.innerHTML = `<a href="#" onclick="authOpen('login');return false;" style="font-weight:600;">เข้าสู่ระบบ</a>`;
        navLinks.appendChild(el);
      }
      if (mobileLinks) {
        const el = document.createElement('li');
        el.className = 'nav-auth-item';
        el.innerHTML = `<a href="#" onclick="authOpen('login');return false;">🔑 เข้าสู่ระบบ / สมัครสมาชิก</a>`;
        mobileLinks.appendChild(el);
      }
    }
  }

  // ---- Globals ----
  window.authOpen = function (tab) {
    authTab(tab || 'login');
    document.getElementById('authOverlay').style.display = 'flex';
    document.getElementById('authCloseBtn').style.display = 'block';
    document.getElementById('authRequiredNote').style.display = 'none';
    document.getElementById('loginMsg').textContent = '';
    document.getElementById('registerMsg').textContent = '';
  };

  window.authClose = function () {
    document.getElementById('authOverlay').style.display = 'none';
  };

  window.authTab = function (tab) {
    const isLogin = tab === 'login';
    const isForgot = tab === 'forgot';
    document.getElementById('formLogin').style.display = isLogin ? '' : 'none';
    document.getElementById('formRegister').style.display = tab === 'register' ? '' : 'none';
    document.getElementById('formForgot').style.display = isForgot ? '' : 'none';
    document.getElementById('tabLogin').style.cssText += isLogin ? ';background:white;color:#1a1a2e;box-shadow:0 2px 6px rgba(0,0,0,0.08)' : ';background:transparent;color:#888;box-shadow:none';
    document.getElementById('tabRegister').style.cssText += tab === 'register' ? ';background:white;color:#1a1a2e;box-shadow:0 2px 6px rgba(0,0,0,0.08)' : ';background:transparent;color:#888;box-shadow:none';
  };

  window.doLogin = function () {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');
    const user = getUsers().find(u => u.email === email && u.password === password);
    if (!user) { msg.style.color = '#e11d48'; msg.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'; return; }
    setUser({ name: user.name, email: user.email });
    document.getElementById('authOverlay').style.display = 'none';
    updateNavAuth();
  };

  window.doRegister = function () {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const msg = document.getElementById('registerMsg');
    if (!name) { msg.style.color = '#e11d48'; msg.textContent = 'กรุณาใส่ชื่อ'; return; }
    if (!email || !email.includes('@') || !email.includes('.')) { msg.style.color = '#e11d48'; msg.textContent = 'กรุณาใส่อีเมลที่ถูกต้อง'; return; }
    if (password.length < 6) { msg.style.color = '#e11d48'; msg.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'; return; }
    const users = getUsers();
    if (users.find(u => u.email === email)) { msg.style.color = '#e11d48'; msg.textContent = 'อีเมลนี้ถูกใช้งานแล้ว'; return; }
    users.push({ name, email, password });
    saveUsers(users);
    setUser({ name, email });
    document.getElementById('authOverlay').style.display = 'none';
    updateNavAuth();
  };

  window.authShowProfile = function () {
    const user = getUser();
    if (!user) return;
    const orders = getPurchaseHistory();
    const ordersHTML = orders.length === 0
      ? `<p style="color:#888;font-size:0.85rem;text-align:center;padding:20px 0;">ยังไม่มีประวัติการซื้อ</p>`
      : orders.map(o => `
        <div style="border:1px solid #f0f0f0;border-radius:12px;padding:14px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-size:0.78rem;color:#888;">${o.date}</span>
            <span style="font-weight:700;color:#ec4899;">฿${o.total.toLocaleString()}</span>
          </div>
          ${o.items.map(i => `<div style="font-size:0.85rem;color:#333;padding:2px 0;">• ${i.name}</div>`).join('')}
        </div>`).join('');

    document.getElementById('profileContent').innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;">
        <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#f9a8d4,#c4b5fd);display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:800;color:#1a1a2e;flex-shrink:0;">${user.name[0].toUpperCase()}</div>
        <div>
          <div style="font-weight:700;font-size:1.05rem;">${user.name}</div>
          <div style="font-size:0.82rem;color:#888;">${user.email}</div>
        </div>
      </div>
      <div style="border-top:1px solid #f0f0f0;padding-top:20px;margin-bottom:16px;">
        <div style="font-weight:700;font-size:0.95rem;margin-bottom:12px;">📦 ประวัติการซื้อ</div>
        ${ordersHTML}
      </div>
      <button onclick="authLogout()" style="width:100%;padding:11px;background:#f5f5f5;border:none;border-radius:10px;font-size:0.9rem;font-weight:600;color:#e11d48;cursor:pointer;">ออกจากระบบ</button>`;
    document.getElementById('profileOverlay').style.display = 'flex';
  };

  window.doForgot = function () {
    const email = document.getElementById('forgotEmail').value.trim();
    const password = document.getElementById('forgotPassword').value;
    const msg = document.getElementById('forgotMsg');
    if (!email || !email.includes('@') || !email.includes('.')) { msg.style.color = '#e11d48'; msg.textContent = 'กรุณาใส่อีเมลที่ถูกต้อง'; return; }
    if (password.length < 6) { msg.style.color = '#e11d48'; msg.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'; return; }
    const users = getUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx === -1) { msg.style.color = '#e11d48'; msg.textContent = 'ไม่พบอีเมลนี้ในระบบ'; return; }
    users[idx].password = password;
    saveUsers(users);
    msg.style.color = '#2E9962';
    msg.textContent = 'เปลี่ยนรหัสผ่านสำเร็จ!';
    setTimeout(() => authTab('login'), 1500);
  };

  window.authLogout = function () {
    clearUser();
    document.getElementById('profileOverlay').style.display = 'none';
    updateNavAuth();
  };

  // Prevent closing by overlay click
  document.getElementById('authOverlay').addEventListener('click', function (e) {
    if (e.target === this) authClose();
  });

  // Init
  updateNavAuth();
})();
