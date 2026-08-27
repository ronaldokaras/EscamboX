// Gerenciamento de itens e filtros
let filters = { q:'', category:'all', type:'all', condition:'all', sort:'recent', minPrice:0, maxPrice:Infinity, radius:0 };
let visibleCount = 12;
let viewMode = 'grid';
let editingItemId = null;
let mapInstance = null;

const CATEGORIES = ['Eletrônicos','Livros','Roupas','Casa','Outros'];
const CONDITIONS = { novo:'Novo', seminovo:'Seminovo', usado:'Usado' };
const CAT_ICONS = { 'Eletrônicos':'📱', 'Livros':'📚', 'Roupas':'👕', 'Casa':'🏠', 'Outros':'📦' };

function populateFormSelects() {
    const sel = document.getElementById('fCat');
    sel.innerHTML = CATEGORIES.map(c => `<option value="${c}">${CAT_ICONS[c]} ${c}</option>`).join('');
}

function setFilter(key, value) {
    filters[key] = value;
    if (key === 'minPrice') filters.minPrice = parseFloat(value) || 0;
    if (key === 'maxPrice') filters.maxPrice = parseFloat(value) || Infinity;
    visibleCount = 12;
    renderGrid();
}

function setSort(value) { setFilter('sort', value); }
function setRadius(value) { filters.radius = parseFloat(value) || 0; visibleCount = 12; renderGrid(); }

function handleSearch() {
    filters.q = document.getElementById('searchInput').value;
    visibleCount = 12;
    renderGrid();
}

let searchTimer;
function debouncedSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(handleSearch, 300);
}

function ownerRating(ownerId) {
    const u = getUser(ownerId);
    if (!u || !u.ratings.length) return { avg:0, count:0 };
    const sum = u.ratings.reduce((a,r) => a + r.stars, 0);
    return { avg: sum/u.ratings.length, count: u.ratings.length };
}

function getUserLocationFilter() {
    if (currentUser && currentUser.lat && currentUser.lng) {
        return { lat: currentUser.lat, lng: currentUser.lng };
    }
    // Fallback: São Paulo
    return { lat: -23.5505, lng: -46.6333 };
}

function filteredItems() {
    const q = norm(filters.q);
    let list = DB.items.filter(i => i.status === 'available');
    if (q) list = list.filter(i => norm(i.title).includes(q) || norm(i.desc).includes(q) || norm(i.category).includes(q));
    if (filters.category !== 'all') list = list.filter(i => i.category === filters.category);
    if (filters.type !== 'all') list = list.filter(i => filters.type === 'sale' ? i.price > 0 : i.acceptTrades);
    if (filters.condition !== 'all') list = list.filter(i => i.condition === filters.condition);
    if (filters.minPrice > 0) list = list.filter(i => i.price >= filters.minPrice);
    if (filters.maxPrice !== Infinity) list = list.filter(i => i.price <= filters.maxPrice);

    if (filters.radius > 0) {
        const center = getUserLocationFilter();
        list = list.filter(i => {
            if (!i.lat || !i.lng) return false;
            const d = distance(center.lat, center.lng, i.lat, i.lng);
            return d !== null && d <= filters.radius;
        });
    }

    const sorters = {
        recent: (a,b) => b.createdAt - a.createdAt,
        price_asc: (a,b) => (a.price||0) - (b.price||0),
        price_desc: (a,b) => (b.price||0) - (a.price||0),
        rating: (a,b) => ownerRating(b.ownerId).avg - ownerRating(a.ownerId).avg,
        distance: (a,b) => {
            const center = getUserLocationFilter();
            const da = a.lat && a.lng ? distance(center.lat, center.lng, a.lat, a.lng) : Infinity;
            const db = b.lat && b.lng ? distance(center.lat, center.lng, b.lat, b.lng) : Infinity;
            return da - db;
        }
    };
    return list.sort(sorters[filters.sort] || sorters.recent);
}

function renderChips() {
    const cats = ['all', ...CATEGORIES];
    document.getElementById('catChips').innerHTML = cats.map(c =>
        `<button class="chip${filters.category === c ? ' active' : ''}" onclick="setCategory('${c}')">${c === 'all' ? 'Todos' : CAT_ICONS[c] + ' ' + c}</button>`
    ).join('');
}

function setCategory(c) { filters.category = c; visibleCount = 12; renderChips(); renderGrid(); }

function itemCard(i) {
    const owner = getUser(i.ownerId);
    const r = ownerRating(i.ownerId);
    const img = safeImageUrl(i.image);
    const media = img
        ? `<img class="item-image" src="${img}" alt="${esc(i.title)}" loading="lazy">`
        : `<div class="image-placeholder">${CAT_ICONS[i.category] || '📦'}</div>`;
    const typeTags = (i.price > 0 && i.type !== 'trade' ? '<span class="mini-tag sale">Venda</span>' : '') +
                     (i.acceptTrades ? '<span class="mini-tag trade">Troca</span>' : '');
    const distHtml = i.lat && i.lng ? `<span>· ${distance(getUserLocationFilter().lat, getUserLocationFilter().lng, i.lat, i.lng)?.toFixed(1)} km</span>` : '';
    return `<article class="card-item" onclick="openDetail(${i.id})">
        <div class="card-media">
            ${media}
            ${currentUser ? `<button class="fav-btn" onclick="event.stopPropagation(); toggleFav(${i.id})">${currentUser.favs.includes(i.id) ? '❤️' : '🤍'}</button>` : ''}
            ${i.status !== 'available' ? `<span class="status-flag">Indisponível</span>` : ''}
        </div>
        <div class="info">
            <div class="price">${i.price > 0 ? `R$ ${fmt(i.price)}` : 'Troca'}</div>
            <h3 class="title">${esc(i.title)}</h3>
            <div class="tag-row">${typeTags}<span class="mini-tag">${CONDITIONS[i.condition]}</span></div>
            <div class="meta">
                <span>${owner ? esc(owner.name.split(' ')[0]) : ''} ${r.count ? `⭐ ${fmtAvg(r.avg)}` : ''}</span>
                <span>👁 ${fmt(i.views)}</span>
                ${distHtml}
            </div>
        </div>
    </article>`;
}

function renderGrid() {
    const grid = document.getElementById('itemsGrid');
    grid.className = viewMode === 'grid' ? 'grid' : 'list-view';
    const all = filteredItems();
    const shown = all.slice(0, visibleCount);
    grid.innerHTML = shown.length ? shown.map(itemCard).join('') :
        '<div class="empty-state">Nenhum item encontrado.</div>';
    document.getElementById('resultsInfo').textContent = `${fmt(all.length)} itens encontrados`;
}

function loadMore() { visibleCount += 12; renderGrid(); }

function setViewMode(mode) {
    viewMode = mode;
    document.querySelectorAll('.list-toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btnGridView').classList.toggle('active', mode === 'grid');
    document.getElementById('btnListView').classList.toggle('active', mode === 'list');
    renderGrid();
}

function toggleFav(itemId) {
    if (!currentUser) { openAuth('login'); return; }
    const idx = currentUser.favs.indexOf(itemId);
    if (idx >= 0) currentUser.favs.splice(idx,1);
    else currentUser.favs.push(itemId);
    save();
    renderGrid();
    if (!$id('sec-profile').classList.contains('hidden')) renderProfile();
}

function openSellModal() {
    if (!currentUser) { openAuth('login'); return; }
    editingItemId = null;
    document.getElementById('itmHeading').textContent = 'Publicar item';
    document.getElementById('fTitle').value = '';
    document.getElementById('fDesc').value = '';
    document.getElementById('fPrice').value = 50;
    document.getElementById('fType').value = 'both';
    document.getElementById('fImg').value = '';
    document.getElementById('fImgFile').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('fLocation').value = '';
    document.getElementById('fLat').value = '';
    document.getElementById('fLng').value = '';
    onTypeChange();
    openModal('itemModal');
    if (!mapInstance) {
        mapInstance = L.map('map').setView([-23.5505, -46.6333], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
        mapInstance.on('click', function(e) {
            document.getElementById('fLat').value = e.latlng.lat;
            document.getElementById('fLng').value = e.latlng.lng;
        });
    }
}

function editItem(id) {
    const i = getItem(id);
    if (!i || i.ownerId !== currentUser.id) return;
    editingItemId = id;
    document.getElementById('itmHeading').textContent = 'Editar item';
    document.getElementById('fTitle').value = i.title;
    document.getElementById('fDesc').value = i.desc;
    document.getElementById('fPrice').value = i.price;
    document.getElementById('fType').value = i.type;
    document.getElementById('fCat').value = i.category;
    document.getElementById('fCond').value = i.condition;
    document.getElementById('fImg').value = i.image || '';
    document.getElementById('fLocation').value = i.location || '';
    document.getElementById('fLat').value = i.lat || '';
    document.getElementById('fLng').value = i.lng || '';
    onTypeChange();
    openModal('itemModal');
    if (mapInstance && i.lat && i.lng) mapInstance.setView([i.lat, i.lng], 12);
}

function onTypeChange() {
    document.getElementById('priceGroup').style.display = document.getElementById('fType').value === 'trade' ? 'none' : '';
}

function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('fImg').value = e.target.result;
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreview').style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function getLocationFromBrowser() {
    getUserLocation().then(pos => {
        document.getElementById('fLat').value = pos.lat;
        document.getElementById('fLng').value = pos.lng;
        document.getElementById('fLocation').value = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
        if (mapInstance) {
            mapInstance.setView([pos.lat, pos.lng], 14);
            L.marker([pos.lat, pos.lng]).addTo(mapInstance);
        }
    }).catch(err => showToast('Erro ao obter localização: ' + err, 'error'));
}

function saveItem(ev) {
    ev.preventDefault();
    if (!currentUser) return;
    const title = document.getElementById('fTitle').value.trim();
    const price = document.getElementById('fType').value === 'trade' ? 0 : parseInt(document.getElementById('fPrice').value) || 0;
    if (title.length < 3) { setAlert('itmAlert','Título muito curto.'); return; }
    if (price <= 0 && document.getElementById('fType').value !== 'trade') { setAlert('itmAlert','Informe um preço.'); return; }
    const data = {
        title,
        desc: document.getElementById('fDesc').value.trim(),
        category: document.getElementById('fCat').value,
        condition: document.getElementById('fCond').value,
        type: document.getElementById('fType').value,
        price,
        acceptTrades: document.getElementById('fType').value !== 'sale',
        image: document.getElementById('fImg').value.trim(),
        lat: parseFloat(document.getElementById('fLat').value) || null,
        lng: parseFloat(document.getElementById('fLng').value) || null,
        location: document.getElementById('fLocation').value.trim() || null
    };
    if (editingItemId) {
        const old = getItem(editingItemId);
        if (old && old.price !== price) {
            if (!old.priceHistory) old.priceHistory = [];
            old.priceHistory.push({ price: old.price, ts: Date.now() });
        }
        Object.assign(old, data);
        showToast('Anúncio atualizado.', 'success');
    } else {
        const newItem = { id: nextId(), ownerId: currentUser.id, status:'available', views:0, createdAt: Date.now(), priceHistory: [], ...data };
        DB.items.push(newItem);
        currentUser.stats.itemsPublished++;
        showToast('Item publicado.', 'success');
    }
    save();
    closeModal('itemModal');
    renderGrid();
    if (!$id('sec-profile').classList.contains('hidden')) renderProfile();
}

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
            actionButtons += `<button class="btn btn-secondary" onclick="submitTradeProposal(${item.id})">Propor troca</button>`;
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