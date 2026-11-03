(() => {
'use strict';
const C = window.NUTRICORE_CONFIG, G = C.GITHUB;
const app = document.getElementById('app');
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const enc = new TextEncoder(), DAY = 864e5;
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('');
const rnd = (n = 16) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };
const hashPw = (salt, pw) => sha(salt + ':' + pw);
const isDevEmail = e => (e || '').toLowerCase() === C.DEVELOPER_EMAIL.toLowerCase();
const fmt = t => new Date(t).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });

/* ---------- Toast & Modal ---------- */
let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 3200); }
function modal({ title, body = '', actions = [] }) {
  return new Promise(res => {
    const o = document.createElement('div'); o.className = 'overlay';
    o.innerHTML = `<div class="modal glass"><h3>${title}</h3><div class="mbody">${body}</div><div class="mact"></div></div>`;
    actions.forEach(a => {
      const b = document.createElement('button'); b.className = 'btn small ' + (a.cls || 'primary'); b.textContent = a.label;
      b.onclick = async () => { b.disabled = true; try { const r = await a.fn?.(o); if (r !== false) { o.remove(); res(r ?? null); return; } } catch (e) { toast(e.message); } b.disabled = false; };
      $('.mact', o).append(b);
    });
    document.body.append(o); o.querySelector('input,textarea')?.focus();
  });
}
const confirmBox = (title, text, label = 'تأكيد', cls = 'danger') => modal({ title, body: `<p>${text}</p>`, actions: [{ label: 'إلغاء', cls: 'ghost', fn: () => null }, { label, cls, fn: () => true }] });
async function run(btn, fn) { if (btn) btn.disabled = true; try { await fn(); } catch (e) { toast(e.message || 'حدث خطأ'); } if (btn) btn.disabled = false; }

/* ---------- Storage (GitHub JSON file أو تخزين محلي تجريبي) ---------- */
const useGH = !!(G.owner && G.repo && G.token);
let DB = { users: [], plans: [], foods: [], ratings: {} }, SHA = null;
const api = `https://api.github.com/repos/${G.owner}/${G.repo}/contents/${G.path}`;
const hdr = { Authorization: `Bearer ${G.token}`, Accept: 'application/vnd.github+json' };
const norm = () => { DB.users ||= []; DB.plans ||= []; DB.foods ||= []; DB.ratings ||= {}; };
async function load() {
  if (!useGH) { const t = localStorage.getItem('nc_db'); if (t) DB = JSON.parse(t); return norm(); }
  const r = await fetch(`${api}?ref=${G.branch}&t=${Date.now()}`, { headers: hdr });
  if (r.status === 404) { SHA = null; return; }
  if (!r.ok) throw new Error('تعذّر الاتصال بالمخزن (' + r.status + ')');
  const j = await r.json(); SHA = j.sha;
  DB = JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g, ''))))); norm();
}
async function mutate(fn) {           // قراءة ← تعديل ← حفظ (مع إعادة المحاولة عند التعارض)
  for (let i = 0; i < 3; i++) {
    await load(); const res = fn(DB);
    if (!useGH) { localStorage.setItem('nc_db', JSON.stringify(DB)); return res; }
    const body = { message: 'NutriCore data update', branch: G.branch, content: btoa(unescape(encodeURIComponent(JSON.stringify(DB)))) };
    if (SHA) body.sha = SHA;
    const r = await fetch(api, { method: 'PUT', headers: { ...hdr, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) { SHA = (await r.json()).content.sha; return res; }
    if (r.status !== 409 && r.status !== 422) throw new Error('تعذّر الحفظ (' + r.status + ')');
  }
  throw new Error('تعذّر الحفظ، حاول مرة أخرى');
}

/* ---------- State & session ---------- */
let me = null, isDev = false, tab = 'home', pend = null, editPlan = null;
const commit = async fn => { const r = await mutate(fn); me = DB.users.find(u => u.id === me?.id) || null; return r; };
const store = () => localStorage.getItem('nc_s') ? localStorage : sessionStorage;
const curTok = () => { try { return JSON.parse(localStorage.getItem('nc_s') || sessionStorage.getItem('nc_s')).t; } catch { return null; } };
const clearSession = () => { localStorage.removeItem('nc_s'); sessionStorage.removeItem('nc_s'); };
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem('nc_s') || sessionStorage.getItem('nc_s') || 'null'); if (!s) return false;
    const u = DB.users.find(x => x.id === s.uid), ss = u?.sessions?.find(x => x.t === s.t);
    if (!ss) { clearSession(); return false; }
    me = u; isDev = !!ss.dev && isDevEmail(u.email); return true;
  } catch { clearSession(); return false; }
}
const askDevCode = () => modal({ title: '🔐 وضع المطور', body: '<p>أدخل الكلمة السرية للدخول كمطور.</p><input id="dc" class="inp" type="password" dir="ltr" autocomplete="off">',
  actions: [{ label: 'إلغاء', cls: 'ghost', fn: () => null }, { label: 'دخول', fn: o => $('#dc', o).value || false }] });

async function doLogin(id, pw, remember) {
  await load();
  const k = id.trim().toLowerCase();
  if (!k || !pw) throw new Error('أدخل البريد/اليوزر وكلمة المرور');
  const u = DB.users.find(x => x.email === k || x.username === k);
  if (!u || await hashPw(u.salt, pw) !== u.hash) throw new Error('بيانات الدخول غير صحيحة');
  let dev = false;
  if (isDevEmail(u.email)) {
    const code = await askDevCode(); if (!code) return;
    if (await sha(C.DEV_SALT + code) !== C.DEVELOPER_CODE_HASH) throw new Error('الكلمة السرية غير صحيحة');
    dev = true;
  }
  const t = rnd(24);
  await mutate(d => { const x = d.users.find(y => y.id === u.id); if (!x) throw new Error('الحساب غير موجود'); x.sessions = (x.sessions || []).slice(-4); x.sessions.push({ t, dev, ts: Date.now() }); });
  clearSession(); (remember ? localStorage : sessionStorage).setItem('nc_s', JSON.stringify({ uid: u.id, t }));
  me = DB.users.find(y => y.id === u.id); isDev = dev; tab = 'home'; viewApp();
}
async function logout() {
  const t = curTok();
  if (me && t) { try { await commit(d => { const x = d.users.find(y => y.id === me.id); if (x) x.sessions = (x.sessions || []).filter(s => s.t !== t); }); } catch {} }
  clearSession(); me = null; isDev = false; viewLogin();
}

/* ---------- Login / Signup views ---------- */
function viewLogin() {
  app.innerHTML = `<div class="screen"><div class="card glass">
    <div class="logo">NutriCore</div><div class="welcome">Welcome :</div>
    <label class="lbl">Email address</label><input id="lid" class="inp" dir="rtl" autocomplete="username" placeholder="ضع البريد الإلكتروني أو اليوزر">
    <label class="lbl">Password</label><input id="lpw" class="inp" type="password" dir="rtl" autocomplete="current-password" placeholder="ضع كلمة المرور">
    <div class="row2"><a class="forget" target="_blank" rel="noopener" href="${C.WHATSAPP_URL}?text=${encodeURIComponent('مرحباً، نسيت كلمة المرور في تطبيق NutriCore')}">Forget Password ?</a>
      <div class="rem" id="rem" data-act="rem"><span>تذكرني</span><i class="dot"></i></div></div>
    <button class="btn primary" data-act="login">تسجيل دخول</button>
    <div class="or">or</div><button class="btn neon" data-act="toSignup">إنشاء حساب جديد</button>
    ${useGH ? '' : '<p class="demo">⚠️ وضع تجريبي: لم يُضبط GitHub في config.js، البيانات محفوظة على هذا الجهاز فقط.</p>'}
  </div></div>`;
  app.querySelectorAll('.inp').forEach(i => i.onkeydown = e => e.key === 'Enter' && $('[data-act=login]').click());
}
function viewSignup() {
  app.innerHTML = `<div class="screen"><div class="card glass">
    <div class="logo">NutriCore</div><div class="welcome" style="font-size:26px;margin:18px 0 8px">حساب جديد</div>
    <label class="lbl">Full name</label><input id="sn" class="inp" dir="rtl" placeholder="الاسم الكامل">
    <label class="lbl">Email address</label><input id="se" class="inp" type="email" dir="ltr" placeholder="name@example.com">
    <label class="lbl">Username</label><input id="su" class="inp" dir="ltr" value="user${Math.floor(1000 + Math.random() * 9000)}" autocapitalize="none">
    <div class="hint">حروف إنجليزية صغيرة وأرقام و _ فقط (3–20). سيساعدك في تسجيل الدخول بدل البريد.</div>
    <label class="lbl">Password</label><input id="sp" class="inp" type="password" dir="rtl" placeholder="6 أحرف على الأقل">
    <label class="lbl">Confirm password</label><input id="sp2" class="inp" type="password" dir="rtl" placeholder="أعد كتابة كلمة المرور">
    <button class="btn primary" style="margin-top:20px" data-act="signup">إنشاء الحساب</button>
    <button class="link" data-act="toLogin">لديك حساب؟ تسجيل الدخول</button>
  </div></div>`;
}
async function signup() {
  const name = $('#sn').value.trim(), email = $('#se').value.trim().toLowerCase(), un = $('#su').value.trim().toLowerCase(), pw = $('#sp').value;
  if (name.length < 2) throw new Error('أدخل اسمك');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('بريد إلكتروني غير صالح');
  if (!/^[a-z0-9_]{3,20}$/.test(un)) throw new Error('اليوزر: حروف إنجليزية صغيرة وأرقام و _ (3–20)');
  if (pw.length < 6) throw new Error('كلمة المرور 6 أحرف على الأقل');
  if (pw !== $('#sp2').value) throw new Error('كلمتا المرور غير متطابقتين');
  const salt = rnd(8), hash = await hashPw(salt, pw);
  await mutate(d => {
    if (d.users.some(u => u.email === email)) throw new Error('هذا البريد مسجل مسبقاً');
    if (d.users.some(u => u.username === un)) throw new Error('اليوزر محجوز، اختر غيره');
    d.users.push({ id: rnd(8), name, email, username: un, salt, hash, avatar: '', created: Date.now(), usernameChangedAt: 0, sessions: [] });
  });
  await modal({ title: '⚠️ احفظ اليوزر الخاص بك', body: `<p>هذا هو اسم المستخدم الخاص بك، احفظه جيداً ولا تنسه، فهو يساعدك في تسجيل الدخول بدلاً من البريد الإلكتروني:</p><div class="uname">${esc(un)}</div>`, actions: [{ label: 'فهمت، لقد حفظته', fn: () => true }] });
  await doLogin(email, pw, false);
}

/* ---------- App shell ---------- */
function viewApp() {
  const tabs = [['home', '🏠', 'الرئيسية'], ['plans', '📋', isDev ? 'خطط العملاء' : 'خطتي'], ['free', '📚', 'خطط مجانية'], ['me', '👤', 'حسابي']];
  app.innerHTML = `<div class="shell"><header class="top"><span class="logo sm">NutriCore</span>${isDev ? '<span class="badge">وضع المطور</span>' : ''}</header>
    <main id="main"></main><nav class="nav">${tabs.map(t => `<button data-act="tab" data-t="${t[0]}"><span>${t[1]}</span>${t[2]}</button>`).join('')}</nav></div>`;
  renderTab();
}
function renderTab() {
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  $('#main').innerHTML = { home: tHome, plans: isDev ? tDevPlans : tMyPlans, free: tFree, me: tAccount }[tab]();
  scrollTo(0, 0);
}
const ratingVals = () => Object.values(DB.ratings).map(Number).filter(n => n >= 1 && n <= 5);

function tHome() {
  const rv = ratingVals(), avg = rv.length ? (rv.reduce((a, b) => a + b, 0) / rv.length).toFixed(1) : '—';
  const mine = pend ?? DB.ratings[me.id] ?? 0;
  return `<div class="box glass stats">
      <div class="stat"><b>${DB.users.length}</b><small>المستخدمون</small></div>
      <div class="stat"><b>${DB.plans.length}</b><small>الخطط الغذائية</small></div>
      <div class="stat"><b>${DB.foods.length}</b><small>الأطعمة</small></div>
      <div class="stat"><b>${avg}${rv.length ? '<span style="color:#ffc928;font-size:16px">★</span>' : ''}</b><small>التقييم</small></div></div>
    <div class="box glass center"><div class="rate"><b>قــيّــم الـتـطـبـيـق</b>
      <div class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="star ${n <= mine ? 'on' : ''}" data-act="star" data-n="${n}">★</button>`).join('')}</div></div>
      <button class="btn primary small" style="margin-top:12px;width:120px" data-act="rateDone">تم</button></div>
    ${isDev ? members() : ''}
    <div class="copy">${esc(C.COPYRIGHT)}</div>`;
}
function members() {
  return `<h2>👥 سجل الأعضاء (${DB.users.length})</h2>` + (DB.users.map(u => `<div class="item glass"><div class="grow">
    <div class="t">${esc(u.name)} ${isDevEmail(u.email) ? '👑' : ''}</div><div class="s">${esc(u.email)}</div><div class="s">@${esc(u.username)} · 🔒 كلمة المرور مشفّرة</div></div>
    <div class="acts"><button class="btn small ghost" data-act="editUser" data-id="${u.id}">تعديل</button>
    <button class="btn small danger" data-act="delUser" data-id="${u.id}">حذف</button></div></div>`).join('') || '<p class="mut">لا يوجد أعضاء.</p>')
    + `<p class="hint">لمساعدة عضو نسي كلمة المرور: اضغط "تعديل" وعيّن له كلمة جديدة ثم أرسلها له عبر واتساب.</p>`;
}

/* ---------- Plans ---------- */
function tDevPlans() {
  const p = editPlan && DB.plans.find(x => x.id === editPlan), owner = p && DB.users.find(u => u.id === p.userId);
  return `<h2>${p ? '✏️ تعديل خطة' : '➕ إنشاء خطة لعميل'}</h2><div class="box glass">
    <div class="field"><input id="pu" class="inp" dir="ltr" list="ul" placeholder="يوزر العميل" value="${esc(owner?.username || '')}">
      <datalist id="ul">${DB.users.map(u => `<option value="${esc(u.username)}">${esc(u.name)}</option>`).join('')}</datalist></div>
    <div class="field"><input id="pt" class="inp" placeholder="عنوان الخطة" value="${esc(p?.title || '')}"></div>
    <div class="field"><textarea id="pb" class="inp" placeholder="محتوى الخطة (الوجبات، التمارين، الملاحظات...)">${esc(p?.body || '')}</textarea></div>
    <div class="acts"><button class="btn primary small" data-act="savePlan">${p ? 'حفظ التعديلات' : 'إرسال الخطة للعميل'}</button>
    ${p ? '<button class="btn ghost small" data-act="cancelEdit">إلغاء</button>' : ''}</div></div>
    <h2>📂 كل الخطط (${DB.plans.length})</h2>` + (DB.plans.slice().sort((a, b) => b.updated - a.updated).map(x => {
      const o = DB.users.find(u => u.id === x.userId);
      return `<div class="box glass"><div class="t"><b>${esc(x.title)}</b></div><div class="s mut">للعميل: ${esc(o?.name || 'محذوف')} (@${esc(o?.username || '-')}) · ${fmt(x.updated)}</div>
      <div class="pbody">${esc(x.body)}</div><div class="acts"><button class="btn small ghost" data-act="editPlan" data-id="${x.id}">تعديل</button>
      <button class="btn small danger" data-act="delPlan" data-id="${x.id}">حذف</button></div></div>`;
    }).join('') || '<p class="mut">لم تُنشأ أي خطط بعد.</p>');
}
function tMyPlans() {
  const ps = DB.plans.filter(p => p.userId === me.id).sort((a, b) => b.updated - a.updated);
  return `<h2>📋 خطتي</h2>` + (ps.map(p => `<div class="box glass"><b>${esc(p.title)}</b><div class="s mut">${fmt(p.updated)}</div>
    <div class="pbody">${esc(p.body)}</div><button class="btn primary small" data-act="exportPlan" data-id="${p.id}">تصدير ملف الخطة</button></div>`).join('')
    || `<div class="box glass center"><p>لا توجد خطة لك حتى الآن.</p><a class="btn neon small" style="text-decoration:none;display:inline-block" target="_blank" rel="noopener" href="${C.WHATSAPP_URL}?text=${encodeURIComponent('مرحباً، أرغب بخطة غذائية/لياقية. اليوزر: ' + me.username)}">اطلب خطتك عبر واتساب</a></div>`);
}
function exportPlan(p) {
  const w = window.open('', '_blank'); if (!w) throw new Error('اسمح بالنوافذ المنبثقة ثم أعد المحاولة');
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(p.title)}</title>
  <style>body{font-family:Tahoma,Arial,sans-serif;padding:36px;line-height:1.9;color:#111}h1{color:#5b1fb8;margin:0}h2{margin:18px 0 4px}.m{color:#666;font-size:14px}pre{white-space:pre-wrap;font:inherit;font-size:16px}footer{margin-top:40px;border-top:1px solid #ccc;padding-top:10px;color:#777;font-size:13px;text-align:center}</style></head>
  <body><h1>NutriCore</h1><h2>${esc(p.title)}</h2><div class="m">${esc(me.name)} · ${fmt(p.updated)}</div><hr><pre>${esc(p.body)}</pre><footer>${esc(C.COPYRIGHT)}</footer>
  <script>onload=()=>setTimeout(()=>print(),400)<\/script></body></html>`); w.document.close();
  toast('اختر "حفظ كملف PDF" من نافذة الطباعة');
}

/* ---------- Free plans ---------- */
function tFree() {
  return `<h2>📚 خطط مجانية</h2>` + C.FREE_PLANS.map(f => `<div class="box glass"><div style="font-size:30px">📄</div><b>${esc(f.title)}</b>
    <div class="acts" style="margin-top:10px"><a class="btn primary small" style="text-decoration:none" target="_blank" rel="noopener" href="pdfs/${encodeURIComponent(f.file)}">عرض</a>
    <a class="btn ghost small" style="text-decoration:none" download href="pdfs/${encodeURIComponent(f.file)}">تحميل</a></div></div>`).join('');
}

/* ---------- Account ---------- */
function tAccount() {
  return `<div class="box glass center"><div class="avatar" data-act="pickAvatar">${me.avatar ? `<img src="${me.avatar}" alt="">` : esc(me.name.charAt(0))}</div>
    <input id="avIn" type="file" accept="image/*" hidden><button class="link" style="margin:0 auto 8px;font-size:14px" data-act="pickAvatar">تغيير الصورة الشخصية</button>
    <h3 style="margin:4px 0">${esc(me.name)}</h3><div class="mut" dir="ltr">@${esc(me.username)}</div><div class="mut" dir="ltr" style="font-size:14px">${esc(me.email)}</div></div>
    <div class="box glass"><div class="acts" style="flex-direction:column;align-items:stretch">
      <button class="btn ghost small" data-act="chName">✏️ تغيير الاسم</button><button class="btn ghost small" data-act="chUser">🆔 تغيير اليوزر</button>
      <button class="btn ghost small" data-act="chPw">🔑 تغيير كلمة المرور</button>
      <a class="btn ghost small" style="text-decoration:none;text-align:center" target="_blank" rel="noopener" href="${C.WHATSAPP_URL}">💬 تواصل مع المطور (واتساب)</a>
      <button class="btn ghost small" data-act="logout">🚪 تسجيل الخروج</button><button class="btn danger small" data-act="delMe">🗑️ حذف الحساب نهائياً</button></div></div>`;
}
const field = (id, ph, type = 'text', v = '') => `<div class="field"><input id="${id}" class="inp" type="${type}" placeholder="${ph}" value="${esc(v)}"></div>`;
const verifyPw = async pw => { if (await hashPw(me.salt, pw) !== me.hash) throw new Error('كلمة المرور الحالية غير صحيحة'); };

async function setAvatar(file) {
  if (!file) return;
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('صورة غير صالحة')); i.src = URL.createObjectURL(file); });
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s; const x = c.getContext('2d'), m = Math.min(img.width, img.height);
  x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
  const data = c.toDataURL('image/jpeg', .8);
  await commit(d => { d.users.find(u => u.id === me.id).avatar = data; }); renderTab(); toast('تم تحديث الصورة');
}

/* ---------- Actions ---------- */
const A = {
  rem: () => $('#rem').classList.toggle('on'),
  login: b => run(b, () => doLogin($('#lid').value, $('#lpw').value, $('#rem').classList.contains('on'))),
  toSignup: viewSignup, toLogin: viewLogin, signup: b => run(b, signup),
  tab: b => { tab = b.dataset.t; renderTab(); },
  logout: b => run(b, logout),
  star: b => { pend = +b.dataset.n; renderTab(); },
  rateDone: b => run(b, async () => {
    const n = pend ?? DB.ratings[me.id]; if (!n) throw new Error('اختر عدد النجوم أولاً');
    await commit(d => { d.ratings[me.id] = n; }); pend = null; renderTab(); toast('شكراً لتقييمك ⭐');
  }),
  editUser: b => { const u = DB.users.find(x => x.id === b.dataset.id); modal({ title: 'تعديل العضو', body: `<p class="mut">${esc(u.name)} — ${esc(u.email)}</p>${field('eu', 'اليوزر', 'text', u.username)}${field('ep', 'كلمة مرور جديدة (اتركها فارغة لعدم التغيير)')}`,
    actions: [{ label: 'إلغاء', cls: 'ghost', fn: () => null }, { label: 'حفظ', fn: async o => {
      const un = $('#eu', o).value.trim().toLowerCase(), pw = $('#ep', o).value;
      if (!/^[a-z0-9_]{3,20}$/.test(un)) throw new Error('يوزر غير صالح');
      if (pw && pw.length < 6) throw new Error('كلمة المرور 6 أحرف على الأقل');
      const salt = rnd(8), hash = pw ? await hashPw(salt, pw) : null;
      await commit(d => { const x = d.users.find(y => y.id === u.id); if (!x) throw new Error('العضو غير موجود');
        if (d.users.some(y => y.username === un && y.id !== u.id)) throw new Error('اليوزر محجوز');
        x.username = un; if (hash) { x.salt = salt; x.hash = hash; x.sessions = []; } });
      renderTab(); toast('تم التحديث'); } }] }); },
  delUser: async b => { const u = DB.users.find(x => x.id === b.dataset.id);
    if (!await confirmBox('حذف الحساب', `سيتم حذف حساب «${esc(u.name)}» وكل خططه نهائياً.`, 'حذف')) return;
    await run(b, async () => { await commit(d => { d.users = d.users.filter(x => x.id !== u.id); d.plans = d.plans.filter(p => p.userId !== u.id); delete d.ratings[u.id]; }); renderTab(); toast('تم الحذف'); }); },
  savePlan: b => run(b, async () => {
    const un = $('#pu').value.trim().toLowerCase(), title = $('#pt').value.trim(), body = $('#pb').value.trim();
    if (!un || !title || !body) throw new Error('املأ اليوزر والعنوان والمحتوى');
    await commit(d => { const u = d.users.find(x => x.username === un); if (!u) throw new Error('لا يوجد مستخدم بهذا اليوزر');
      const p = editPlan && d.plans.find(x => x.id === editPlan);
      if (p) Object.assign(p, { userId: u.id, title, body, updated: Date.now() }); else d.plans.push({ id: rnd(8), userId: u.id, title, body, created: Date.now(), updated: Date.now() }); });
    editPlan = null; renderTab(); toast('تم حفظ الخطة ✅'); }),
  editPlan: b => { editPlan = b.dataset.id; renderTab(); },
  cancelEdit: () => { editPlan = null; renderTab(); },
  delPlan: async b => { if (!await confirmBox('حذف الخطة', 'هل تريد حذف هذه الخطة؟', 'حذف')) return;
    await run(b, async () => { await commit(d => { d.plans = d.plans.filter(p => p.id !== b.dataset.id); }); renderTab(); }); },
  exportPlan: b => run(null, async () => exportPlan(DB.plans.find(p => p.id === b.dataset.id))),
  pickAvatar: () => $('#avIn').click(),
  chName: () => modal({ title: 'تغيير الاسم', body: field('nn', 'الاسم الجديد', 'text', me.name), actions: [{ label: 'إلغاء', cls: 'ghost', fn: () => null }, { label: 'حفظ', fn: async o => {
    const n = $('#nn', o).value.trim(); if (n.length < 2) throw new Error('اسم غير صالح');
    await commit(d => { d.users.find(u => u.id === me.id).name = n; }); renderTab(); toast('تم تغيير الاسم'); } }] }),
  chUser: async () => {
    const left = me.usernameChangedAt ? me.usernameChangedAt + 7 * DAY - Date.now() : 0;
    if (left > 0) return toast(`لا يمكنك تغيير اليوزر الآن، متبقي ${Math.ceil(left / DAY)} يوم`);
    modal({ title: 'تغيير اليوزر', body: `<p>⚠️ لن تتمكن من تغيير اليوزر إلا مرة في الأسبوع.</p>${field('nu', 'اليوزر الجديد', 'text', me.username).replace('class="inp"', 'class="inp" dir="ltr"')}`,
      actions: [{ label: 'إلغاء', cls: 'ghost', fn: () => null }, { label: 'تغيير', fn: async o => {
        const un = $('#nu', o).value.trim().toLowerCase(); if (un === me.username) return null;
        if (!/^[a-z0-9_]{3,20}$/.test(un)) throw new Error('حروف إنجليزية صغيرة وأرقام و _ (3–20)');
        await commit(d => { if (d.users.some(u => u.username === un)) throw new Error('اليوزر محجوز');
          const x = d.users.find(u => u.id === me.id); if (x.usernameChangedAt && Date.now() - x.usernameChangedAt < 7 * DAY) throw new Error('لم يمض أسبوع على آخر تغيير');
          x.username = un; x.usernameChangedAt = Date.now(); });
        renderTab(); toast('تم تغيير اليوزر — احفظه جيداً'); } }] }); },
  chPw: () => modal({ title: 'تغيير كلمة المرور', body: field('p0', 'كلمة المرور الحالية', 'password') + field('p1', 'كلمة المرور الجديدة', 'password') + field('p2', 'تأكيد الجديدة', 'password'),
    actions: [{ label: 'إلغاء', cls: 'ghost', fn: () => null }, { label: 'تغيير', fn: async o => {
      await verifyPw($('#p0', o).value); const n = $('#p1', o).value;
      if (n.length < 6) throw new Error('كلمة المرور 6 أحرف على الأقل'); if (n !== $('#p2', o).value) throw new Error('كلمتا المرور غير متطابقتين');
      const salt = rnd(8), hash = await hashPw(salt, n), t = curTok();
      await commit(d => { const x = d.users.find(u => u.id === me.id); x.salt = salt; x.hash = hash; x.sessions = (x.sessions || []).filter(s => s.t === t); });
      toast('تم تغيير كلمة المرور ✅'); } }] }),
  delMe: () => modal({ title: '🗑️ حذف الحساب', body: '<p>سيتم حذف حسابك وخططك نهائياً ولا يمكن التراجع. اكتب كلمة مرورك للتأكيد.</p>' + field('dp', 'كلمة المرور', 'password'),
    actions: [{ label: 'إلغاء', cls: 'ghost', fn: () => null }, { label: 'حذف نهائي', cls: 'danger', fn: async o => {
      await verifyPw($('#dp', o).value); const id = me.id;
      await mutate(d => { d.users = d.users.filter(u => u.id !== id); d.plans = d.plans.filter(p => p.userId !== id); delete d.ratings[id]; });
      clearSession(); me = null; isDev = false; viewLogin(); toast('تم حذف الحساب'); } }] })
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && A[b.dataset.act]) A[b.dataset.act](b); });
document.addEventListener('change', e => { if (e.target.id === 'avIn') run(null, () => setAvatar(e.target.files[0])); });

/* ---------- Init ---------- */
(async () => {
  app.innerHTML = '<div class="loading"><div class="logo">NutriCore</div></div>';
  try { await load(); } catch (e) { toast(e.message); }
  if (restore()) viewApp(); else viewLogin();
})();
})();
