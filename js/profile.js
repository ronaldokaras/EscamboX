'use strict';

// Perfil do usuário

/**
 * Renderiza os dados do perfil do usuário logado.
 */
function renderProfile() {
    if (!currentUser) return;

    // Garantir campos essenciais
    if (!currentUser.stats) {
        currentUser.stats = {
            logins: 0,
            sales: 0,
            barters: 0,
            itemsPublished: 0,
            ratingsReceived: 0
        };
    }
    if (!Array.isArray(currentUser.ratings)) {
        currentUser.ratings = [];
    }
    if (!Array.isArray(currentUser.favs)) {
        currentUser.favs = [];
    }

    // Avatar e nome
    const profAvatar = document.getElementById('profAvatar');
    if (profAvatar) {
        profAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
    }
    const nameInput = document.getElementById('nameInput');
    if (nameInput) {
        nameInput.value = currentUser.name;
    }

    // Meta: e-mail, localização e data de cadastro
    const profMeta = document.getElementById('profMeta');
    if (profMeta) {
        const loc = currentUser.location
            ? `📍 ${esc(currentUser.location)}`
            : '📍 Localização não informada';
        profMeta.innerHTML = `${esc(currentUser.email)} · ${loc} · Membro desde ${fmtDate(currentUser.createdAt)}`;
    }

    // Estatísticas
    const myItems = DB.items.filter(i => i.ownerId === currentUser.id);
    const totalNegocios = (currentUser.stats.sales || 0) + (currentUser.stats.barters || 0);
    const avgRating = currentUser.ratings.length
        ? (currentUser.ratings.reduce((s, r) => s + (r.stars || 0), 0) / currentUser.ratings.length).toFixed(1)
        : '—';

    const profStats = document.getElementById('profStats');
    if (profStats) {
        profStats.innerHTML = `
            <div class="stat-card"><div class="stat-value">${myItems.length}</div><div class="stat-label">Anúncios</div></div>
            <div class="stat-card"><div class="stat-value">${totalNegocios}</div><div class="stat-label">Escambos</div></div>
            <div class="stat-card"><div class="stat-value">${currentUser.ratings.length}</div><div class="stat-label">Avaliações</div></div>
            <div class="stat-card"><div class="stat-value">${avgRating}</div><div class="stat-label">Média ⭐</div></div>
            <div class="stat-card"><div class="stat-value">🪙 ${fmt(currentUser.coins)}</div><div class="stat-label">Saldo</div></div>
        `;
    }

    // Avaliações recebidas
    const revCount = document.getElementById('revCount');
    if (revCount) revCount.textContent = currentUser.ratings.length;
    const reviewsList = document.getElementById('reviewsList');
    if (reviewsList) {
        reviewsList.innerHTML = currentUser.ratings.length
            ? currentUser.ratings.map(r => {
                const who = getUser(r.by);
                const stars = '⭐'.repeat(Math.max(0, Math.min(5, r.stars || 0)));
                const when = r.ts ? fmtDate(r.ts) : '';
                return `<li class="review-item">
                    <strong>${stars}</strong>
                    ${who ? ` · ${esc(who.name)}` : ''}
                    ${when ? ` · <span class="text-muted fs-sm">${when}</span>` : ''}
                    ${r.comment ? `<br><span class="text-muted">${esc(r.comment)}</span>` : ''}
                </li>`;
            }).join('')
            : '<li class="text-muted">Sem avaliações ainda.</li>';
    }

    // Meus anúncios (usa itemCard com índice)
    const myItemsGrid = document.getElementById('myItemsGrid');
    if (myItemsGrid) {
        if (typeof itemCard === 'function') {
            myItemsGrid.innerHTML = myItems.length
                ? myItems.map((item, idx) => itemCard(item, idx)).join('')
                : '<p class="text-muted empty-state">Nenhum item publicado.</p>';
        } else {
            myItemsGrid.innerHTML = myItems.map(i => `
                <div class="card-item">
                    <div class="info">
                        <strong>${esc(i.title)}</strong><br>
                        ${i.price > 0 ? '🪙 ' + fmt(i.price) + ' moedas' : '🔄 Troca de item'}
                    </div>
                </div>
            `).join('') || '<p class="text-muted">Nenhum item publicado.</p>';
        }
    }

    // Favoritos
    const favItemsGrid = document.getElementById('favItemsGrid');
    if (favItemsGrid) {
        const favItems = (currentUser.favs || [])
            .map(id => getItem(id))
            .filter(Boolean);
        if (typeof itemCard === 'function') {
            favItemsGrid.innerHTML = favItems.length
                ? favItems.map((item, idx) => itemCard(item, idx)).join('')
                : '<p class="text-muted empty-state">Nenhum favorito.</p>';
        } else {
            favItemsGrid.innerHTML = favItems.map(i => `
                <div class="card-item">
                    <div class="info">
                        <strong>${esc(i.title)}</strong><br>
                        ${i.price > 0 ? '🪙 ' + fmt(i.price) + ' moedas' : '🔄 Troca'}
                    </div>
                </div>
            `).join('') || '<p class="text-muted">Nenhum favorito.</p>';
        }
    }

    // Extrato de moedas
    const ledger = DB.ledger
        .filter(l => l.userId === currentUser.id)
        .slice(-30)
        .reverse();
    const ledgerBody = document.getElementById('ledgerBody');
    if (ledgerBody) {
        ledgerBody.innerHTML = ledger.length
            ? ledger.map(l => `
                <tr>
                    <td>${fmtDate(l.ts)}</td>
                    <td class="${l.delta > 0 ? 'text-success' : ''}">${l.delta > 0 ? '+' : ''}${fmt(l.delta)} 🪙</td>
                    <td>${esc(l.reason || '')}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="3" class="text-muted">Sem movimentos.</td></tr>';
    }

    updateWalletUI();
}

/**
 * Salva o novo nome do usuário.
 */
function saveName() {
    if (!currentUser) return;

    const nameInput = document.getElementById('nameInput');
    if (!nameInput) return;
    const v = nameInput.value.trim();

    if (v.length < 2) {
        showToast('Nome muito curto (mín. 2 caracteres).', 'error');
        nameInput.focus();
        return;
    }

    currentUser.name = v;
    save();
    afterLoginUI();
    showToast('Nome atualizado.', 'success');
}

/**
 * Altera a senha do usuário.
 */
async function changePassword() {
    if (!currentUser) return;

    const pwCurrent = document.getElementById('pwCurrent');
    const pwNew = document.getElementById('pwNew');
    if (!pwCurrent || !pwNew) return;

    try {
        const cur = pwCurrent.value;
        const nw = pwNew.value;

        if (await hashPassword(cur) !== currentUser.passHash) {
            showToast('Senha atual incorreta.', 'error');
            pwCurrent.focus();
            return;
        }
        if (nw.length < 4) {
            showToast('Senha muito curta (mín. 4 caracteres).', 'error');
            pwNew.focus();
            return;
        }

        currentUser.passHash = await hashPassword(nw);
        save();
        pwCurrent.value = '';
        pwNew.value = '';
        showToast('Senha alterada com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showToast('Erro ao alterar senha.', 'error');
    }
}

/**
 * Exporta todos os dados para um arquivo JSON.
 */
function exportData() {
    try {
        const data = JSON.stringify(DB, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const a = document.createElement('a');
        a.href = url;
        a.download = `escambox-backup-${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup exportado.', 'success');
    } catch (error) {
        console.error('Erro ao exportar dados:', error);
        showToast('Erro ao exportar dados.', 'error');
    }
}

/**
 * Importa dados de um arquivo JSON.
 * @param {HTMLInputElement} input - Input de arquivo
 */
function importData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || typeof data !== 'object' ||
                !Array.isArray(data.users) ||
                !Array.isArray(data.items) ||
                !Array.isArray(data.trades) ||
                !Array.isArray(data.ledger) ||
                !Array.isArray(data.chats) ||
                !Array.isArray(data.denounces)) {
                showToast('Arquivo inválido: estrutura incorreta.', 'error');
                return;
            }

            askConfirm('Importar dados', 'Isso substituirá todos os dados atuais. Deseja continuar?', () => {
                DB = data;
                save();
                renderAll();
                showToast('Dados importados com sucesso.', 'success');
            });
        } catch (err) {
            console.error('Erro ao importar:', err);
            showToast('Arquivo inválido.', 'error');
        }
    };
    reader.onerror = () => {
        showToast('Erro ao ler arquivo.', 'error');
    };
    reader.readAsText(file);
    input.value = '';
}