'use strict';

// Gerenciamento de itens e filtros
let filters = {
    q: '',
    category: 'all',
    type: 'all',
    condition: 'all',
    sort: 'recent',
    minPrice: 0,
    maxPrice: Infinity,
    radius: 0
};
let visibleCount = 12;
let viewMode = 'grid';
let editingItemId = null;
let mapInstance = null;
let denounceItemId = null;
let searchLocation = null;

let mapPickerInstance = null;
let mapPickerMarker = null;
let mapPickerMarkerLayer = null;

const CATEGORIES = ['Eletrônicos', 'Livros', 'Roupas', 'Casa', 'Outros'];
const CONDITIONS = { novo: 'Novo', seminovo: 'Seminovo', usado: 'Usado' };
const CAT_ICONS = {
    'Eletrônicos': '📱',
    'Livros': '📚',
    'Roupas': '👕',
    'Casa': '🏠',
    'Outros': '📦'
};

function populateFormSelects() {
    const sel = document.getElementById('fCat');
    if (!sel) return;
    sel.innerHTML = CATEGORIES.map(c =>
        `<option value="${c}">${CAT_ICONS[c]} ${c}</option>`
    ).join('');
}

function setFilter(key, value) {
    switch (key) {
        case 'minPrice':
            filters.minPrice = parseFloat(value) || 0;
            break;
        case 'maxPrice':
            filters.maxPrice = parseFloat(value) || Infinity;
            break;
        case 'radius':
            filters.radius = parseFloat(value) || 0;
            break;
        default:
            filters[key] = value;
    }
    visibleCount = 12;
    renderGrid();
    if (key === 'category') renderChips();
}

function setSort(value) {
    setFilter('sort', value);
}

function setRadius(value) {
    setFilter('radius', value);
}

function handleSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    filters.q = input.value;
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
    if (!u || !u.ratings || u.ratings.length === 0) return { avg: 0, count: 0 };
    const sum = u.ratings.reduce((a, r) => a + (r.stars || 0), 0);
    return { avg: sum / u.ratings.length, count: u.ratings.length };
}

function getUserLocationFilter() {
    if (searchLocation && typeof searchLocation.lat === 'number' && typeof searchLocation.lng === 'number') {
        return { lat: searchLocation.lat, lng: searchLocation.lng };
    }
    if (currentUser && typeof currentUser.lat === 'number' && typeof currentUser.lng === 'number') {
        return { lat: currentUser.lat, lng: currentUser.lng };
    }
    return { lat: -23.5505, lng: -46.6333 };
}

function setSearchLocation(lat, lng, name) {
    searchLocation = { lat, lng, name };
    const display = document.getElementById('selectedLocationDisplay');
    if (display) {
        display.textContent = name || `Localização: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    visibleCount = 12;
    renderGrid();
}

function clearSearchLocation() {
    searchLocation = null;
    const display = document.getElementById('selectedLocationDisplay');
    if (display) display.textContent = '';
    const input = document.getElementById('searchLocationInput');
    if (input) input.value = '';
    visibleCount = 12;
    renderGrid();
}

async function searchLocationByAddress() {
    const input = document.getElementById('searchLocationInput');
    if (!input) return;
    const address = input.value.trim();
    if (!address) {
        showToast('Digite uma cidade ou endereço.', 'warning');
        return;
    }
    try {
        const coords = await geocodeAddress(address);
        if (coords) {
            setSearchLocation(coords.lat, coords.lng, coords.name);
            showToast('Localização definida: ' + coords.name, 'success');
        } else {
            showToast('Local não encontrado.', 'error');
        }
    } catch (error) {
        console.error('Erro ao buscar endereço:', error);
        showToast('Erro ao buscar endereço.', 'error');
    }
}

function useMyLocation() {
    getUserLocation()
        .then(pos => {
            setSearchLocation(pos.lat, pos.lng, 'Minha localização');
            const input = document.getElementById('searchLocationInput');
            if (input) input.value = 'Minha localização';
        })
        .catch(err => showToast('Erro ao obter localização: ' + err, 'error'));
}

function openMapPicker() {
    openModal('mapPickerModal');
    if (!mapPickerInstance) {
        const defaultLat = searchLocation?.lat || getUserLocationFilter().lat;
        const defaultLng = searchLocation?.lng || getUserLocationFilter().lng;
        mapPickerInstance = L.map('mapPicker').setView([defaultLat, defaultLng], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapPickerInstance);
        mapPickerInstance.on('click', (e) => {
            mapPickerMarker = { lat: e.latlng.lat, lng: e.latlng.lng };
            if (mapPickerMarkerLayer) {
                mapPickerMarkerLayer.setLatLng([e.latlng.lat, e.latlng.lng]);
            } else {
                mapPickerMarkerLayer = L.marker([e.latlng.lat, e.latlng.lng]).addTo(mapPickerInstance);
            }
        });
    } else {
        const lat = searchLocation?.lat || getUserLocationFilter().lat;
        const lng = searchLocation?.lng || getUserLocationFilter().lng;
        mapPickerInstance.setView([lat, lng], 12);
        if (mapPickerMarkerLayer) mapPickerMarkerLayer.setLatLng([lat, lng]);
    }
}

function confirmMapLocation() {
    if (!mapPickerMarker) {
        showToast('Clique no mapa para selecionar um ponto.', 'warning');
        return;
    }
    reverseGeocode(mapPickerMarker.lat, mapPickerMarker.lng)
        .then(name => {
            setSearchLocation(mapPickerMarker.lat, mapPickerMarker.lng, name || 'Local no mapa');
            closeModal('mapPickerModal');
        })
        .catch(() => {
            setSearchLocation(mapPickerMarker.lat, mapPickerMarker.lng, 'Local no mapa');
            closeModal('mapPickerModal');
        });
}

function filteredItems() {
    const q = norm(filters.q);
    let list = DB.items.filter(i => i.status === 'available');

    if (q) {
        list = list.filter(i =>
            norm(i.title).includes(q) ||
            norm(i.desc).includes(q) ||
            norm(i.category).includes(q)
        );
    }

    if (filters.category !== 'all') {
        list = list.filter(i => i.category === filters.category);
    }

    if (filters.type !== 'all') {
        list = list.filter(i =>
            filters.type === 'sale' ? i.price > 0 : i.acceptTrades
        );
    }

    if (filters.condition !== 'all') {
        list = list.filter(i => i.condition === filters.condition);
    }

    if (filters.minPrice > 0) {
        list = list.filter(i => i.price >= filters.minPrice);
    }
    if (filters.maxPrice !== Infinity) {
        list = list.filter(i => i.price <= filters.maxPrice);
    }

    if (filters.radius > 0) {
        const center = getUserLocationFilter();
        list = list.filter(i => {
            if (!i.lat || !i.lng) return false;
            const d = distance(center.lat, center.lng, i.lat, i.lng);
            return d !== null && d <= filters.radius;
        });
    }

    const sorters = {
        recent: (a, b) => b.createdAt - a.createdAt,
        price_asc: (a, b) => (a.price || 0) - (b.price || 0),
        price_desc: (a, b) => (b.price || 0) - (a.price || 0),
        rating: (a, b) => ownerRating(b.ownerId).avg - ownerRating(a.ownerId).avg,
        distance: (a, b) => {
            const center = getUserLocationFilter();
            const da = a.lat && a.lng ? distance(center.lat, center.lng, a.lat, a.lng) : Infinity;
            const db = b.lat && b.lng ? distance(center.lat, center.lng, b.lat, b.lng) : Infinity;
            return da - db;
        }
    };

    return list.sort(sorters[filters.sort] || sorters.recent);
}

function renderChips() {
    const container = document.getElementById('catChips');
    if (!container) return;
    const cats = ['all', ...CATEGORIES];
    container.innerHTML = cats.map(c =>
        `<button class="chip${filters.category === c ? ' active' : ''}" 
                 onclick="setCategory('${c}')"
                 aria-pressed="${filters.category === c}">
            ${c === 'all' ? 'Todos' : CAT_ICONS[c] + ' ' + c}
        </button>`
    ).join('');
}

function setCategory(c) {
    filters.category = c;
    visibleCount = 12;
    renderChips();
    renderGrid();
}

/**
 * Card estilo Mercado Livre + botões de ação no hover
 */
function itemCard(i, index) {
    const owner = getUser(i.ownerId);
    const r = ownerRating(i.ownerId);
    const img = safeImageUrl(i.image);
    const media = img
        ? `<img class="item-image" src="${img}" alt="${esc(i.title)}" loading="lazy">`
        : `<div class="image-placeholder">${CAT_ICONS[i.category] || '📦'}</div>`;

    // Preço em moedas virtuais (sem R$)
    let priceDisplay;
    if (i.price > 0 && i.type !== 'trade') {
        priceDisplay = `<span class="coin-icon">🪙</span> ${fmt(i.price)} <span class="fs-xs text-muted">moedas</span>`;
    } else {
        priceDisplay = '<span class="trade-badge">🔄 Troca de item</span>';
    }

    // Tags de tipo (Moedas / Troca)
    const typeTags =
        (i.price > 0 && i.type !== 'trade' ? '<span class="mini-tag sale">Moedas</span>' : '') +
        (i.acceptTrades ? '<span class="mini-tag trade">Troca</span>' : '');

    // Distância / localização
    let distHtml = '';
    if (i.lat && i.lng) {
        const center = getUserLocationFilter();
        const dist = distance(center.lat, center.lng, i.lat, i.lng);
        if (dist !== null && !isNaN(dist)) {
            distHtml = `<span>📍 ${dist.toFixed(1)} km</span>`;
        }
        if (i.location) {
            distHtml += `<span class="location-name">${esc(i.location)}</span>`;
        }
    }

    // Favorito
    const isFav = currentUser?.favs?.includes(i.id) || false;
    const favBtn = currentUser
        ? `<button class="fav-btn ${isFav ? 'active' : ''}" 
                   onclick="event.stopPropagation(); toggleFav(${i.id})"
                   aria-label="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
            <span class="heart">${isFav ? '❤️' : '🤍'}</span>
        </button>`
        : '';

    // Botões de ação no hover
    let actionButtons = '';
    if (currentUser && i.ownerId !== currentUser.id && i.status === 'available') {
        actionButtons = `
            <button class="btn-action primary" onclick="event.stopPropagation(); openDetail(${i.id})">Ver detalhes</button>
            ${i.acceptTrades ? `<button class="btn-action secondary" onclick="event.stopPropagation(); openTradeProposal(${i.id})">Trocar</button>` : ''}
        `;
    } else {
        actionButtons = `
            <button class="btn-action primary" onclick="event.stopPropagation(); openDetail(${i.id})">Ver detalhes</button>
        `;
    }

    const statusFlag = i.status !== 'available'
        ? '<span class="status-flag">Indisponível</span>'
        : '';

    const delay = (index % 12) * 0.04;

    return `
    <article class="card-item" data-item-id="${i.id}" onclick="openDetail(${i.id})" 
             style="animation-delay: ${delay}s" tabindex="0" role="button" 
             aria-label="Ver detalhes de ${esc(i.title)}">
        <div class="card-media">
            ${media}
            ${favBtn}
            ${statusFlag}
            <div class="card-actions">
                ${actionButtons}
            </div>
        </div>
        <div class="info">
            ${typeTags}
            <div class="price">${priceDisplay}</div>
            <h3 class="title">${esc(i.title)}</h3>
            <div class="meta">
                <span class="owner">${owner ? esc(owner.name.split(' ')[0]) : ''}${r.count ? ` · ⭐ ${fmtAvg(r.avg)}` : ''}</span>
                <span class="views">👁 ${fmt(i.views || 0)}</span>
                ${distHtml}
            </div>
        </div>
    </article>`;
}

/**
 * Renderiza a grade de itens
 */
function renderGrid() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;

    grid.classList.remove('list-view');
    if (viewMode === 'list') {
        grid.classList.add('list-view');
    }

    const all = filteredItems();
    const shown = all.slice(0, visibleCount);
    grid.innerHTML = shown.length
        ? shown.map((item, idx) => itemCard(item, idx)).join('')
        : '<div class="empty-state">Nenhum item encontrado.</div>';

    const resultsInfo = document.getElementById('resultsInfo');
    if (resultsInfo) {
        resultsInfo.textContent = `${fmt(all.length)} itens encontrados`;
    }
}

function loadMore() {
    const all = filteredItems();
    if (visibleCount >= all.length) return;
    visibleCount += 12;
    renderGrid();
}

function setViewMode(mode) {
    viewMode = mode;
    const btnGrid = document.getElementById('btnGridView');
    const btnList = document.getElementById('btnListView');
    if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid');
    if (btnList) btnList.classList.toggle('active', mode === 'list');
    if (btnGrid) btnGrid.setAttribute('aria-pressed', String(mode === 'grid'));
    if (btnList) btnList.setAttribute('aria-pressed', String(mode === 'list'));
    renderGrid();
}

/**
 * Alterna favorito
 */
function toggleFav(itemId) {
    if (!currentUser) {
        openAuth('login');
        return;
    }
    if (!Array.isArray(currentUser.favs)) currentUser.favs = [];
    const idx = currentUser.favs.indexOf(itemId);
    if (idx >= 0) {
        currentUser.favs.splice(idx, 1);
    } else {
        currentUser.favs.push(itemId);
    }
    save();
    renderGrid();
    const profileSection = document.getElementById('sec-profile');
    if (profileSection && !profileSection.classList.contains('hidden')) {
        renderProfile();
    }
}

function openSellModal() {
    if (!currentUser) {
        openAuth('login');
        return;
    }
    editingItemId = null;
    document.getElementById('itmHeading').textContent = 'Publicar item';
    document.getElementById('fTitle').value = '';
    document.getElementById('fDesc').value = '';
    document.getElementById('fPrice').value = 50;
    document.getElementById('fType').value = 'both';
    document.getElementById('fImg').value = '';
    document.getElementById('fImgFile').value = '';
    const imagePreview = document.getElementById('imagePreview');
    if (imagePreview) imagePreview.style.display = 'none';
    document.getElementById('fLocation').value = '';
    document.getElementById('fLat').value = '';
    document.getElementById('fLng').value = '';
    onTypeChange();
    openModal('itemModal');

    if (!mapInstance) {
        try {
            const center = getUserLocationFilter();
            mapInstance = L.map('map').setView([center.lat, center.lng], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapInstance);
            mapInstance.on('click', function(e) {
                document.getElementById('fLat').value = e.latlng.lat;
                document.getElementById('fLng').value = e.latlng.lng;
            });
        } catch (error) {
            console.error('Erro ao inicializar mapa:', error);
            showToast('Erro ao carregar mapa.', 'error');
        }
    }
}

function editItem(id) {
    const i = getItem(id);
    if (!i || i.ownerId !== currentUser?.id) return;

    editingItemId = id;
    document.getElementById('itmHeading').textContent = 'Editar item';
    document.getElementById('fTitle').value = i.title || '';
    document.getElementById('fDesc').value = i.desc || '';
    document.getElementById('fPrice').value = i.price || 0;
    document.getElementById('fType').value = i.type || 'both';
    document.getElementById('fCat').value = i.category || CATEGORIES[0];
    document.getElementById('fCond').value = i.condition || 'usado';
    document.getElementById('fImg').value = i.image || '';
    document.getElementById('fLocation').value = i.location || '';
    document.getElementById('fLat').value = i.lat || '';
    document.getElementById('fLng').value = i.lng || '';
    onTypeChange();
    openModal('itemModal');

    if (mapInstance && i.lat && i.lng) {
        mapInstance.setView([i.lat, i.lng], 12);
    }
}

function onTypeChange() {
    const type = document.getElementById('fType').value;
    const priceGroup = document.getElementById('priceGroup');
    if (priceGroup) {
        priceGroup.style.display = type === 'trade' ? 'none' : '';
    }
    // Atualiza label do preço para deixar claro que são moedas
    const priceLabel = document.querySelector('#priceGroup label');
    if (priceLabel) priceLabel.textContent = 'Preço em moedas *';
}

function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (!file.type.startsWith('image/')) {
            showToast('Formato de imagem inválido.', 'error');
            input.value = '';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showToast('Imagem muito grande (máx. 2MB).', 'error');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            const fImg = document.getElementById('fImg');
            const preview = document.getElementById('imagePreview');
            if (fImg) fImg.value = e.target.result;
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}

function getLocationFromBrowser() {
    getUserLocation()
        .then(pos => {
            document.getElementById('fLat').value = pos.lat;
            document.getElementById('fLng').value = pos.lng;
            document.getElementById('fLocation').value = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
            if (mapInstance) {
                mapInstance.setView([pos.lat, pos.lng], 14);
                L.marker([pos.lat, pos.lng]).addTo(mapInstance);
            }
        })
        .catch(err => showToast('Erro ao obter localização: ' + err.message, 'error'));
}

function saveItem(ev) {
    ev.preventDefault();
    if (!currentUser) return;

    const titleInput = document.getElementById('fTitle');
    const descInput = document.getElementById('fDesc');
    const priceInput = document.getElementById('fPrice');
    const typeSelect = document.getElementById('fType');
    const catSelect = document.getElementById('fCat');
    const condSelect = document.getElementById('fCond');
    const imgInput = document.getElementById('fImg');
    const latInput = document.getElementById('fLat');
    const lngInput = document.getElementById('fLng');
    const locInput = document.getElementById('fLocation');

    if (!titleInput || !typeSelect || !priceInput) return;

    const title = titleInput.value.trim();
    const type = typeSelect.value;
    const price = type === 'trade' ? 0 : parseInt(priceInput.value) || 0;

    if (title.length < 3) {
        setAlert('itmAlert', 'Título muito curto (mín. 3 caracteres).');
        titleInput.focus();
        return;
    }
    if (type !== 'trade' && price <= 0) {
        setAlert('itmAlert', 'Informe um preço válido.');
        priceInput.focus();
        return;
    }

    const data = {
        title,
        desc: descInput ? descInput.value.trim() : '',
        category: catSelect ? catSelect.value : CATEGORIES[0],
        condition: condSelect ? condSelect.value : 'usado',
        type,
        price,
        acceptTrades: type !== 'sale',
        image: imgInput ? imgInput.value.trim() : '',
        lat: parseFloat(latInput?.value) || null,
        lng: parseFloat(lngInput?.value) || null,
        location: locInput ? locInput.value.trim() || null : null
    };

    try {
        if (editingItemId) {
            const old = getItem(editingItemId);
            if (old) {
                if (old.price !== price) {
                    if (!old.priceHistory) old.priceHistory = [];
                    old.priceHistory.push({ price: old.price, ts: Date.now() });
                }
                Object.assign(old, data);
                showToast('Anúncio atualizado.', 'success');
            }
        } else {
            const newItem = {
                id: nextId(),
                ownerId: currentUser.id,
                status: 'available',
                views: 0,
                createdAt: Date.now(),
                priceHistory: [],
                ...data
            };
            DB.items.push(newItem);
            if (!currentUser.stats) currentUser.stats = {};
            currentUser.stats.itemsPublished = (currentUser.stats.itemsPublished || 0) + 1;
            showToast('Item publicado.', 'success');
        }
        save();
        closeModal('itemModal');
        renderGrid();
        const profileSection = document.getElementById('sec-profile');
        if (profileSection && !profileSection.classList.contains('hidden')) {
            renderProfile();
        }
    } catch (error) {
        console.error('Erro ao salvar item:', error);
        showToast('Erro ao salvar item.', 'error');
    }
}

/**
 * Modal de detalhe – layout em duas colunas (estilo ML)
 */
function openDetail(itemId) {
    const item = getItem(itemId);
    if (!item) return;
    const owner = getUser(item.ownerId);
    const r = ownerRating(item.ownerId);
    const img = safeImageUrl(item.image);
    const media = img
        ? `<img src="${img}" alt="${esc(item.title)}" class="detail-image">`
        : `<div class="image-placeholder" style="font-size:4rem;height:280px;display:flex;align-items:center;justify-content:center;">${CAT_ICONS[item.category] || '📦'}</div>`;

    // Distância / localização
    let distText = 'Localização não informada';
    if (item.lat && item.lng) {
        const center = getUserLocationFilter();
        const dist = distance(center.lat, center.lng, item.lat, item.lng);
        if (dist !== null && !isNaN(dist)) {
            distText = `${dist.toFixed(1)} km`;
        }
        if (item.location) {
            distText += ` · ${esc(item.location)}`;
        }
    }

    // Tags
    const typeTags =
        (item.price > 0 && item.type !== 'trade' ? '<span class="mini-tag sale">Moedas</span> ' : '') +
        (item.acceptTrades ? '<span class="mini-tag trade">Troca de item</span>' : '');

    // Preço em moedas (sem R$)
    const priceHtml = item.price > 0 && item.type !== 'trade'
        ? `<div class="detail-price">🪙 ${fmt(item.price)} <span class="fs-sm" style="font-weight:500;opacity:0.8">moedas</span></div>`
        : `<div class="detail-price"><span class="trade-badge">🔄 Somente troca de item</span></div>`;

    // Botões de ação
    let actionButtons = '';
    if (currentUser && item.ownerId !== currentUser.id && item.status === 'available') {
        if (item.price > 0 && item.type !== 'trade') {
            actionButtons += `<button class="btn btn-warning" onclick="buyWithCoins(${item.id})">🪙 Adquirir por ${fmt(item.price)} moedas</button>`;
        }
        if (item.acceptTrades) {
            actionButtons += `<button class="btn btn-secondary" onclick="openTradeProposal(${item.id})">🔄 Propor troca de item</button>`;
        }
        actionButtons += `<button class="btn" onclick="openChat(${item.ownerId})">💬 Conversar</button>`;
        actionButtons += `<button class="btn btn-danger" onclick="openDenounce(${item.id})">Denunciar</button>`;
    } else if (!currentUser) {
        actionButtons = `<button class="btn" onclick="openAuth('login')">Entre para negociar</button>`;
    } else if (item.ownerId === currentUser.id) {
        actionButtons = `<button class="btn btn-secondary" onclick="editItem(${item.id})">✏️ Editar</button>`;
        if (item.status === 'available') {
            actionButtons += `<button class="btn btn-danger" onclick="askConfirm('Excluir item', 'Deseja excluir este anúncio?', () => deleteItem(${item.id}))">Excluir</button>`;
        }
    }

    const detailContent = document.getElementById('detailContent');
    if (!detailContent) return;

    detailContent.innerHTML = `
        <button class="close-modal" onclick="closeModal('detailModal')" aria-label="Fechar detalhes" type="button">×</button>
        <div class="modal-detail-body">
            <div class="modal-detail-left">
                <div class="detail-media">${media}</div>
            </div>
            <div class="modal-detail-right">
                <div>${typeTags}</div>
                <h2 class="detail-title">${esc(item.title)}</h2>
                ${priceHtml}
                <div class="detail-meta">
                    <span>${CONDITIONS[item.condition] || item.condition}</span>
                    <span>${CAT_ICONS[item.category] || '📦'} ${esc(item.category)}</span>
                    <span>👁 ${fmt(item.views || 0)} visualizações</span>
                    <span>📍 ${distText}</span>
                </div>
                <p class="detail-desc" style="color:var(--text-light);font-size:0.95rem;line-height:1.55;margin-bottom:0.75rem;">
                    ${esc(item.desc) || 'Sem descrição.'}
                </p>
                <div class="detail-owner">
                    <div class="user-avatar">${owner ? esc(owner.name.charAt(0).toUpperCase()) : '?'}</div>
                    <div>
                        <div class="fw-bold">${owner ? esc(owner.name) : 'Usuário'}</div>
                        <div class="fs-sm text-muted">
                            ${r.count ? `⭐ ${fmtAvg(r.avg)} · ${r.count} avaliações` : 'Sem avaliações'}
                        </div>
                    </div>
                </div>
                <div class="detail-actions">${actionButtons}</div>
            </div>
        </div>
    `;

    item.views = (item.views || 0) + 1;
    save();
    openModal('detailModal');
}

function deleteItem(itemId) {
    const item = getItem(itemId);
    if (!item || item.ownerId !== currentUser?.id) return;
    DB.items = DB.items.filter(i => i.id !== itemId);
    save();
    closeModal('detailModal');
    renderGrid();
    const profileSection = document.getElementById('sec-profile');
    if (profileSection && !profileSection.classList.contains('hidden')) {
        renderProfile();
    }
    showToast('Anúncio excluído.', 'warning');
}


/**
 * GPS no formulário de cadastro
 */
function getRegLocationFromGPS() {
    if (!navigator.geolocation) {
        showToast('Geolocalização não suportada neste navegador.', 'error');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            document.getElementById('rgLat').value = lat;
            document.getElementById('rgLng').value = lng;
            try {
                if (typeof reverseGeocode === 'function') {
                    const name = await reverseGeocode(lat, lng);
                    document.getElementById('rgLocation').value = name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                } else {
                    document.getElementById('rgLocation').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                }
                showToast('Localização definida.', 'success');
            } catch {
                document.getElementById('rgLocation').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }
        },
        () => showToast('Não foi possível obter sua localização.', 'error'),
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function openDenounce(itemId) {
    const item = getItem(itemId);
    if (!item) return;
    denounceItemId = itemId;
    const targetEl = document.getElementById('denounceTarget');
    if (targetEl) targetEl.textContent = `"${item.title}"`;
    const reasonSelect = document.getElementById('denounceReason');
    if (reasonSelect) reasonSelect.value = 'fraude';
    const commentInput = document.getElementById('denounceComment');
    if (commentInput) commentInput.value = '';
    openModal('denounceModal');
}

function submitDenounce() {
    if (!denounceItemId || !currentUser) return;
    const item = getItem(denounceItemId);
    if (!item) return;

    const alreadyDenounced = DB.denounces.some(d =>
        d.itemId === denounceItemId && d.reporterId === currentUser.id
    );
    if (alreadyDenounced) {
        showToast('Você já denunciou este item.', 'warning');
        closeModal('denounceModal');
        return;
    }

    const reasonSelect = document.getElementById('denounceReason');
    const commentInput = document.getElementById('denounceComment');
    if (!reasonSelect) return;

    DB.denounces.push({
        id: nextId(),
        itemId: denounceItemId,
        reporterId: currentUser.id,
        reason: reasonSelect.value,
        comment: commentInput ? commentInput.value.trim() : '',
        createdAt: Date.now()
    });
    save();
    closeModal('denounceModal');
    showToast('Denúncia enviada para análise.', 'info');
}