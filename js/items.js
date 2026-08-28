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
let denounceItemId = null; // ID do item sendo denunciado
let searchLocation = null; // { lat, lng, name } ou null para usar localização padrão

// Variáveis para o mapa de seleção de local
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

/**
 * Preenche o select de categorias no formulário de item.
 */
function populateFormSelects() {
    const sel = document.getElementById('fCat');
    if (!sel) return;
    sel.innerHTML = CATEGORIES.map(c =>
        `<option value="${c}">${CAT_ICONS[c]} ${c}</option>`
    ).join('');
}

/**
 * Atualiza um filtro específico e re-renderiza a grade.
 * @param {string} key - Nome do filtro
 * @param {string|number} value - Valor do filtro
 */
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
    if (key === 'category') renderChips(); // Atualiza chips quando categoria muda
}

/**
 * Atalho para definir ordenação.
 * @param {string} value - Valor da ordenação
 */
function setSort(value) {
    setFilter('sort', value);
}

/**
 * Atalho para definir raio de distância.
 * @param {string} value - Raio em km
 */
function setRadius(value) {
    setFilter('radius', value);
}

/**
 * Executa a busca com base no campo de busca.
 */
function handleSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    filters.q = input.value;
    visibleCount = 12;
    renderGrid();
}

let searchTimer;
/**
 * Busca com debounce (300ms).
 */
function debouncedSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(handleSearch, 300);
}

/**
 * Calcula a média de avaliações de um usuário.
 * @param {number} ownerId - ID do usuário
 * @returns {{avg: number, count: number}} Média e contagem
 */
function ownerRating(ownerId) {
    const u = getUser(ownerId);
    if (!u || !u.ratings || u.ratings.length === 0) return { avg: 0, count: 0 };
    const sum = u.ratings.reduce((a, r) => a + (r.stars || 0), 0);
    return { avg: sum / u.ratings.length, count: u.ratings.length };
}

/**
 * Obtém a localização de referência para filtro de distância.
 * Prioridade: local de busca definido > localização do usuário > São Paulo.
 * @returns {{lat: number, lng: number}}
 */
function getUserLocationFilter() {
    // 1. Se houver local de busca definido pelo usuário, usa ele
    if (searchLocation && typeof searchLocation.lat === 'number' && typeof searchLocation.lng === 'number') {
        return { lat: searchLocation.lat, lng: searchLocation.lng };
    }
    // 2. Caso contrário, usa a localização do usuário logado (se tiver)
    if (currentUser && typeof currentUser.lat === 'number' && typeof currentUser.lng === 'number') {
        return { lat: currentUser.lat, lng: currentUser.lng };
    }
    // 3. Fallback: São Paulo
    return { lat: -23.5505, lng: -46.6333 };
}

/**
 * Define a localização de busca manualmente.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} name - Nome descritivo (ex: "São Paulo, SP")
 */
function setSearchLocation(lat, lng, name) {
    searchLocation = { lat, lng, name };
    const display = document.getElementById('selectedLocationDisplay');
    if (display) {
        display.textContent = name || `Localização: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    visibleCount = 12;
    renderGrid();
}

/**
 * Limpa a localização de busca, voltando ao padrão (usuário ou SP).
 */
function clearSearchLocation() {
    searchLocation = null;
    const display = document.getElementById('selectedLocationDisplay');
    if (display) display.textContent = '';
    const input = document.getElementById('searchLocationInput');
    if (input) input.value = '';
    visibleCount = 12;
    renderGrid();
}

/**
 * Busca endereço digitado e define como local de busca.
 */
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

/**
 * Usa a localização do navegador como centro da busca.
 */
function useMyLocation() {
    getUserLocation()
        .then(pos => {
            setSearchLocation(pos.lat, pos.lng, 'Minha localização');
            const input = document.getElementById('searchLocationInput');
            if (input) input.value = 'Minha localização';
        })
        .catch(err => showToast('Erro ao obter localização: ' + err, 'error'));
}

/**
 * Abre o modal de mapa para selecionar local.
 */
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

/**
 * Confirma a localização selecionada no mapa.
 */
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

/**
 * Retorna a lista de itens filtrados e ordenados.
 * @returns {Array} Lista de itens
 */
function filteredItems() {
    const q = norm(filters.q);
    let list = DB.items.filter(i => i.status === 'available');

    // Filtro por texto
    if (q) {
        list = list.filter(i =>
            norm(i.title).includes(q) ||
            norm(i.desc).includes(q) ||
            norm(i.category).includes(q)
        );
    }

    // Filtro por categoria
    if (filters.category !== 'all') {
        list = list.filter(i => i.category === filters.category);
    }

    // Filtro por tipo
    if (filters.type !== 'all') {
        list = list.filter(i =>
            filters.type === 'sale' ? i.price > 0 : i.acceptTrades
        );
    }

    // Filtro por condição
    if (filters.condition !== 'all') {
        list = list.filter(i => i.condition === filters.condition);
    }

    // Filtro por preço
    if (filters.minPrice > 0) {
        list = list.filter(i => i.price >= filters.minPrice);
    }
    if (filters.maxPrice !== Infinity) {
        list = list.filter(i => i.price <= filters.maxPrice);
    }

    // Filtro por distância (usa a localização de referência)
    if (filters.radius > 0) {
        const center = getUserLocationFilter();
        list = list.filter(i => {
            if (!i.lat || !i.lng) return false;
            const d = distance(center.lat, center.lng, i.lat, i.lng);
            return d !== null && d <= filters.radius;
        });
    }

    // Ordenação
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

/**
 * Renderiza os chips de categoria.
 */
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

/**
 * Define a categoria selecionada e re-renderiza.
 * @param {string} c - Categoria
 */
function setCategory(c) {
    filters.category = c;
    visibleCount = 12;
    renderChips();
    renderGrid();
}

/**
 * Gera o HTML de um card de item.
 * @param {Object} i - Item
 * @returns {string} HTML do card
 */
function itemCard(i) {
    const owner = getUser(i.ownerId);
    const r = ownerRating(i.ownerId);
    const img = safeImageUrl(i.image);
    const media = img
        ? `<img class="item-image" src="${img}" alt="${esc(i.title)}" loading="lazy">`
        : `<div class="image-placeholder">${CAT_ICONS[i.category] || '📦'}</div>`;

    const typeTags = (i.price > 0 && i.type !== 'trade' ? '<span class="mini-tag sale">Venda</span>' : '') +
                     (i.acceptTrades ? '<span class="mini-tag trade">Troca</span>' : '');

    let distHtml = '';
    if (i.lat && i.lng) {
        const center = getUserLocationFilter();
        const dist = distance(center.lat, center.lng, i.lat, i.lng);
        if (dist !== null && !isNaN(dist)) {
            distHtml = `<span>· ${dist.toFixed(1)} km</span>`;
        }
        if (i.location) {
            distHtml += `<span>· 📍 ${esc(i.location)}</span>`;
        }
    }

    const isFav = currentUser?.favs?.includes(i.id) || false;
    const favBtn = currentUser
        ? `<button class="fav-btn" onclick="event.stopPropagation(); toggleFav(${i.id})" 
                   aria-label="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
            ${isFav ? '❤️' : '🤍'}
        </button>`
        : '';

    const statusFlag = i.status !== 'available' ? '<span class="status-flag">Indisponível</span>' : '';

    return `
    <article class="card-item" onclick="openDetail(${i.id})" tabindex="0" role="button" aria-label="Ver detalhes de ${esc(i.title)}">
        <div class="card-media">
            ${media}
            ${favBtn}
            ${statusFlag}
        </div>
        <div class="info">
            <div class="price">${i.price > 0 ? `R$ ${fmt(i.price)}` : 'Troca'}</div>
            <h3 class="title">${esc(i.title)}</h3>
            <div class="tag-row">${typeTags}<span class="mini-tag">${CONDITIONS[i.condition] || i.condition}</span></div>
            <div class="meta">
                <span>${owner ? esc(owner.name.split(' ')[0]) : ''} ${r.count ? `⭐ ${fmtAvg(r.avg)}` : ''}</span>
                <span>👁 ${fmt(i.views || 0)}</span>
                ${distHtml}
            </div>
        </div>
    </article>`;
}

/**
 * Renderiza a grade de itens de acordo com filtros e modo de visualização.
 */
function renderGrid() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;

    // Preserva a classe base 'grid' e alterna entre 'grid' e 'list-view'
    grid.classList.remove('list-view');
    if (viewMode === 'list') {
        grid.classList.add('list-view');
    }

    const all = filteredItems();
    const shown = all.slice(0, visibleCount);
    grid.innerHTML = shown.length
        ? shown.map(itemCard).join('')
        : '<div class="empty-state">Nenhum item encontrado.</div>';

    const resultsInfo = document.getElementById('resultsInfo');
    if (resultsInfo) {
        resultsInfo.textContent = `${fmt(all.length)} itens encontrados`;
    }
}

/**
 * Carrega mais itens (scroll infinito).
 */
function loadMore() {
    const all = filteredItems();
    if (visibleCount >= all.length) return; // Não carrega se já mostrou tudo
    visibleCount += 12;
    renderGrid();
}

/**
 * Altera o modo de visualização (grade ou lista).
 * @param {string} mode - 'grid' ou 'list'
 */
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
 * Alterna o status de favorito de um item para o usuário logado.
 * @param {number} itemId - ID do item
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

/**
 * Abre o modal de publicação/edição de item.
 */
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

    // Inicializa mapa Leaflet se ainda não existir
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

/**
 * Preenche o formulário para editar um item existente.
 * @param {number} id - ID do item
 */
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

/**
 * Mostra/oculta o campo de preço conforme o tipo de negociação.
 */
function onTypeChange() {
    const type = document.getElementById('fType').value;
    const priceGroup = document.getElementById('priceGroup');
    if (priceGroup) {
        priceGroup.style.display = type === 'trade' ? 'none' : '';
    }
}

/**
 * Lida com upload de imagem, convertendo para Data URL.
 * @param {HTMLInputElement} input - Input de arquivo
 */
function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        // Valida tipo e tamanho (máx. 2MB)
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

/**
 * Obtém a localização do navegador e preenche os campos.
 */
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

/**
 * Salva um item (criação ou edição).
 * @param {Event} ev - Evento de submit
 */
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
 * Abre o modal de detalhes do item.
 * @param {number} itemId - ID do item
 */
function openDetail(itemId) {
    const item = getItem(itemId);
    if (!item) return;
    const owner = getUser(item.ownerId);
    const r = ownerRating(item.ownerId);
    const img = safeImageUrl(item.image);
    const media = img
        ? `<img src="${img}" alt="${esc(item.title)}" class="detail-image">`
        : `<div class="image-placeholder">${CAT_ICONS[item.category] || '📦'}</div>`;

    let distText = 'Localização não informada';
    if (item.lat && item.lng) {
        const center = getUserLocationFilter();
        const dist = distance(center.lat, center.lng, item.lat, item.lng);
        if (dist !== null && !isNaN(dist)) {
            distText = `${dist.toFixed(1)} km`;
        }
        if (item.location) {
            distText += ` (${esc(item.location)})`;
        }
    }

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

    const detailContent = document.getElementById('detailContent');
    if (!detailContent) return;
    detailContent.innerHTML = `
        <button class="close-modal" onclick="closeModal('detailModal')" aria-label="Fechar detalhes">×</button>
        <div class="detail-media">${media}</div>
        <h2 class="detail-title">${esc(item.title)}</h2>
        <div class="detail-meta">
            <span>${item.price > 0 ? 'R$ ' + fmt(item.price) : 'Troca'}</span>
            <span>${CONDITIONS[item.condition] || item.condition}</span>
            <span>${CAT_ICONS[item.category] || '📦'} ${esc(item.category)}</span>
            <span>👁 ${fmt(item.views || 0)}</span>
            <span>📍 ${distText}</span>
        </div>
        <p class="detail-desc">${esc(item.desc) || 'Sem descrição.'}</p>
        <div class="detail-owner">
            <div class="user-avatar">${owner ? esc(owner.name.charAt(0)) : '?'}</div>
            <div>
                <strong>${owner ? esc(owner.name) : 'Usuário'}</strong>
                ${r.count ? `<span>⭐ ${fmtAvg(r.avg)} (${r.count})</span>` : '<span>Sem avaliações</span>'}
            </div>
        </div>
        <div class="detail-actions">${actionButtons}</div>
    `;

    item.views = (item.views || 0) + 1;
    save();
    openModal('detailModal');
}

/**
 * Exclui um item do usuário logado.
 * @param {number} itemId - ID do item
 */
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
 * Abre o modal de denúncia para um item.
 * @param {number} itemId - ID do item
 */
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

/**
 * Envia a denúncia do item.
 */
function submitDenounce() {
    if (!denounceItemId || !currentUser) return;
    const item = getItem(denounceItemId);
    if (!item) return;

    // Verifica se o usuário já denunciou este item
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