// Interface geral, navegação, notificações, modais
function showSection(name) {
    if (name === 'admin' && !isAdmin()) return showToast('Acesso negado.', 'error');
    if (['trades','missions','profile'].includes(name) && !currentUser) return openAuth('login');
    document.querySelectorAll('[id^="sec-"]').forEach(s => s.classList.add('hidden'));
    document.getElementById('sec-' + name)?.classList.remove('hidden');
    document.querySelectorAll('.subnav a').forEach(a => a.classList.toggle('active', a.dataset.section === name));
    if (name === 'profile') renderProfile();
    if (name === 'admin') renderAdmin();
    if (name === 'trades') renderTrades();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function askConfirm(title, text, onOk) {
    document.getElementById('cfTitle').textContent = title;
    document.getElementById('cfText').textContent = text;
    openModal('confirmModal');
    document.getElementById('cfYesBtn').onclick = () => { closeModal('confirmModal'); onOk(); };
}

function settleConfirm() { closeModal('confirmModal'); }

function renderNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!currentUser) return;
    const count = currentUser.notifications.filter(n => !n.read).length;
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
}

function toggleNotifications() {
    const list = document.getElementById('notifList');
    list.innerHTML = currentUser.notifications.map(n => `<div>${esc(n.text)}</div>`).join('') || 'Sem notificações.';
    openModal('notifModal');
}

function clearNotifications() {
    if (!currentUser) return;
    currentUser.notifications = [];
    save();
    toggleNotifications();
    renderNotifBadge();
}

function renderAll() {
    updateWalletUI();
    renderNotifBadge();
    renderGrid();
    renderTrades();
}

function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(KEYS.theme, t);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(current);
}
