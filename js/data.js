// Camada de dados e armazenamento
const SCHEMA_VERSION = 'v6';
const KEYS = {
    users:'exUsers', items:'exItems', trades:'exTrades', ledger:'exLedger',
    seq:'exSeq', session:'exCurrentUser', theme:'exTheme', ver:'exVer',
    chats:'exChats', denounces:'exDenounces'
};

let DB = { users:[], items:[], trades:[], ledger:[], chats:[], denounces:[] };
let seq = 1000;
let currentUser = null;

// Imagens de exemplo (URLs do Unsplash)
const SAMPLE_IMAGES = [
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80'
];

function nextId() { seq++; localStorage.setItem(KEYS.seq, String(seq)); return seq; }
function save() {
    localStorage.setItem(KEYS.users, JSON.stringify(DB.users));
    localStorage.setItem(KEYS.items, JSON.stringify(DB.items));
    localStorage.setItem(KEYS.trades, JSON.stringify(DB.trades));
    localStorage.setItem(KEYS.ledger, JSON.stringify(DB.ledger));
    localStorage.setItem(KEYS.chats, JSON.stringify(DB.chats));
    localStorage.setItem(KEYS.denounces, JSON.stringify(DB.denounces));
}

function getUser(id) { return DB.users.find(u => u.id === Number(id)); }
function getItem(id) { return DB.items.find(i => i.id === Number(id)); }

function changeCoins(user, delta, reason) {
    user.coins = Math.max(0, (Number(user.coins)||0) + delta);
    DB.ledger.push({ id: nextId(), userId: user.id, delta, reason, ts: Date.now() });
}

function notify(userId, text) {
    const u = getUser(userId);
    if (!u) return;
    u.notifications.unshift({ id: nextId(), text, read:false, ts: Date.now() });
    if (u.notifications.length > 50) u.notifications.length = 50;
}

// Seed inicial
function seed() {
    const now = Date.now();
    DB.users = [
        { id:1, name:'Maria Silva', email:'maria@example.com', passHash:'', role:'user', coins:80, createdAt:now-90*864e5,
          favs:[], notifications:[], claimed:{}, lastLoginDate:'',
          stats:{ logins:12, sales:2, barters:1, itemsPublished:3, ratingsReceived:2 },
          ratings:[{by:2,stars:5,comment:'Ótima vendedora!',ts:now-10*864e5},{by:3,stars:4,comment:'Muito atenciosa.',ts:now-5*864e5}] },
        { id:2, name:'João Souza', email:'joao@example.com', passHash:'', role:'user', coins:45, createdAt:now-60*864e5,
          favs:[], notifications:[], claimed:{}, lastLoginDate:'',
          stats:{ logins:8, sales:1, barters:1, itemsPublished:2, ratingsReceived:1 },
          ratings:[{by:1,stars:5,comment:'Troca justa.',ts:now-9*864e5}] },
        { id:3, name:'Ana Lima', email:'ana@example.com', passHash:'', role:'user', coins:120, createdAt:now-30*864e5,
          favs:[], notifications:[], claimed:{}, lastLoginDate:'',
          stats:{ logins:5, sales:0, barters:0, itemsPublished:1, ratingsReceived:1 },
          ratings:[{by:1,stars:4,comment:'Recomendo.',ts:now-4*864e5}] },
        { id:999, name:'Admin', email:'admin@example.com', passHash:'', role:'admin', coins:9999, createdAt:now,
          favs:[], notifications:[], claimed:{}, lastLoginDate:'',
          stats:{ logins:1, sales:0, barters:0, itemsPublished:0, ratingsReceived:0 }, ratings:[] }
    ];
    DB.items = [
        { id:101, ownerId:1, title:'iPhone 11 64GB', desc:'Bateria 89%, com capinha e película.', category:'Eletrônicos', condition:'seminovo', type:'both', price:450, acceptTrades:true, image:SAMPLE_IMAGES[8], status:'available', views:34, createdAt:now-20*864e5, priceHistory:[], lat:-23.5505, lng:-46.6333, location:'São Paulo, SP' },
        { id:102, ownerId:2, title:'Dom Casmurro – Machado de Assis', desc:'Edição de bolso, pouco uso.', category:'Livros', condition:'usado', type:'trade', price:0, acceptTrades:true, image:SAMPLE_IMAGES[0], status:'available', views:12, createdAt:now-15*864e5, priceHistory:[], lat:-23.5614, lng:-46.6559, location:'São Paulo, SP' },
        { id:103, ownerId:3, title:'Jaqueta jeans tamanho M', desc:'Nova sem etiqueta.', category:'Roupas', condition:'novo', type:'sale', price:60, acceptTrades:false, image:SAMPLE_IMAGES[4], status:'available', views:21, createdAt:now-7*864e5, priceHistory:[], lat:-23.5400, lng:-46.6300, location:'São Paulo, SP' },
        { id:104, ownerId:1, title:'Cafeteira italiana 6 xícaras', desc:'Moka pot em inox.', category:'Casa', condition:'seminovo', type:'both', price:35, acceptTrades:true, image:SAMPLE_IMAGES[1], status:'available', views:9, createdAt:now-3*864e5, priceHistory:[], lat:-23.5550, lng:-46.6400, location:'São Paulo, SP' },
        { id:105, ownerId:2, title:'Fone Bluetooth TWS', desc:'Autonomia de 5h, case incluso.', category:'Eletrônicos', condition:'novo', type:'sale', price:75, acceptTrades:false, image:SAMPLE_IMAGES[3], status:'available', views:48, createdAt:now-864e5, priceHistory:[], lat:-23.5450, lng:-46.6200, location:'São Paulo, SP' },
        { id:106, ownerId:3, title:'Câmera DSLR Canon', desc:'Pouco uso, lente 18-55mm.', category:'Eletrônicos', condition:'usado', type:'both', price:300, acceptTrades:true, image:SAMPLE_IMAGES[5], status:'available', views:67, createdAt:now-12*864e5, priceHistory:[], lat:-23.5700, lng:-46.6600, location:'São Paulo, SP' }
    ];
    DB.trades = [];
    DB.ledger = [];
    DB.chats = [];
    DB.denounces = [];
}

async function initPasswords() {
    for (const u of DB.users) {
        if (!u.passHash) {
            const pw = u.role === 'admin' ? 'admin123' : '123';
            u.passHash = await hashPassword(pw);
        }
    }
}

function loadData() {
    const ver = localStorage.getItem(KEYS.ver);
    if (ver !== SCHEMA_VERSION) {
        seed();
        localStorage.setItem(KEYS.ver, SCHEMA_VERSION);
        save();
        return true;
    }
    DB.users = JSON.parse(localStorage.getItem(KEYS.users)) || [];
    DB.items = JSON.parse(localStorage.getItem(KEYS.items)) || [];
    DB.trades = JSON.parse(localStorage.getItem(KEYS.trades)) || [];
    DB.ledger = JSON.parse(localStorage.getItem(KEYS.ledger)) || [];
    DB.chats = JSON.parse(localStorage.getItem(KEYS.chats)) || [];
    DB.denounces = JSON.parse(localStorage.getItem(KEYS.denounces)) || [];
    seq = parseInt(localStorage.getItem(KEYS.seq), 10) || 1000;
    return false;
}