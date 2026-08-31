'use strict';

// Camada de dados e armazenamento
const SCHEMA_VERSION = 'v9'; // Imagens corretas + localização nos usuários
const KEYS = {
    users: 'exUsers',
    items: 'exItems',
    trades: 'exTrades',
    ledger: 'exLedger',
    seq: 'exSeq',
    session: 'exCurrentUser',
    theme: 'exTheme',
    ver: 'exVer',
    chats: 'exChats',
    denounces: 'exDenounces'
};

let DB = {
    users: [],
    items: [],
    trades: [],
    ledger: [],
    chats: [],
    denounces: []
};
let seq = 1000;
let currentUser = null;

/**
 * Imagens Unsplash alinhadas ao produto (w=400)
 * Chaves usadas no seed para facilitar manutenção
 */
const IMG = {
    iphone:     'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80',
    cafeteira:  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=400&q=80',
    violao:     'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=400&q=80',
    livro:      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=400&q=80',
    foneTws:    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80',
    skate:      'https://images.unsplash.com/photo-1547447134-cd3f5c716030?auto=format&fit=crop&w=400&q=80',
    jaqueta:    'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=400&q=80',
    camera:     'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80',
    luminaria:  'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=80',
    notebook:   'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&q=80',
    bike:       'https://images.unsplash.com/photo-1485965120186-b2719aef481c?auto=format&fit=crop&w=400&q=80',
    panelaArroz:'https://images.unsplash.com/photo-1585515320310-259814833e91?auto=format&fit=crop&w=400&q=80',
    mesaCentro: 'https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=400&q=80',
    geladeira:  'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=400&q=80',
    sofa:       'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80',
    furadeira:  'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=400&q=80',
    churrasco:  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80',
    batedeira:  'https://images.unsplash.com/photo-1570222094114-d054a817e56b?auto=format&fit=crop&w=400&q=80',
    rocadeira:  'https://images.unsplash.com/photo-1592419044706-39796d40f98c?auto=format&fit=crop&w=400&q=80',
    botas:      'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&w=400&q=80',
    aparador:   'https://images.unsplash.com/photo-1458245201577-fc8a130b8829?auto=format&fit=crop&w=400&q=80',
    tenis:      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
    oculos:     'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=400&q=80',
    relogio:    'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=400&q=80',
    mochila:    'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80',
    teclado:    'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=400&q=80',
    patinete:   'https://images.unsplash.com/photo-1604868189766-044de3a8c0f3?auto=format&fit=crop&w=400&q=80',
    foneOver:   'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
    ferramentas:'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=400&q=80',
    vestido:    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=400&q=80',
    monitor:    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=400&q=80',
    alexa:      'https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&w=400&q=80'
};

// Mantém alias para código antigo que use SAMPLE_IMAGES
const SAMPLE_IMAGES = Object.values(IMG);

function nextId() {
    seq = (parseInt(localStorage.getItem(KEYS.seq), 10) || 1000) + 1;
    localStorage.setItem(KEYS.seq, String(seq));
    return seq;
}

function save() {
    try {
        localStorage.setItem(KEYS.users, JSON.stringify(DB.users));
        localStorage.setItem(KEYS.items, JSON.stringify(DB.items));
        localStorage.setItem(KEYS.trades, JSON.stringify(DB.trades));
        localStorage.setItem(KEYS.ledger, JSON.stringify(DB.ledger));
        localStorage.setItem(KEYS.chats, JSON.stringify(DB.chats));
        localStorage.setItem(KEYS.denounces, JSON.stringify(DB.denounces));
        localStorage.setItem(KEYS.seq, String(seq));
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        if (typeof showToast === 'function') showToast('Erro ao salvar dados.', 'error');
    }
}

function getUser(id) {
    const numId = Number(id);
    return DB.users.find(u => u.id === numId);
}

function getItem(id) {
    const numId = Number(id);
    return DB.items.find(i => i.id === numId);
}

function changeCoins(user, delta, reason) {
    if (!user || typeof delta !== 'number' || isNaN(delta)) return;
    const current = Number(user.coins) || 0;
    user.coins = Math.max(0, current + delta);
    DB.ledger.push({
        id: nextId(),
        userId: user.id,
        delta,
        reason: reason || 'Sem descrição',
        ts: Date.now()
    });
}

function notify(userId, text) {
    const u = getUser(userId);
    if (!u) return;
    if (!Array.isArray(u.notifications)) u.notifications = [];
    u.notifications.unshift({
        id: nextId(),
        text,
        read: false,
        ts: Date.now()
    });
    if (u.notifications.length > 50) {
        u.notifications.length = 50;
    }
}

// Seed inicial
function seed() {
    seq = 1000;
    const now = Date.now();

    // Usuários (com localização)
    DB.users = [
        {
            id: 1, name: 'Maria Silva', email: 'maria@example.com', passHash: '', role: 'user', coins: 80,
            location: 'São Paulo, SP', lat: -23.5505, lng: -46.6333,
            createdAt: now - 90 * 864e5,
            favs: [], notifications: [], claimed: {}, lastLoginDate: '',
            stats: { logins: 12, sales: 2, barters: 1, itemsPublished: 3, ratingsReceived: 2 },
            ratings: [
                { by: 2, stars: 5, comment: 'Ótima nas trocas!', ts: now - 10 * 864e5 },
                { by: 3, stars: 4, comment: 'Muito atenciosa.', ts: now - 5 * 864e5 }
            ]
        },
        {
            id: 2, name: 'João Souza', email: 'joao@example.com', passHash: '', role: 'user', coins: 45,
            location: 'Rio de Janeiro, RJ', lat: -22.9068, lng: -43.1729,
            createdAt: now - 60 * 864e5,
            favs: [], notifications: [], claimed: {}, lastLoginDate: '',
            stats: { logins: 8, sales: 1, barters: 1, itemsPublished: 2, ratingsReceived: 1 },
            ratings: [
                { by: 1, stars: 5, comment: 'Troca justa.', ts: now - 9 * 864e5 }
            ]
        },
        {
            id: 3, name: 'Ana Lima', email: 'ana@example.com', passHash: '', role: 'user', coins: 120,
            location: 'Belo Horizonte, MG', lat: -19.9167, lng: -43.9345,
            createdAt: now - 30 * 864e5,
            favs: [], notifications: [], claimed: {}, lastLoginDate: '',
            stats: { logins: 5, sales: 0, barters: 0, itemsPublished: 1, ratingsReceived: 1 },
            ratings: [
                { by: 1, stars: 4, comment: 'Recomendo.', ts: now - 4 * 864e5 }
            ]
        },
        {
            id: 4, name: 'Carlos Pereira', email: 'carlos@example.com', passHash: '', role: 'user', coins: 35,
            location: 'Curitiba, PR', lat: -25.4284, lng: -49.2733,
            createdAt: now - 20 * 864e5,
            favs: [], notifications: [], claimed: {}, lastLoginDate: '',
            stats: { logins: 3, sales: 0, barters: 0, itemsPublished: 0, ratingsReceived: 0 },
            ratings: []
        },
        {
            id: 5, name: 'Roberta Almeida', email: 'roberta@example.com', passHash: '', role: 'user', coins: 60,
            location: 'União da Vitória, PR', lat: -26.2220, lng: -51.0860,
            createdAt: now - 40 * 864e5,
            favs: [], notifications: [], claimed: {}, lastLoginDate: '',
            stats: { logins: 6, sales: 1, barters: 0, itemsPublished: 2, ratingsReceived: 1 },
            ratings: [
                { by: 4, stars: 5, comment: 'Ótima negociação.', ts: now - 7 * 864e5 }
            ]
        },
        {
            id: 999, name: 'Admin', email: 'admin@example.com', passHash: '', role: 'admin', coins: 9999,
            location: 'Sistema', lat: null, lng: null,
            createdAt: now,
            favs: [], notifications: [], claimed: {}, lastLoginDate: '',
            stats: { logins: 1, sales: 0, barters: 0, itemsPublished: 0, ratingsReceived: 0 },
            ratings: []
        }
    ];

    // Itens – imagem corresponde ao título
    DB.items = [
        // Maria – São Paulo
        { id: 101, ownerId: 1, title: 'iPhone 11 64GB Preto', desc: 'Bateria 89%, sem riscos, com capinha e película.', category: 'Eletrônicos', condition: 'seminovo', type: 'both', price: 450, acceptTrades: true, image: IMG.iphone, status: 'available', views: 34, createdAt: now - 20 * 864e5, priceHistory: [], lat: -23.5505, lng: -46.6333, location: 'São Paulo, SP' },
        { id: 102, ownerId: 1, title: 'Cafeteira Italiana 6 xícaras', desc: 'Moka pot em inox, pouco uso.', category: 'Casa', condition: 'seminovo', type: 'both', price: 35, acceptTrades: true, image: IMG.cafeteira, status: 'available', views: 9, createdAt: now - 3 * 864e5, priceHistory: [], lat: -23.5550, lng: -46.6400, location: 'São Paulo, SP' },
        { id: 103, ownerId: 1, title: 'Violão Acústico Giannini', desc: 'Ótimo estado, cordas novas.', category: 'Outros', condition: 'usado', type: 'trade', price: 0, acceptTrades: true, image: IMG.violao, status: 'available', views: 15, createdAt: now - 10 * 864e5, priceHistory: [], lat: -23.5600, lng: -46.6500, location: 'São Paulo, SP' },

        // João – Rio de Janeiro
        { id: 201, ownerId: 2, title: 'Dom Casmurro – Machado de Assis', desc: 'Edição de bolso, pouco uso.', category: 'Livros', condition: 'usado', type: 'trade', price: 0, acceptTrades: true, image: IMG.livro, status: 'available', views: 12, createdAt: now - 15 * 864e5, priceHistory: [], lat: -22.9068, lng: -43.1729, location: 'Rio de Janeiro, RJ' },
        { id: 202, ownerId: 2, title: 'Fone Bluetooth TWS', desc: 'Autonomia de 5h, case incluso.', category: 'Eletrônicos', condition: 'novo', type: 'sale', price: 75, acceptTrades: false, image: IMG.foneTws, status: 'available', views: 48, createdAt: now - 864e5, priceHistory: [], lat: -22.9035, lng: -43.1780, location: 'Rio de Janeiro, RJ' },
        { id: 203, ownerId: 2, title: 'Skate Montado', desc: 'Shape importado, rolamentos novos.', category: 'Outros', condition: 'usado', type: 'both', price: 90, acceptTrades: true, image: IMG.skate, status: 'available', views: 22, createdAt: now - 5 * 864e5, priceHistory: [], lat: -22.9100, lng: -43.1700, location: 'Rio de Janeiro, RJ' },

        // Ana – Belo Horizonte
        { id: 301, ownerId: 3, title: 'Jaqueta Jeans M', desc: 'Nova sem etiqueta.', category: 'Roupas', condition: 'novo', type: 'sale', price: 60, acceptTrades: false, image: IMG.jaqueta, status: 'available', views: 21, createdAt: now - 7 * 864e5, priceHistory: [], lat: -19.9167, lng: -43.9345, location: 'Belo Horizonte, MG' },
        { id: 302, ownerId: 3, title: 'Câmera DSLR Canon', desc: 'Pouco uso, lente 18-55mm.', category: 'Eletrônicos', condition: 'usado', type: 'both', price: 300, acceptTrades: true, image: IMG.camera, status: 'available', views: 67, createdAt: now - 12 * 864e5, priceHistory: [], lat: -19.9200, lng: -43.9400, location: 'Belo Horizonte, MG' },
        { id: 303, ownerId: 3, title: 'Luminária de Mesa LED', desc: 'Ideal para estudos, luz branca.', category: 'Casa', condition: 'novo', type: 'sale', price: 25, acceptTrades: false, image: IMG.luminaria, status: 'available', views: 8, createdAt: now - 2 * 864e5, priceHistory: [], lat: -19.9300, lng: -43.9500, location: 'Belo Horizonte, MG' },

        // Carlos – Curitiba
        { id: 401, ownerId: 4, title: 'Notebook Dell Inspiron', desc: 'i5, 8GB RAM, 256GB SSD.', category: 'Eletrônicos', condition: 'seminovo', type: 'sale', price: 850, acceptTrades: false, image: IMG.notebook, status: 'available', views: 55, createdAt: now - 6 * 864e5, priceHistory: [], lat: -25.4284, lng: -49.2733, location: 'Curitiba, PR' },
        { id: 402, ownerId: 4, title: 'Bicicleta Aro 29', desc: 'Quadro em alumínio, 21 marchas.', category: 'Outros', condition: 'usado', type: 'both', price: 400, acceptTrades: true, image: IMG.bike, status: 'available', views: 39, createdAt: now - 8 * 864e5, priceHistory: [], lat: -25.4300, lng: -49.2800, location: 'Curitiba, PR' },
        { id: 403, ownerId: 4, title: 'Panela Elétrica de Arroz', desc: 'Capacidade 3 litros.', category: 'Casa', condition: 'novo', type: 'sale', price: 55, acceptTrades: false, image: IMG.panelaArroz, status: 'available', views: 14, createdAt: now - 3 * 864e5, priceHistory: [], lat: -25.4200, lng: -49.2700, location: 'Curitiba, PR' },
        { id: 404, ownerId: 4, title: 'Mesa de Centro Rústica', desc: 'Madeira de demolição, 1,2m x 0,6m.', category: 'Casa', condition: 'usado', type: 'sale', price: 120, acceptTrades: true, image: IMG.mesaCentro, status: 'available', views: 18, createdAt: now - 4 * 864e5, priceHistory: [], lat: -25.4310, lng: -49.2760, location: 'Curitiba, PR' },

        // Roberta – União da Vitória / Porto União
        { id: 501, ownerId: 5, title: 'Geladeira Electrolux 260L', desc: 'Branca, funcionando perfeitamente.', category: 'Casa', condition: 'seminovo', type: 'sale', price: 380, acceptTrades: false, image: IMG.geladeira, status: 'available', views: 25, createdAt: now - 5 * 864e5, priceHistory: [], lat: -26.2220, lng: -51.0860, location: 'União da Vitória, PR' },
        { id: 502, ownerId: 5, title: 'Sofá 2 Lugares', desc: 'Tecido cinza, sem rasgos.', category: 'Casa', condition: 'usado', type: 'both', price: 150, acceptTrades: true, image: IMG.sofa, status: 'available', views: 12, createdAt: now - 7 * 864e5, priceHistory: [], lat: -26.2225, lng: -51.0870, location: 'Porto União, SC' },
        { id: 503, ownerId: 5, title: 'Furadeira Bosch', desc: 'Impacto, com maleta.', category: 'Outros', condition: 'seminovo', type: 'sale', price: 85, acceptTrades: false, image: IMG.furadeira, status: 'available', views: 20, createdAt: now - 3 * 864e5, priceHistory: [], lat: -26.2230, lng: -51.0880, location: 'Porto União, SC' },
        { id: 504, ownerId: 5, title: 'Kit Churrasco', desc: 'Espetos, grelha, faca e tábua.', category: 'Casa', condition: 'novo', type: 'sale', price: 45, acceptTrades: false, image: IMG.churrasco, status: 'available', views: 9, createdAt: now - 2 * 864e5, priceHistory: [], lat: -26.2210, lng: -51.0850, location: 'União da Vitória, PR' },
        { id: 505, ownerId: 5, title: 'Batedeira Planetária', desc: 'Com tigela de inox.', category: 'Casa', condition: 'usado', type: 'both', price: 70, acceptTrades: true, image: IMG.batedeira, status: 'available', views: 16, createdAt: now - 6 * 864e5, priceHistory: [], lat: -26.2240, lng: -51.0890, location: 'União da Vitória, PR' },

        // Paula Freitas
        { id: 601, ownerId: 5, title: 'Roçadeira a Gasolina', desc: 'Motor 52cc, pouco uso.', category: 'Outros', condition: 'usado', type: 'sale', price: 180, acceptTrades: false, image: IMG.rocadeira, status: 'available', views: 28, createdAt: now - 4 * 864e5, priceHistory: [], lat: -26.2150, lng: -50.9310, location: 'Paula Freitas, PR' },
        { id: 602, ownerId: 5, title: 'Par de Botas de Couro', desc: 'Tamanho 40, impermeável.', category: 'Roupas', condition: 'seminovo', type: 'sale', price: 95, acceptTrades: false, image: IMG.botas, status: 'available', views: 11, createdAt: now - 5 * 864e5, priceHistory: [], lat: -26.2160, lng: -50.9320, location: 'Paula Freitas, PR' },
        { id: 603, ownerId: 5, title: 'Aparador de Grama Elétrico', desc: 'Largura de corte 30cm.', category: 'Outros', condition: 'novo', type: 'sale', price: 120, acceptTrades: true, image: IMG.aparador, status: 'available', views: 7, createdAt: now - 2 * 864e5, priceHistory: [], lat: -26.2140, lng: -50.9300, location: 'Paula Freitas, PR' },

        // Variados
        { id: 701, ownerId: 1, title: 'Tênis Nike Air Max', desc: 'Tamanho 42, usado poucas vezes.', category: 'Roupas', condition: 'seminovo', type: 'sale', price: 120, acceptTrades: false, image: IMG.tenis, status: 'available', views: 71, createdAt: now - 4 * 864e5, priceHistory: [], lat: -23.5500, lng: -46.6200, location: 'São Paulo, SP' },
        { id: 702, ownerId: 2, title: 'Óculos de Sol Ray-Ban', desc: 'Originais, com case.', category: 'Roupas', condition: 'usado', type: 'sale', price: 90, acceptTrades: false, image: IMG.oculos, status: 'available', views: 43, createdAt: now - 10 * 864e5, priceHistory: [], lat: -22.9000, lng: -43.1600, location: 'Rio de Janeiro, RJ' },
        { id: 703, ownerId: 3, title: 'Relógio Casio', desc: 'À prova d\'água, pulseira de aço.', category: 'Roupas', condition: 'novo', type: 'sale', price: 35, acceptTrades: true, image: IMG.relogio, status: 'available', views: 29, createdAt: now - 5 * 864e5, priceHistory: [], lat: -19.9100, lng: -43.9300, location: 'Belo Horizonte, MG' },
        { id: 704, ownerId: 4, title: 'Mochila Executiva', desc: 'Com porta-notebook.', category: 'Roupas', condition: 'novo', type: 'sale', price: 45, acceptTrades: false, image: IMG.mochila, status: 'available', views: 18, createdAt: now - 2 * 864e5, priceHistory: [], lat: -25.4400, lng: -49.2600, location: 'Curitiba, PR' },
        { id: 705, ownerId: 1, title: 'Teclado Mecânico Gamer', desc: 'RGB, switches blue.', category: 'Eletrônicos', condition: 'seminovo', type: 'sale', price: 150, acceptTrades: false, image: IMG.teclado, status: 'available', views: 82, createdAt: now - 1 * 864e5, priceHistory: [], lat: -23.5400, lng: -46.6300, location: 'São Paulo, SP' },
        { id: 706, ownerId: 2, title: 'Mesa de Centro', desc: 'Madeira maciça, 1m x 0,5m.', category: 'Casa', condition: 'usado', type: 'both', price: 80, acceptTrades: true, image: IMG.mesaCentro, status: 'available', views: 11, createdAt: now - 7 * 864e5, priceHistory: [], lat: -22.9050, lng: -43.1750, location: 'Rio de Janeiro, RJ' },
        { id: 707, ownerId: 3, title: 'Patinete Elétrico', desc: 'Autonomia de 15km.', category: 'Outros', condition: 'seminovo', type: 'sale', price: 350, acceptTrades: false, image: IMG.patinete, status: 'available', views: 66, createdAt: now - 3 * 864e5, priceHistory: [], lat: -19.9250, lng: -43.9350, location: 'Belo Horizonte, MG' },
        { id: 708, ownerId: 4, title: 'Fone de Ouvido Bluetooth Over-Ear', desc: 'Cancelamento de ruído.', category: 'Eletrônicos', condition: 'novo', type: 'sale', price: 110, acceptTrades: false, image: IMG.foneOver, status: 'available', views: 57, createdAt: now - 2 * 864e5, priceHistory: [], lat: -25.4100, lng: -49.2500, location: 'Curitiba, PR' },
        { id: 709, ownerId: 1, title: 'Sofá 3 Lugares', desc: 'Retrátil e reclinável, tecido suede.', category: 'Casa', condition: 'usado', type: 'trade', price: 0, acceptTrades: true, image: IMG.sofa, status: 'available', views: 17, createdAt: now - 6 * 864e5, priceHistory: [], lat: -23.5300, lng: -46.6000, location: 'São Paulo, SP' },
        { id: 710, ownerId: 2, title: 'Kit Ferramentas 20 peças', desc: 'Chaves e alicates.', category: 'Outros', condition: 'novo', type: 'sale', price: 40, acceptTrades: false, image: IMG.ferramentas, status: 'available', views: 5, createdAt: now - 1 * 864e5, priceHistory: [], lat: -22.9150, lng: -43.1650, location: 'Rio de Janeiro, RJ' },
        { id: 711, ownerId: 3, title: 'Vestido de Festa', desc: 'Tamanho P, usado uma vez.', category: 'Roupas', condition: 'seminovo', type: 'sale', price: 30, acceptTrades: false, image: IMG.vestido, status: 'available', views: 13, createdAt: now - 4 * 864e5, priceHistory: [], lat: -19.9150, lng: -43.9250, location: 'Belo Horizonte, MG' },
        { id: 712, ownerId: 4, title: 'Monitor 24" LED', desc: 'Full HD, HDMI.', category: 'Eletrônicos', condition: 'usado', type: 'sale', price: 220, acceptTrades: false, image: IMG.monitor, status: 'available', views: 31, createdAt: now - 9 * 864e5, priceHistory: [], lat: -25.4000, lng: -49.2400, location: 'Curitiba, PR' },
        { id: 713, ownerId: 1, title: 'Alexa Echo Dot 3ª Geração', desc: 'Pouco uso, com caixa original.', category: 'Eletrônicos', condition: 'seminovo', type: 'sale', price: 70, acceptTrades: false, image: IMG.alexa, status: 'available', views: 49, createdAt: now - 2 * 864e5, priceHistory: [], lat: -23.5600, lng: -46.6500, location: 'São Paulo, SP' }
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

    try {
        DB.users = JSON.parse(localStorage.getItem(KEYS.users)) || [];
        DB.items = JSON.parse(localStorage.getItem(KEYS.items)) || [];
        DB.trades = JSON.parse(localStorage.getItem(KEYS.trades)) || [];
        DB.ledger = JSON.parse(localStorage.getItem(KEYS.ledger)) || [];
        DB.chats = JSON.parse(localStorage.getItem(KEYS.chats)) || [];
        DB.denounces = JSON.parse(localStorage.getItem(KEYS.denounces)) || [];
        seq = parseInt(localStorage.getItem(KEYS.seq), 10) || 1000;
    } catch (error) {
        console.error('Erro ao carregar dados, recriando seed:', error);
        seed();
        localStorage.setItem(KEYS.ver, SCHEMA_VERSION);
        save();
        return true;
    }

    // Normalizar usuários
    DB.users.forEach(u => {
        u.favs = u.favs || [];
        u.notifications = u.notifications || [];
        u.claimed = u.claimed || {};
        u.stats = u.stats || { logins: 0, sales: 0, barters: 0, itemsPublished: 0, ratingsReceived: 0 };
        u.ratings = u.ratings || [];
        u.lastLoginDate = u.lastLoginDate || '';
        u.location = u.location || '';
        u.lat = u.lat ?? null;
        u.lng = u.lng ?? null;
    });

    return false;
}