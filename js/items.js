// Após a função saveItem, adicionar:

function openDetail(itemId) {
    const item = getItem(itemId);
    if (!item) return;
    const owner = getUser(item.ownerId);
    const r = ownerRating(item.ownerId);
    const img = safeImageUrl(item.image);
    const media = img ? `<img src="${img}" alt="${esc(item.title)}" class="detail-image">` : `<div class="image-placeholder">${CAT_ICONS[item.category] || '📦'}</div>`;
    const distText = item.lat && item.lng ? `${distance(getUserLocationFilter().lat, getUserLocationFilter().lng, item.lat, item.lng)?.toFixed(1)} km` : 'Localização não informada';
    
    let actionButtons = '';
    if (currentUser && item.ownerId !== currentUser.id && item.status === 'available') {
        if (item.price > 0 && item.type !== 'trade') {
            actionButtons += `<button class="btn btn-warning" onclick="buyWithCoins(${item.id})">Comprar por R$ ${fmt(item.price)}</button>`;
        }
        if (item.acceptTrades) {
            actionButtons += `<button class="btn btn-secondary" onclick="openChat(${item.ownerId})">Propor troca</button>`;
        }
        actionButtons += `<button class="btn btn-secondary" onclick="openChat(${item.ownerId})">💬 Conversar</button>`;
        actionButtons += `<button class="btn btn-danger" onclick="openDenounce(${item.id})">Denunciar</button>`;
    } else if (!currentUser) {
        actionButtons = `<button class="btn" onclick="openAuth('login')">Entre para negociar</button>`;
    } else if (item.ownerId === currentUser.id) {
        actionButtons = `<button class="btn btn-secondary" onclick="editItem(${item.id})">Editar</button>`;
        if (item.status === 'available') {
            actionButtons += `<button class="btn btn-danger" onclick="askConfirm('Excluir item', 'Deseja excluir este anúncio?', () => deleteItem(${item.id}))">Excluir</button>`;
        }
    }

    document.getElementById('detailContent').innerHTML = `
        <button class="close-modal" onclick="closeModal('detailModal')">×</button>
        <div class="detail-media">${media}</div>
        <h2 class="detail-title">${esc(item.title)}</h2>
        <div class="detail-meta">
            <span>${item.price > 0 ? 'R$ ' + fmt(item.price) : 'Troca'}</span>
            <span>${CONDITIONS[item.condition]}</span>
            <span>${CAT_ICONS[item.category]} ${item.category}</span>
            <span>👁 ${fmt(item.views)}</span>
            <span>📍 ${distText}</span>
        </div>
        <p class="detail-desc">${esc(item.desc) || 'Sem descrição.'}</p>
        <div class="detail-owner">
            <div class="user-avatar">${owner ? owner.name.charAt(0) : '?'}</div>
            <div>
                <strong>${owner ? esc(owner.name) : 'Usuário'}</strong>
                ${r.count ? `<span>⭐ ${fmtAvg(r.avg)} (${r.count})</span>` : '<span>Sem avaliações</span>'}
            </div>
        </div>
        <div class="detail-actions">${actionButtons}</div>
    `;
    item.views++;
    save();
    openModal('detailModal');
}

function deleteItem(itemId) {
    const item = getItem(itemId);
    if (!item || item.ownerId !== currentUser.id) return;
    DB.items = DB.items.filter(i => i.id !== itemId);
    save();
    closeModal('detailModal');
    renderGrid();
    if (!$id('sec-profile').classList.contains('hidden')) renderProfile();
    showToast('Anúncio excluído.', 'warning');
}

function openDenounce(itemId) {
    const item = getItem(itemId);
    if (!item) return;
    document.getElementById('denounceTarget').textContent = `"${item.title}"`;
    document.getElementById('denounceReason').value = 'fraude';
    document.getElementById('denounceComment').value = '';
    window._denounceItemId = itemId;
    openModal('denounceModal');
}

function submitDenounce() {
    const itemId = window._denounceItemId;
    const item = getItem(itemId);
    if (!item || !currentUser) return;
    const reason = document.getElementById('denounceReason').value;
    const comment = document.getElementById('denounceComment').value.trim();
    DB.denounces.push({
        id: nextId(),
        itemId,
        reporterId: currentUser.id,
        reason,
        comment,
        createdAt: Date.now()
    });
    save();
    closeModal('denounceModal');
    showToast('Denúncia enviada para análise.', 'info');
}

// Melhorar getUserLocationFilter para tentar usar a localização salva do usuário logado
function getUserLocationFilter() {
    if (currentUser && currentUser.lat && currentUser.lng) {
        return { lat: currentUser.lat, lng: currentUser.lng };
    }
    // Fallback: São Paulo
    return { lat: -23.5505, lng: -46.6333 };
}