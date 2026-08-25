// Utilitários gerais
function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function norm(s) { return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function fmt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
function fmtAvg(n) { return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits:1, maximumFractionDigits:1 }); }
function plural(n, one, many) { return n === 1 ? one : many; }
function todayStr() { return new Date().toISOString().slice(0,10); }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('pt-BR'); }
function fmtDateTime(ts) { return new Date(ts).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' }); }

async function hashPassword(pw) {
    try {
        if (window.crypto && crypto.subtle) {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('escamboxx:' + pw));
            return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
        }
    } catch(e) {}
    let h = 5381;
    for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) >>> 0;
    return 'fb_' + h.toString(16);
}

function safeImageUrl(url) {
    const u = String(url || '').trim();
    return /^(https?:\/\/\S+|data:image\/\S+)$/i.test(u) ? esc(u) : '';
}

function distance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocalização não suportada');
        } else {
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                err => reject(err.message)
            );
        }
    });
}
