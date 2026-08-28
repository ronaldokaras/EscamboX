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
    const profMeta = document.getElementById('profMeta');
    if (profMeta) {
        profMeta.innerHTML = `${esc(currentUser.email)} · Membro desde ${fmtDate(currentUser.createdAt)}`;
    }

    // Estatísticas
    const myItems = DB.items.filter(i => i.ownerId === currentUser.id);
    const totalNegocios = (currentUser.stats.sales || 0) + (currentUser.stats.barters || 0);
    const profStats = document.getElementById('profStats');
    if (profStats) {
        profStats.innerHTML = `
            <div class="stat-card"><div class="stat-value">${myItems.length}</div><div class="stat-label">Anúncios</div></div>
            <div class="stat-card"><div class="stat-value">${totalNegocios}</div><div class="stat-label">Negócios</div></div>
            <div class="stat-card"><div class="stat-value">${currentUser.ratings.length}</div><div class="stat-label">Avaliações</div></div>
        `;
    }

    // Avaliações
    const revCount = document.getElementById('revCount');
    if (revCount) revCount.textContent = currentUser.ratings.length;
    const reviewsList = document.getElementById('reviewsList');
    if (reviewsList) {
        reviewsList.innerHTML = currentUser.ratings.map(r => {
            const stars = '⭐'.repeat(Math.max(0, Math.min(5, r.stars || 0)));
            return `<li>${stars} – ${esc(r.comment || '')}</li>`;
        }).join('') || '<li>Sem avaliações.</li>';
    }

    // Meus anúncios
    const myItemsGrid = document.getElementById('myItemsGrid');
    if (myItemsGrid) {
        if (typeof itemCard === 'function') {
            myItemsGrid.innerHTML = myItems.map(itemCard).join('') || '<p>Nenhum item publicado.</p>';
        } else {
            myItemsGrid.innerHTML = myItems.map(i => `
                <div class="card-item">
                    <div class="info">
                        <strong>${esc(i.title)}</strong><br>
                        ${i.price > 0 ? 'R$ ' + fmt(i.price) : 'Troca'}
                    </div>
                </div>
            `).join('') || '<p>Nenhum item publicado.</p>';
        }
    }

    // Favoritos
    const favItemsGrid = document.getElementById('favItemsGrid');
    if (favItemsGrid) {
        const favItems = currentUser.favs
            .map(id => getItem(id))
            .filter(Boolean);
        if (typeof itemCard === 'function') {
            favItemsGrid.innerHTML = favItems.map(itemCard).join('') || '<p>Nenhum favorito.</p>';
        } else {
            favItemsGrid.innerHTML = favItems.map(i => `
                <div class="card-item">
                    <div class="info">
                        <strong>${esc(i.title)}</strong>
                    </div>
                </div>
            `).join('') || '<p>Nenhum favorito.</p>';
        }
    }

    // Extrato de moedas
    const ledger = DB.ledger
        .filter(l => l.userId === currentUser.id)
        .slice(-20)
        .reverse();
    const ledgerBody = document.getElementById('ledgerBody');
    if (ledgerBody) {
        ledgerBody.innerHTML = ledger.map(l => `
            <tr>
                <td>${fmtDate(l.ts)}</td>
                <td>${l.delta > 0 ? '+' : ''}${l.delta}</td>
                <td>${esc(l.reason || '')}</td>
            </tr>
        `).join('') || '<tr><td colspan="3">Sem movimentos.</td></tr>';
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
        // Limpar campos após sucesso
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
            // Validar estrutura mínima
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

            // Perguntar confirmação antes de substituir dados
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
    // Limpar input para permitir reimportar o mesmo arquivo
    input.value = '';
}