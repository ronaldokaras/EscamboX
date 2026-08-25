// Inicialização
let infiniteScrollObserver;

function setupInfiniteScroll() {
    if (infiniteScrollObserver) infiniteScrollObserver.disconnect();
    const sentinel = document.getElementById('loadMoreSentinel');
    if (!sentinel) return;
    infiniteScrollObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    infiniteScrollObserver.observe(sentinel);
}

async function init() {
    loadData();
    await initPasswords();
    save();
    applyTheme(localStorage.getItem(KEYS.theme) || 'light');
    restoreSession();
    populateFormSelects();
    renderChips();
    afterLoginUI();
    renderAll();
    setupInfiniteScroll();
    
    document.addEventListener('click', e => {
        if (!e.target.closest('.user-menu')) closeUserMenu();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        if (e.key === '/' && !e.target.closest('input, textarea')) { e.preventDefault(); document.getElementById('searchInput').focus(); }
    });
    document.querySelectorAll('.modal').forEach(m => {
        m.addEventListener('mousedown', e => { if (e.target === m) m.classList.remove('active'); });
    });
}

document.addEventListener('DOMContentLoaded', init);
