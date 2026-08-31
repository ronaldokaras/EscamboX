'use strict';

// Autenticação e sessão

/**
 * Abre o modal de autenticação e reseta os campos.
 * @param {string} tab - 'login' ou 'register'
 */
function openAuth(tab) {
    switchAuthTab(tab || 'login');
    const loginEmail = document.getElementById('liEmail');
    const loginPass = document.getElementById('liPass');
    if (loginEmail) loginEmail.value = '';
    if (loginPass) loginPass.value = '';
    // Limpa também campos de registro
    const rgName = document.getElementById('rgName');
    const rgEmail = document.getElementById('rgEmail');
    const rgPass = document.getElementById('rgPass');
    const rgLocation = document.getElementById('rgLocation');
    const rgLat = document.getElementById('rgLat');
    const rgLng = document.getElementById('rgLng');
    if (rgName) rgName.value = '';
    if (rgEmail) rgEmail.value = '';
    if (rgPass) rgPass.value = '';
    if (rgLocation) rgLocation.value = '';
    if (rgLat) rgLat.value = '';
    if (rgLng) rgLng.value = '';
    setAlert('logAlert', '');
    setAlert('regAlert', '');
    openModal('authModal');
}

/**
 * Alterna entre as abas de login e registro.
 * @param {string} tab - 'login' ou 'register'
 */
function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    const formLogin = document.getElementById('formLogin');
    const formReg = document.getElementById('formReg');
    const tabLogin = document.getElementById('tabLogin');
    const tabReg = document.getElementById('tabReg');

    if (formLogin) formLogin.classList.toggle('hidden', !isLogin);
    if (formReg) formReg.classList.toggle('hidden', isLogin);
    if (tabLogin) {
        tabLogin.classList.toggle('active', isLogin);
        tabLogin.setAttribute('aria-selected', String(isLogin));
    }
    if (tabReg) {
        tabReg.classList.toggle('active', !isLogin);
        tabReg.setAttribute('aria-selected', String(!isLogin));
    }
}

/**
 * Define uma mensagem de alerta em um elemento.
 * @param {string} id - ID do elemento
 * @param {string} msg - Mensagem a exibir (vazio para limpar)
 * @param {string} cls - Classe CSS adicional ('error', 'success', etc.)
 */
function setAlert(id, msg, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'alert' + (msg ? ' ' + (cls || 'error') : '');
    el.textContent = msg;
}

/**
 * Valida formato básico de e-mail.
 * @param {string} email - E-mail a validar
 * @returns {boolean} True se válido
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Foca em um campo específico após erro de validação.
 * @param {string} id - ID do campo
 */
function focusField(id) {
    const el = document.getElementById(id);
    if (el) el.focus();
}

/**
 * Processa o login do usuário.
 * @param {Event} ev - Evento de submit
 */
async function doLogin(ev) {
    ev.preventDefault();

    const submitBtn = document.getElementById('btnLoginSubmit');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const emailInput = document.getElementById('liEmail');
        const passInput = document.getElementById('liPass');
        if (!emailInput || !passInput) return;

        const email = norm(emailInput.value);
        const pw = passInput.value;

        if (!email || !isValidEmail(email)) {
            setAlert('logAlert', 'Informe um e-mail válido.');
            focusField('liEmail');
            return;
        }
        if (!pw) {
            setAlert('logAlert', 'Informe sua senha.');
            focusField('liPass');
            return;
        }

        const user = DB.users.find(u => norm(u.email) === email);
        if (!user || user.passHash !== await hashPassword(pw)) {
            setAlert('logAlert', 'E-mail ou senha incorretos.');
            return;
        }

        if (user.role === 'banned') {
            setAlert('logAlert', 'Usuário banido. Contate o suporte.');
            return;
        }

        user.stats.logins = (user.stats.logins || 0) + 1;
        user.lastLoginDate = todayStr();
        currentUser = user;
        localStorage.setItem(KEYS.session, String(user.id));
        save();
        closeModal('authModal');
        afterLoginUI();
        renderAll();
        showToast('Bem-vindo(a), ' + user.name.split(' ')[0] + '!', 'success');
    } catch (error) {
        console.error('Erro no login:', error);
        setAlert('logAlert', 'Erro ao processar login. Tente novamente.');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

/**
 * Processa o registro de novo usuário (com localização).
 * @param {Event} ev - Evento de submit
 */
async function doRegister(ev) {
    ev.preventDefault();

    const submitBtn = document.getElementById('btnRegSubmit');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const nameInput = document.getElementById('rgName');
        const emailInput = document.getElementById('rgEmail');
        const passInput = document.getElementById('rgPass');
        const locationInput = document.getElementById('rgLocation');
        const latInput = document.getElementById('rgLat');
        const lngInput = document.getElementById('rgLng');

        if (!nameInput || !emailInput || !passInput) return;

        const name = nameInput.value.trim();
        const email = norm(emailInput.value);
        const pw = passInput.value;
        const location = locationInput ? locationInput.value.trim() : '';
        const lat = latInput && latInput.value ? parseFloat(latInput.value) : null;
        const lng = lngInput && lngInput.value ? parseFloat(lngInput.value) : null;

        if (name.length < 2) {
            setAlert('regAlert', 'Informe seu nome (mín. 2 caracteres).');
            focusField('rgName');
            return;
        }
        if (!email || !isValidEmail(email)) {
            setAlert('regAlert', 'Informe um e-mail válido.');
            focusField('rgEmail');
            return;
        }
        if (pw.length < 4) {
            setAlert('regAlert', 'Senha muito curta (mín. 4 caracteres).');
            focusField('rgPass');
            return;
        }
        if (!location || location.length < 2) {
            setAlert('regAlert', 'Informe onde você mora (cidade / bairro).');
            focusField('rgLocation');
            return;
        }
        if (DB.users.some(u => norm(u.email) === email)) {
            setAlert('regAlert', 'E-mail já cadastrado.');
            focusField('rgEmail');
            return;
        }

        const now = Date.now();
        const user = {
            id: nextId(),
            name,
            email,
            passHash: await hashPassword(pw),
            role: 'user',
            coins: 0,
            // Localização do usuário (para filtros de proximidade)
            location: location,
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
            createdAt: now,
            favs: [],
            notifications: [],
            claimed: {},
            lastLoginDate: todayStr(),
            stats: {
                logins: 1,
                sales: 0,
                barters: 0,
                itemsPublished: 0,
                ratingsReceived: 0
            },
            ratings: []
        };

        // Bônus de boas-vindas (20 moedas virtuais)
        changeCoins(user, 20, 'Bônus de boas-vindas');
        DB.users.push(user);

        notify(user.id, 'Conta criada! Você ganhou 20 moedas virtuais. Use-as em trocas e aquisições.');

        currentUser = user;
        localStorage.setItem(KEYS.session, String(user.id));
        save();
        closeModal('authModal');
        afterLoginUI();
        renderAll();
        showToast('Conta criada! +20 moedas', 'success');
    } catch (error) {
        console.error('Erro no registro:', error);
        setAlert('regAlert', 'Erro ao processar registro. Tente novamente.');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

/**
 * Encerra a sessão do usuário.
 */
function logout() {
    currentUser = null;
    localStorage.removeItem(KEYS.session);
    closeUserMenu();
    afterLoginUI();
    showSection('home');
    renderAll();
    showToast('Sessão encerrada.', 'info');
}

/**
 * Restaura a sessão a partir do localStorage.
 */
function restoreSession() {
    const sid = parseInt(localStorage.getItem(KEYS.session), 10);
    if (sid) {
        currentUser = getUser(sid) || null;
        if (!currentUser) {
            localStorage.removeItem(KEYS.session);
        }
    }
}

/**
 * Verifica se o usuário logado é admin.
 * @returns {boolean}
 */
function isAdmin() {
    return !!currentUser && currentUser.role === 'admin';
}

/**
 * Ação do botão principal no hero da home.
 */
function heroCta() {
    if (!currentUser) {
        openAuth('register');
    } else {
        const itemsGrid = document.getElementById('itemsGrid');
        if (itemsGrid) itemsGrid.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Atualiza a interface conforme o estado de autenticação.
 */
function afterLoginUI() {
    const logged = !!currentUser;

    const authArea = document.getElementById('authArea');
    const sellBtn = document.getElementById('sellBtn');
    const notifBtn = document.getElementById('notifBtn');
    const userArea = document.getElementById('userArea');

    if (authArea) authArea.classList.toggle('hidden', logged);
    if (sellBtn) sellBtn.classList.toggle('hidden', !logged);
    if (notifBtn) notifBtn.classList.toggle('hidden', !logged);
    const chatBarBtn = document.getElementById('chatBarBtn');
    if (chatBarBtn) chatBarBtn.classList.toggle('hidden', !logged);
    if (userArea) userArea.classList.toggle('hidden', !logged);

    document.querySelectorAll('.auth-only').forEach(el => el.classList.toggle('hidden', !logged));
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));

    const ddAdminLink = document.getElementById('ddAdminLink');
    if (ddAdminLink) ddAdminLink.classList.toggle('hidden', !isAdmin());

    if (logged) {
        const tbAvatar = document.getElementById('tbAvatar');
        const tbName = document.getElementById('tbName');
        const ddUserName = document.getElementById('ddUserName');
        const ddUserEmail = document.getElementById('ddUserEmail');

        if (tbAvatar) tbAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
        if (tbName) tbName.textContent = currentUser.name.split(' ')[0];
        if (ddUserName) ddUserName.textContent = currentUser.name;
        if (ddUserEmail) ddUserEmail.textContent = currentUser.email;
    }

    updateWalletUI();
    renderNotifBadge();
    if (typeof renderChatBadge === 'function') renderChatBadge();
}

/**
 * Atualiza os saldos de moedas na interface.
 */
function updateWalletUI() {
    if (!currentUser) return;

    const ddWallet = document.getElementById('ddWallet');
    const profWallet = document.getElementById('profWallet');
    if (ddWallet) ddWallet.textContent = fmt(currentUser.coins);
    if (profWallet) profWallet.textContent = fmt(currentUser.coins);
}

/**
 * Alterna a visibilidade do menu do usuário.
 * @param {Event} event - Evento de clique
 */
function toggleUserMenu(event) {
    if (event) event.stopPropagation();
    const userMenu = document.getElementById('userArea');
    if (userMenu) {
        const dropdown = userMenu.querySelector('.dropdown-content');
        if (dropdown) {
            dropdown.parentElement.classList.toggle('active');
            const expanded = dropdown.parentElement.classList.contains('active');
            dropdown.parentElement.querySelector('.user-btn')?.setAttribute('aria-expanded', String(expanded));
        }
    }
}

/**
 * Fecha todos os menus de usuário abertos.
 */
function closeUserMenu() {
    document.querySelectorAll('.user-menu').forEach(m => {
        m.classList.remove('active');
        const btn = m.querySelector('.user-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    });
}