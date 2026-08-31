'use strict';

// Utilitários gerais

/**
 * Escapa strings para uso seguro em HTML.
 * @param {*} s - Valor a escapar
 * @returns {string} String escapada
 */
function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Normaliza string: remove acentos, converte para minúsculas e trim.
 * @param {*} s - Valor a normalizar
 * @returns {string} String normalizada
 */
function norm(s) {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Formata número com separador de milhar pt-BR.
 * @param {number} n - Número
 * @returns {string} Número formatado
 */
function fmt(n) {
    const num = Number(n) || 0;
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString('pt-BR');
}

/**
 * Formata média com uma casa decimal.
 * @param {number} n - Número
 * @returns {string} Média formatada
 */
function fmtAvg(n) {
    const num = Number(n) || 0;
    if (!Number.isFinite(num)) return '0,0';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Retorna o plural correto.
 * @param {number} n - Quantidade
 * @param {string} one - Singular
 * @param {string} many - Plural
 * @returns {string} Palavra no singular ou plural
 */
function plural(n, one, many) {
    return n === 1 ? one : many;
}

/**
 * Retorna a data de hoje no formato YYYY-MM-DD (fuso local).
 * @returns {string} Data local
 */
function todayStr() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formata timestamp para data curta pt-BR.
 * @param {number} ts - Timestamp
 * @returns {string} Data formatada
 */
function fmtDate(ts) {
    if (!ts) return '';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(ts));
}

/**
 * Formata timestamp para data e hora curtas pt-BR.
 * @param {number} ts - Timestamp
 * @returns {string} Data e hora formatadas
 */
function fmtDateTime(ts) {
    if (!ts) return '';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts));
}

/**
 * Tempo relativo amigável (ex.: "há 2 dias", "há 5 horas")
 * @param {number} ts - Timestamp
 * @returns {string}
 */
function fmtRelative(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'agora';
    const min = Math.floor(sec / 60);
    if (min < 60) return `há ${min} ${plural(min, 'minuto', 'minutos')}`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h} ${plural(h, 'hora', 'horas')}`;
    const d = Math.floor(h / 24);
    if (d < 30) return `há ${d} ${plural(d, 'dia', 'dias')}`;
    return fmtDate(ts);
}

/**
 * Gera hash da senha. Tenta SHA-256; fallback djb2 com salt.
 * @param {string} pw - Senha
 * @returns {Promise<string>} Hash da senha
 */
async function hashPassword(pw) {
    if (typeof pw !== 'string') pw = String(pw ?? '');
    try {
        if (window.crypto && crypto.subtle) {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('escamboxx:' + pw));
            return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch (e) {
        console.warn('Web Crypto indisponível, usando fallback.', e);
    }
    let h = 5381;
    for (let i = 0; i < pw.length; i++) {
        h = ((h << 5) + h + pw.charCodeAt(i)) >>> 0;
    }
    return 'fb_' + h.toString(16);
}

/**
 * Valida e retorna URL segura de imagem (http/https/data:image).
 * @param {string} url - URL da imagem
 * @returns {string} URL escapada ou vazio se inválida
 */
function safeImageUrl(url) {
    const u = String(url || '').trim();
    if (/^(https?:\/\/[^\s]+|data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[^\s]+)$/i.test(u)) {
        return esc(u);
    }
    return '';
}

/**
 * Distância em km (Haversine).
 * @returns {number|null}
 */
function distance(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const valid = [lat1, lon1, lat2, lon2].every(v => typeof v === 'number' && Number.isFinite(v));
    if (!valid) return null;

    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Geolocalização do navegador.
 * @returns {Promise<{lat: number, lng: number}>}
 */
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocalização não suportada pelo navegador.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => {
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        reject(new Error('Permissão de localização negada.'));
                        break;
                    case err.POSITION_UNAVAILABLE:
                        reject(new Error('Localização indisponível.'));
                        break;
                    case err.TIMEOUT:
                        reject(new Error('Tempo esgotado ao obter localização.'));
                        break;
                    default:
                        reject(new Error('Erro ao obter localização.'));
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    });
}

/**
 * Headers recomendados pelo Nominatim (uso justo da API).
 */
function nominatimHeaders() {
    return {
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9'
    };
}

/**
 * Geocodifica endereço (Nominatim / OpenStreetMap).
 * @param {string} address
 * @returns {Promise<{lat: number, lng: number, name: string}|null>}
 */
async function geocodeAddress(address) {
    try {
        const q = String(address || '').trim();
        if (!q) return null;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=br`;
        const response = await fetch(url, { headers: nominatimHeaders() });
        if (!response.ok) throw new Error('Erro na geocodificação');
        const data = await response.json();
        if (data && data.length > 0) {
            const r = data[0];
            return {
                lat: parseFloat(r.lat),
                lng: parseFloat(r.lon),
                name: r.display_name || q
            };
        }
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

/**
 * Geocodificação reversa: coordenadas -> nome.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>}
 */
async function reverseGeocode(lat, lng) {
    try {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=0`;
        const response = await fetch(url, { headers: nominatimHeaders() });
        if (!response.ok) throw new Error('Erro na geocodificação reversa');
        const data = await response.json();
        return data.display_name || null;
    } catch (error) {
        console.error('Reverse geocoding error:', error);
        return null;
    }
}

/**
 * Atalho para document.getElementById.
 * @param {string} id
 * @returns {HTMLElement|null}
 */
function $id(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
}


/* ============================================================
   Autocomplete de cidades brasileiras (cidade, UF)
   ============================================================ */
const BR_CITIES = [
    'São Paulo, SP','Guarulhos, SP','Campinas, SP','São Bernardo do Campo, SP','Santo André, SP','Osasco, SP','Ribeirão Preto, SP','Sorocaba, SP','Santos, SP','São José dos Campos, SP','Mauá, SP','Diadema, SP','Carapicuíba, SP','Mogi das Cruzes, SP','Piracicaba, SP','Bauru, SP','Jundiaí, SP','Franca, SP','Praia Grande, SP','Limeira, SP',
    'Rio de Janeiro, RJ','São Gonçalo, RJ','Duque de Caxias, RJ','Nova Iguaçu, RJ','Niterói, RJ','Belford Roxo, RJ','Campos dos Goytacazes, RJ','São João de Meriti, RJ','Petrópolis, RJ','Volta Redonda, RJ','Magé, RJ','Itaboraí, RJ','Macaé, RJ','Cabo Frio, RJ',
    'Belo Horizonte, MG','Uberlândia, MG','Contagem, MG','Juiz de Fora, MG','Betim, MG','Montes Claros, MG','Ribeirão das Neves, MG','Uberaba, MG','Governador Valadares, MG','Ipatinga, MG','Sete Lagoas, MG','Divinópolis, MG','Santa Luzia, MG','Ibirité, MG','Poços de Caldas, MG',
    'Curitiba, PR','Londrina, PR','Maringá, PR','Ponta Grossa, PR','Cascavel, PR','São José dos Pinhais, PR','Foz do Iguaçu, PR','Colombo, PR','Guarapuava, PR','Paranaguá, PR','Araucária, PR','Toledo, PR','Apucarana, PR','Pinhais, PR','Campo Largo, PR','União da Vitória, PR','Paula Freitas, PR','Porto União, SC',
    'Porto Alegre, RS','Caxias do Sul, RS','Pelotas, RS','Canoas, RS','Santa Maria, RS','Gravataí, RS','Viamão, RS','Novo Hamburgo, RS','São Leopoldo, RS','Rio Grande, RS','Alvorada, RS','Passo Fundo, RS','Uruguaiana, RS','Cachoeirinha, RS','Santa Cruz do Sul, RS','Bagé, RS',
    'Salvador, BA','Feira de Santana, BA','Vitória da Conquista, BA','Camaçari, BA','Juazeiro, BA','Ilhéus, BA','Itabuna, BA','Lauro de Freitas, BA','Jequié, BA','Teixeira de Freitas, BA','Barreiras, BA','Alagoinhas, BA','Porto Seguro, BA',
    'Fortaleza, CE','Caucaia, CE','Juazeiro do Norte, CE','Maracanaú, CE','Sobral, CE','Crato, CE','Itapipoca, CE','Maranguape, CE','Iguatu, CE','Quixadá, CE',
    'Recife, PE','Jaboatão dos Guararapes, PE','Olinda, PE','Caruaru, PE','Petrolina, PE','Paulista, PE','Cabo de Santo Agostinho, PE','Camaragibe, PE','Garanhuns, PE','Vitória de Santo Antão, PE',
    'Brasília, DF','Goiânia, GO','Aparecida de Goiânia, GO','Anápolis, GO','Rio Verde, GO','Luziânia, GO','Águas Lindas de Goiás, GO','Valparaíso de Goiás, GO','Trindade, GO','Formosa, GO',
    'Belém, PA','Ananindeua, PA','Santarém, PA','Marabá, PA','Castanhal, PA','Parauapebas, PA','Abaetetuba, PA','Cametá, PA',
    'Manaus, AM','Parintins, AM','Itacoatiara, AM','Manacapuru, AM','Coari, AM',
    'Florianópolis, SC','Joinville, SC','Blumenau, SC','São José, SC','Criciúma, SC','Chapecó, SC','Itajaí, SC','Jaraguá do Sul, SC','Lages, SC','Palhoça, SC','Balneário Camboriú, SC','Brusque, SC',
    'Vitória, ES','Vila Velha, ES','Serra, ES','Cariacica, ES','Cachoeiro de Itapemirim, ES','Linhares, ES','São Mateus, ES','Guarapari, ES',
    'Natal, RN','Mossoró, RN','Parnamirim, RN','São Gonçalo do Amarante, RN','Macaíba, RN','Ceará-Mirim, RN',
    'João Pessoa, PB','Campina Grande, PB','Santa Rita, PB','Patos, PB','Bayeux, PB','Sousa, PB',
    'Maceió, AL','Arapiraca, AL','Rio Largo, AL','Palmeira dos Índios, AL',
    'Aracaju, SE','Nossa Senhora do Socorro, SE','Lagarto, SE','Itabaiana, SE',
    'São Luís, MA','Imperatriz, MA','São José de Ribamar, MA','Timon, MA','Caxias, MA','Codó, MA','Paço do Lumiar, MA',
    'Teresina, PI','Parnaíba, PI','Picos, PI','Piripiri, PI',
    'Cuiabá, MT','Várzea Grande, MT','Rondonópolis, MT','Sinop, MT','Tangará da Serra, MT','Cáceres, MT',
    'Campo Grande, MS','Dourados, MS','Três Lagoas, MS','Corumbá, MS','Ponta Porã, MS',
    'Palmas, TO','Araguaína, TO','Gurupi, TO','Porto Nacional, TO',
    'Porto Velho, RO','Ji-Paraná, RO','Ariquemes, RO','Vilhena, RO','Cacoal, RO',
    'Rio Branco, AC','Cruzeiro do Sul, AC','Sena Madureira, AC',
    'Boa Vista, RR','Rorainópolis, RR','Caracaraí, RR','Alto Alegre, RR',
    'Macapá, AP','Santana, AP','Laranjal do Jari, AP'
];

/**
 * Liga autocomplete de cidade/UF a um input.
 * @param {string|HTMLElement} inputOrId
 */
function setupCityAutocomplete(inputOrId) {
    const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
    if (!input || input.dataset.cityAc === '1') return;
    input.dataset.cityAc = '1';
    input.setAttribute('autocomplete', 'off');

    let box = document.createElement('div');
    box.className = 'city-ac-list';
    box.hidden = true;
    input.parentElement.style.position = input.parentElement.style.position || 'relative';
    input.parentElement.appendChild(box);

    let active = -1;
    let matches = [];

    function hide() {
        box.hidden = true;
        active = -1;
        matches = [];
    }

    function show(list) {
        matches = list;
        active = -1;
        if (!list.length) { hide(); return; }
        box.innerHTML = list.map((c, i) =>
            `<button type="button" class="city-ac-item" data-idx="${i}">${esc(c)}</button>`
        ).join('');
        box.hidden = false;
    }

    function pick(city) {
        input.value = city;
        hide();
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();
    }

    input.addEventListener('input', () => {
        const q = norm(input.value);
        if (q.length < 2) { hide(); return; }
        const found = BR_CITIES.filter(c => norm(c).includes(q)).slice(0, 8);
        show(found);
    });

    input.addEventListener('keydown', (e) => {
        if (box.hidden) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            active = Math.min(active + 1, matches.length - 1);
            [...box.children].forEach((el, i) => el.classList.toggle('active', i === active));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            active = Math.max(active - 1, 0);
            [...box.children].forEach((el, i) => el.classList.toggle('active', i === active));
        } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            pick(matches[active]);
        } else if (e.key === 'Escape') {
            hide();
        }
    });

    box.addEventListener('mousedown', (e) => {
        const btn = e.target.closest('.city-ac-item');
        if (!btn) return;
        e.preventDefault();
        pick(matches[parseInt(btn.dataset.idx, 10)]);
    });

    input.addEventListener('blur', () => setTimeout(hide, 150));
}

function initAllCityAutocompletes() {
    ['searchLocationInput', 'rgLocation', 'fLocation'].forEach(id => {
        if (document.getElementById(id)) setupCityAutocomplete(id);
    });
}