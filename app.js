// إعدادات المطور القابلة للتغيير
let DEV_EMAIL = "abdalqadr3518@gmail.com";
const DEV_PASSCODE = "ABDALQADR_DEVELOPER";

// قاعدة البيانات المحلية (محاكاة أو ربط بـ localStorage)
let db = JSON.parse(localStorage.getItem('nutricore_db')) || {
  users: [],
  plans: [],
  ratings: []
};

let currentUser = null;
let selectedRating = 0;

function saveDB() {
  localStorage.setItem('nutricore_db', JSON.stringify(db));
}

// التبديل بين الشاشات
function toggleAuthMode(mode) {
  document.getElementById('auth-page').classList.toggle('active', mode === 'login');
  document.getElementById('register-page').classList.toggle('active', mode === 'register');
}

// تسجيل حساب جديد
document.getElementById('register-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;

  if (db.users.find(u => u.username === username || u.email === email)) {
    alert("اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً!");
    return;
  }

  const newUser = {
    id: Date.now(),
    name,
    username,
    email,
    password,
    lastUsernameChange: null
  };

  db.users.push(newUser);
  saveDB();
  alert("تم إنشاء الحساب بنجاح! يرجى حفظ اليوزر الخاص بك: " + username);
  toggleAuthMode('login');
});

// تسجيل الدخول
document.getElementById('login-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const id = document.getElementById('login-id').value;
  const pass = document.getElementById('login-password').value;
  const remember = document.getElementById('remember-me').checked;

  // التحقق من وضع المطور
  if (id === DEV_EMAIL) {
    const devCode = prompt("أدخل كلمة المرور السرية الخاصة بالمطور:");
    if (devCode !== DEV_PASSCODE) {
      alert("كلمة المرور السرية خاطئة!");
      return;
    }
    currentUser = { name: "المطور", email: DEV_EMAIL, isDev: true };
  } else {
    const user = db.users.find(u => (u.email === id || u.username === id) && u.password === pass);
    if (!user) {
      alert("بيانات الدخول غير صحيحة!");
      return;
    }
    currentUser = user;
  }

  if (remember) {
    localStorage.setItem('remembered_user', JSON.stringify(currentUser));
  }

  initDashboard();
});

// إعداد لوحة التحكم
function initDashboard() {
  document.getElementById('auth-page').classList.remove('active');
  document.getElementById('main-nav').style.display = 'flex';
  
  if (currentUser.isDev) {
    document.getElementById('plans-nav-btn').innerText = "خطط العملاء";
    document.getElementById('plans-title').innerText = "إدارة خطط العملاء";
    document.getElementById('dev-plan-create').style.display = 'block';
    document.getElementById('developer-panel').style.display = 'block';
    renderDevUserList();
  } else {
    document.getElementById('plans-nav-btn').innerText = "خطتي";
    document.getElementById('plans-title').innerText = "الخطط الخاصة بي";
    document.getElementById('dev-plan-create').style.display = 'none';
    document.getElementById('developer-panel').style.display = 'none';
  }

  loadStats();
  renderPlans();
  switchTab('home-tab', document.querySelector('.nav-item'));
}

// التبديل بين التبويبات
function switchTab(tabId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  if(btn) btn.classList.add('active');

  if(tabId === 'profile-tab' && !currentUser.isDev) {
    document.getElementById('prof-name').value = currentUser.name;
    document.getElementById('prof-username').value = currentUser.username;
  }
}

// إحصائيات التطبيق
function loadStats() {
  document.getElementById('stat-users').innerText = db.users.length;
  document.getElementById('stat-plans').innerText = db.plans.length;
  
  const avg = db.ratings.length ? (db.ratings.reduce((a,b)=>a+b, 0)/db.ratings.length).toFixed(1) : "0.0";
  document.getElementById('stat-rating').innerText = `${avg} ★`;
}

// تقييم التطبيق
function setRating(val) {
  selectedRating = val;
  const stars = document.querySelectorAll('.star');
  stars.forEach((s, i) => {
    s.classList.toggle('active', i < val);
  });
}

function submitRating() {
  if(selectedRating === 0) return alert("يرجى اختيار التقييم بالنجوم أولاً");
  db.ratings.push(selectedRating);
  saveDB();
  loadStats();
  alert("شكراً لتقييمك!");
}

// إنشاء خطة (للمطور)
function createPlan() {
  const targetUser = document.getElementById('plan-target-user').value;
  const content = document.getElementById('plan-content').value;

  if(!db.users.find(u => u.username === targetUser)) {
    return alert("المستخدم غير موجود!");
  }

  db.plans.push({ id: Date.now(), username: targetUser, content, date: new Date().toLocaleDateString('ar-EG') });
  saveDB();
  alert("تم إضافة الخطة بنجاح!");
  renderPlans();
}

// عرض الخطط
function renderPlans() {
  const container = document.getElementById('plans-container');
  container.innerHTML = '';

  const userPlans = currentUser.isDev ? db.plans : db.plans.filter(p => p.username === currentUser.username);

  userPlans.forEach(p => {
    container.innerHTML += `
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
        <p><strong>المستخدم:</strong> ${p.username}</p>
        <p style="margin: 8px 0;">${p.content}</p>
        <button class="btn-secondary" onclick="exportPDF('${p.content}')">تصدير ملف الخطة (PDF)</button>
      </div>
    `;
  });
}

// تصدير الخطة PDF
function exportPDF(content) {
  const win = window.open('', '', 'height=500,width=800');
  win.document.write(`<html><head><title>خطة تغذية</title></head><body dir="rtl" style="font-family:sans-serif; padding:20px;"><h2>الخطة الغذائية - أحمد الهوى</h2><p>${content}</p></body></html>`);
  win.document.close();
  win.print();
}

// قيود تعديل اليوزرنيم (مرة أسبوعياً)
function updateProfile() {
  const newName = document.getElementById('prof-name').value;
  const newUsername = document.getElementById('prof-username').value;

  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  if (newUsername !== currentUser.username) {
    if (currentUser.lastUsernameChange && (now - currentUser.lastUsernameChange < oneWeek)) {
      alert("لن تتمكن من تغيير اليوزر إلا مرة واحدة في الأسبوع!");
      return;
    }
    currentUser.username = newUsername;
    currentUser.lastUsernameChange = now;
  }

  currentUser.name = newName;
  const idx = db.users.findIndex(u => u.id === currentUser.id);
  if(idx !== -1) db.users[idx] = currentUser;
  
  saveDB();
  alert("تم تحديث بيانات البروفايل بنجاح!");
}

// عرض سجل الأعضاء للمطور وحذفهم
function renderDevUserList() {
  const list = document.getElementById('users-list');
  list.innerHTML = '';
  db.users.forEach(u => {
    list.innerHTML += `
      <div style="display:flex; justify-content:space-between; background:rgba(0,0,0,0.2); padding:8px; margin-bottom:5px; border-radius:6px; font-size:0.8rem;">
        <span>${u.username} (${u.email}) - كلمة السر: ${u.password}</span>
        <button onclick="deleteUserByDev(${u.id})" style="color:red; background:none; border:none; cursor:pointer;">حذف</button>
      </div>
    `;
  });
}

function deleteUserByDev(id) {
  if(confirm("هل أنت تأكد من حذف هذا الحساب؟")) {
    db.users = db.users.filter(u => u.id !== id);
    saveDB();
    renderDevUserList();
    loadStats();
  }
}

// تسجيل الخروج
function logout() {
  localStorage.removeItem('remembered_user');
  location.reload();
}

// الفحص الآلي لخيار "تذكرني" عند فتح التطبيق
window.onload = function() {
  const rem = localStorage.getItem('remembered_user');
  if (rem) {
    currentUser = JSON.parse(rem);
    initDashboard();
  }
};
