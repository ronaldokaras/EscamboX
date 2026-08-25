// Autenticação e sessão
function openAuth(tab) {
    switchAuthTab(tab || 'login');
    document.getElementById('liEmail').value = '';
    document.getElementById('liPass').value = '';
    setAlert('logAlert',''); setAlert('regAlert','');
    openModal('authModal');
}

function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('formLogin').classList.toggle('hidden', !isLogin);
    document.getElementById('formReg').classList.toggle('hidden', isLogin);
    document.getElementById('tabLogin').classList.toggle('active', isLogin);
    document.getElementById('tabReg').classList.toggle('active', !isLogin);
}

function setAlert(id, msg, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'alert' + (msg ? ' ' + (cls || 'error') : '');
    el.textContent = msg;
}

async function doLogin(ev) {
    ev.preventDefault();
    const email = norm(document.getElementById('liEmail').value);
    const pw = document.getElementById('liPass').value;
    const user = DB.users.find(u => norm(u.email) === email);
    if (!user || user.passHash !== await hashPassword(pw)) {
        setAlert('logAlert','E-mail ou senha incorretos.');
        return;
    }
    user.stats.logins++;
    user.lastLoginDate = todayStr();
    currentUser = user;
    localStorage.setItem(KEYS.session, String(user.id));
    save();
    closeModal('authModal');
    afterLoginUI();
    renderAll();
    showToast('Bem-vindo(a), ' + user.name.split(' ')[0] + '!', 'success');
}

async function doRegister(ev) {
    ev.preventDefault();
    const name = document.getElementById('rgName').value.trim();
    const email = norm(document.getElementById('rgEmail').value);
    const pw = document.getElementById('rgPass').value;
    if (name.length < 2) { setAlert('regAlert','Informe seu nome.'); return; }
    if (pw.length < 4) { setAlert('regAlert','Senha muito curta.'); return; }
    if (DB.users.some(u => norm(u.email) === email)) {
        setAlert('regAlert','E-mail já cadastrado.');
        return;
    }
    const now = Date.now();
    const user = {
        id: nextId(), name, email, passHash: await hashPassword(pw),
        role:'user', coins: 0, createdAt: now,
        favs:[], notifications:[], claimed:{}, lastLoginDate: todayStr(),
        stats:{ logins:1, sales:0, barters:0, itemsPublished:0, ratingsReceived:0 }, ratings:[]
    };
    changeCoins(user, 20, 'Bônus de boas-vindas');
    DB.users.push(user);
    notify(user.id, 'Conta criada! Você ganhou 20 moedas.');
    currentUser = user;
    localStorage.setItem(KEYS.session, String(user.id));
    save();
    closeModal('authModal');
    afterLoginUI();
    renderAll();
    showToast('Conta criada! +20 moedas', 'success');
}

function logout() {
    currentUser = null;
    localStorage.removeItem(KEYS.session);
    closeUserMenu();
    afterLoginUI();
    showSection('home');
    renderAll();
    showToast('Sessão encerrada.', 'info');
}

function restoreSession() {
    const sid = parseInt(localStorage.getItem(KEYS.session), 10);
    if (sid) currentUser = getUser(sid) || null;
}

function isAdmin() { return !!currentUser && currentUser.role === 'admin'; }

function heroCta() {
    if (!currentUser) openAuth('register');
    else document.getElementById('itemsGrid').scrollIntoView({ behavior:'smooth' });
}

function afterLoginUI() {
    const logged = !!currentUser;
    document.getElementById('authArea').classList.toggle('hidden', logged);
    document.getElementById('sellBtn').classList.toggle('hidden', !logged);
    document.getElementById('notifBtn').classList.toggle('hidden', !logged);
    document.getElementById('userArea').classList.toggle('hidden', !logged);
    document.querySelectorAll('.auth-only').forEach(el => el.classList.toggle('hidden', !logged));
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));
    if (document.getElementById('ddAdminLink')) document.getElementById('ddAdminLink').classList.toggle('hidden', !isAdmin());
    if (logged) {
        document.getElementById('tbAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
        document.getElementById('tbName').textContent = currentUser.name.split(' ')[0];
        document.getElementById('ddUserName').textContent = currentUser.name;
        document.getElementById('ddUserEmail').textContent = currentUser.email;
    }
    updateWalletUI();
    renderNotifBadge();
}

function updateWalletUI() {
    if (!currentUser) return;
    document.getElementById('ddWallet').textContent = fmt(currentUser.coins);
    document.getElementById('profWallet').textContent = fmt(currentUser.coins);
}

function toggleUserMenu(ev) {
    ev.stopPropagation();
    document.getElementById('userDropdown').parentElement.classList.toggle('active');
}

function closeUserMenu() {
    document.querySelectorAll('.user-menu').forEach(m => m.classList.remove('active'));
}
