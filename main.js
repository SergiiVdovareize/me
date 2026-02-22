const allBtns = document.querySelectorAll('.exp-toggle-btn');

function setMode(mode) {
    allBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
    if (mode === 'short') {
        document.body.classList.add('short-mode');
    } else {
        document.body.classList.remove('short-mode');
    }
}

allBtns.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
});

// Show sticky bar only when scrolling up (past hero toggle), hide 7s after scroll-up stops
const hero = document.querySelector('.hero');
const stickyBar = document.getElementById('stickyCvBar');
const heroToggle = document.querySelector('.cv-format-toggle');
let lastY = window.scrollY;
let hideTimer = null;

function heroToggleVisible() {
    return heroToggle.getBoundingClientRect().bottom > 0;
}

function showBar() {
    stickyBar.classList.add('visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => stickyBar.classList.remove('visible'), 7000);
}

window.addEventListener('scroll', () => {
    const currentY = window.scrollY;
    const scrollingUp = currentY < lastY;

    if (scrollingUp && !heroToggleVisible()) {
        showBar();
    } else if (!scrollingUp || heroToggleVisible()) {
        // scrolling down or toggle back in view — hide immediately
        clearTimeout(hideTimer);
        stickyBar.classList.remove('visible');
    }
    lastY = currentY;
}, { passive: true });
