// Perfil do usuário
function renderProfile() {
    if (!currentUser) return;
    document.getElementById('profAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('nameInput').value = currentUser.name;
    document.getElementById('profMeta').innerHTML = `${currentUser.email} · Membro desde ${fmtDate(currentUser.createdAt)}`;
    const myItems = DB.items.filter(i => i.ownerId === currentUser.id);
    document.getElementById('profStats').innerHTML = `
        <div class="stat-card"><div class="stat-value">${myItems.length}</div><div class="stat-label">Anúncios</div></div>
        <div class="stat-card"><div class="stat-value">${currentUser.stats.sales + currentUser.stats.barters}</div><div class="stat-label">Negócios</div></div>
        <div class="stat-card"><div class="stat-value">${currentUser.ratings.length}</div><div class="stat-label">Avaliações</div></div>
    `;
    document.getElementById('revCount').textContent = currentUser.ratings.length;
    document.getElementById('reviewsList').innerHTML = currentUser.ratings.map(r => `<li>${r.stars}★ – ${esc(r.comment || '')}</li>`).join('') || '<li>Sem avaliações.</li>';
    document.getElementById('myItemsGrid').innerHTML = myItems.map(i => `<div class="card-item"><div class="info"><strong>${esc(i.title)}</strong><br>${i.price ? 'R$ '+i.price : 'Troca'}</div></div>`).join('') || '<p>Nenhum item publicado.</p>';
    document.getElementById('favItemsGrid').innerHTML = currentUser.favs.map(id => getItem(id)).filter(Boolean).map(i => `<div class="card-item"><div class="info"><strong>${esc(i.title)}</strong></div></div>`).join('') || '<p>Nenhum favorito.</p>';
    const ledger = DB.ledger.filter(l => l.userId === currentUser.id).slice(-20).reverse();
    document.getElementById('ledgerBody').innerHTML = ledger.map(l => `<tr><td>${fmtDate(l.ts)}</td><td>${l.delta > 0 ? '+' : ''}${l.delta}</td><td>${esc(l.reason)}</td></tr>`).join('') || '<tr><td colspan="3">Sem movimentos.</td></tr>';
    updateWalletUI();
}

function saveName() {
    if (!currentUser) return;
    const v = document.getElementById('nameInput').value.trim();
    if (v.length < 2) return showToast('Nome inválido.', 'error');
    currentUser.name = v;
    save();
    afterLoginUI();
    showToast('Nome atualizado.', 'success');
}

async function changePassword() {
    if (!currentUser) return;
    const cur = document.getElementById('pwCurrent').value;
    const nw = document.getElementById('pwNew').value;
    if (await hashPassword(cur) !== currentUser.passHash) return showToast('Senha atual incorreta.', 'error');
    if (nw.length < 4) return showToast('Senha muito curta.', 'error');
    currentUser.passHash = await hashPassword(nw);
    save();
    showToast('Senha alterada.', 'success');
}

function exportData() {
    const data = JSON.stringify(DB);
    const blob = new Blob([data], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'escambox-backup.json'; a.click();
    URL.revokeObjectURL(url);
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            DB = data;
            save();
            renderAll();
            showToast('Dados importados.', 'success');
        } catch(err) { showToast('Arquivo inválido.', 'error'); }
    };
    reader.readAsText(file);
}
