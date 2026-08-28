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
 * Gera hash da senha. Tenta usar SHA-256 do Web Crypto; caso indisponível,
 * usa um hash simples (fallback) com salt fixo.
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
    // Fallback simples (djb2 com salt)
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
    // Aceita http, https ou data:image (png, jpeg, webp, gif, svg)
    if (/^(https?:\/\/[^\s]+|data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[^\s]+)$/i.test(u)) {
        return esc(u);
    }
    return '';
}

/**
 * Calcula a distância em km entre dois pontos geográficos (fórmula de Haversine).
 * @param {number} lat1 - Latitude do ponto 1
 * @param {number} lon1 - Longitude do ponto 1
 * @param {number} lat2 - Latitude do ponto 2
 * @param {number} lon2 - Longitude do ponto 2
 * @returns {number|null} Distância em km ou null se parâmetros inválidos
 */
function distance(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const valid = [lat1, lon1, lat2, lon2].every(v => typeof v === 'number' && Number.isFinite(v));
    if (!valid) return null;

    const R = 6371; // raio médio da Terra em km
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
 * Obtém a localização do usuário via Geolocation API.
 * @returns {Promise<{lat: number, lng: number}>} Coordenadas
 */
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocalização não suportada pelo navegador.');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => {
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        reject('Permissão de localização negada.');
                        break;
                    case err.POSITION_UNAVAILABLE:
                        reject('Localização indisponível.');
                        break;
                    case err.TIMEOUT:
                        reject('Tempo esgotado ao obter localização.');
                        break;
                    default:
                        reject('Erro ao obter localização.');
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    });
}

/**
 * Geocodifica um endereço usando Nominatim (OpenStreetMap).
 * @param {string} address - Endereço ou cidade
 * @returns {Promise<{lat: number, lng: number, name: string}|null>}
 */
async function geocodeAddress(address) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Erro na geocodificação');
        const data = await response.json();
        if (data && data.length > 0) {
            const r = data[0];
            return {
                lat: parseFloat(r.lat),
                lng: parseFloat(r.lon),
                name: r.display_name || address
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
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string|null>}
 */
async function reverseGeocode(lat, lng) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
        const response = await fetch(url);
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
 * @param {string} id - ID do elemento
 * @returns {HTMLElement|null} Elemento ou null
 */
function $id(id) {
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
}