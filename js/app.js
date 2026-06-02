/**
 * SHUNT - AI Resource Hub Logic
 * Handles data fetching, UI rendering, and terminal animations.
 *
 * Data is read live from the KSimply repository at every page load, so a new
 * model added to KSimply shows up here automatically (within GitHub's raw
 * cache window, a few minutes). No build or sync step is required.
 */

const KH_DATA = {
    url: "https://raw.githubusercontent.com/d4N-87/KSimply/main/scripts/data/",
    hf: "https://huggingface.co/front/assets/huggingface_logo-noborder.svg",
    dlIcon: `<svg class="kh-dl-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>`,
    copyIcon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>`,
    checkIcon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--brand-gold)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`
};

const KH_LANGS = ["it", "en", "fr", "de", "es", "pt"];

let KH_STORE = { base: [], comp: {}, rel: {}, enc: {}, vae: {} };
let currentLang = "en";
let khActiveFilter = "";
let khView = { mode: "list", query: "", name: null }; // current rendered view
let khReady = false; // becomes true after the first successful render
let khSearchTimer = null;

// Initialize App
window.addEventListener('DOMContentLoaded', khStart);

async function khStart() {
    try {
        // Fetch all CSV data from the KSimply repository.
        await Promise.all([
            khFetch('base_models.csv', 'base'),
            khFetch('model_compatibilities.csv', 'comp', 'model_name'),
            khFetch('model_releases.csv', 'rel', 'model_name', true),
            khFetch('text_encoder_releases.csv', 'enc', 'encoder_name', true),
            khFetch('vae_releases.csv', 'vae', 'vae_name', true)
        ]);

        // Set the model counter.
        const regElement = document.getElementById('kh-val-reg');
        if (regElement) regElement.innerText = KH_STORE.base.length.toString().padStart(3, '0');

        khSetLang(khInitialLang());
        khAnimate();
        khDraw("");
        khReady = true;

        // Search input (debounced so we don't re-render on every keystroke).
        const searchInput = document.getElementById('kh-search-input');
        searchInput.addEventListener('input', (e) => {
            const value = e.target.value;
            clearTimeout(khSearchTimer);
            khSearchTimer = setTimeout(() => khDraw(value), 150);
        });

        // Single delegated listener handles every "copy" button (robust against
        // repository strings containing quotes, which would break inline onclick).
        document.getElementById('kh-target').addEventListener('click', (e) => {
            const btn = e.target.closest('.kh-btn-copy');
            if (btn && btn.dataset.copy != null) khCopy(btn.dataset.copy, btn);
        });

    } catch (e) {
        console.error("Critical Connection Error:", e);
        const target = document.getElementById('kh-target');
        if (target) target.innerHTML = `<div class="kh-loading-msg">${khT('conn_error')}</div>`;
    }
}

/**
 * Escape a value before injecting it into HTML (text content and attributes).
 */
function khEsc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

/**
 * Translation helper for strings rendered dynamically.
 */
function khT(key) {
    return (i18n[currentLang] && i18n[currentLang][key]) || i18n.en[key] || "";
}

/**
 * Pick the initial language: saved choice > browser language > English.
 */
function khInitialLang() {
    const saved = localStorage.getItem('shunt_lang');
    if (saved && KH_LANGS.includes(saved)) return saved;
    const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
    return KH_LANGS.includes(browser) ? browser : "en";
}

/**
 * Data Fetching Utility.
 * file: CSV file name. key: KH_STORE bucket. indexKey: column to index rows by.
 * multi: when true, group multiple rows under the same index key.
 */
async function khFetch(file, key, indexKey = null, multi = false) {
    const response = await fetch(KH_DATA.url + file);
    if (!response.ok) throw new Error(`Failed to fetch ${file}: ${response.status}`);
    const text = await response.text();
    return new Promise((resolve) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (res) => {
                if (!indexKey) {
                    KH_STORE[key] = res.data;
                } else {
                    res.data.forEach((row) => {
                        if (multi) {
                            if (!KH_STORE[key][row[indexKey]]) KH_STORE[key][row[indexKey]] = [];
                            KH_STORE[key][row[indexKey]].push(row);
                        } else {
                            KH_STORE[key][row[indexKey]] = row;
                        }
                    });
                }
                resolve();
            }
        });
    });
}

/**
 * Technical Interface Animations.
 * Decorative only: skipped entirely when the user prefers reduced motion, and
 * paused while the tab is hidden to save CPU/battery (notably on mobile).
 */
let khAnimTimers = [];
let khWaveRAF = null;
let khWaveOffset = 0;

function khAnimate() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    khStartAnimations();
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) khStopAnimations();
        else khStartAnimations();
    });
}

function khStartAnimations() {
    if (khAnimTimers.length || khWaveRAF) return; // already running

    // Stats fluctuations.
    khAnimTimers.push(setInterval(() => {
        const loadEl = document.getElementById('kh-val-load');
        const hexEl = document.getElementById('kh-val-hex');
        if (loadEl) loadEl.innerText = (Math.random() * 100).toFixed(1) + "%";
        if (hexEl) hexEl.innerText = "0x" + Math.random().toString(16).substr(2, 2).toUpperCase();
    }, 1000));

    // ASCII progress bar.
    let s = 0;
    khAnimTimers.push(setInterval(() => {
        s = (s + 1) % 41;
        const bar = document.getElementById('kh-ascii-bar');
        if (bar) bar.innerText = "█".repeat(s) + "░".repeat(40 - s);
    }, 400));

    // CRT sine-wave canvas.
    const c = document.getElementById('kh-sine-wave');
    if (!c) return;
    const ctx = c.getContext('2d');
    function wave() {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.beginPath();
        ctx.strokeStyle = '#FFD21E';
        ctx.lineWidth = 1.2;
        for (let x = 0; x < c.width; x++) {
            const y = 12 + Math.sin(x * 0.1 + khWaveOffset) * 8;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
        khWaveOffset += 0.08;
        khWaveRAF = requestAnimationFrame(wave);
    }
    wave();
}

function khStopAnimations() {
    khAnimTimers.forEach(clearInterval);
    khAnimTimers = [];
    if (khWaveRAF) {
        cancelAnimationFrame(khWaveRAF);
        khWaveRAF = null;
    }
}

/**
 * Clipboard Utility.
 */
window.khCopy = (text, btnElement) => {
    const restore = () => { btnElement.innerHTML = original; };
    const original = btnElement.innerHTML;
    const ok = () => {
        btnElement.innerHTML = KH_DATA.checkIcon;
        setTimeout(restore, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok).catch(() => {});
    }
};

/**
 * Rendering Engine.
 */
function khDraw(q) {
    const out = document.getElementById('kh-target');
    if (!out) return;
    out.innerHTML = "";
    const query = (q || "").toLowerCase();
    khView = { mode: query === "" ? "list" : "search", query: q || "", name: null };

    if (query === "") {
        const wrap = document.createElement('div');
        wrap.className = "kh-list-frame kh-fade";
        const grid = document.createElement('div');
        grid.className = "kh-model-grid";

        [...KH_STORE.base].sort((a, b) => a.name.localeCompare(b.name)).forEach((m) => {
            const el = document.createElement('div');
            el.className = "kh-model-box group";
            el.tabIndex = 0;
            el.setAttribute('role', 'button');
            const type = m.type.includes("Video") ? "VIDEO" : m.type.includes("Image") ? "IMAGE" : "AUDIO";
            el.innerHTML = `<span class="kh-name-txt">${khEsc(m.name)}</span><span class="kh-cat-badge">${type}</span>`;
            el.onclick = () => khShowDetail(m.name);
            el.onkeydown = (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); khShowDetail(m.name); }
            };
            grid.appendChild(el);
        });
        wrap.appendChild(grid);
        out.appendChild(wrap);
    } else {
        KH_STORE.base
            .filter((m) => m.name.toLowerCase().includes(query) || m.type.toLowerCase().includes(query))
            .forEach((m) => out.appendChild(khCardUI(m)));
    }
}

/**
 * Detail Page View.
 */
function khShowDetail(n, scroll = true) {
    const out = document.getElementById('kh-target');
    if (!out) return;
    out.innerHTML = "";
    khView = { mode: "detail", query: "", name: n };

    const m = KH_STORE.base.find((x) => x.name === n);

    const backWrap = document.createElement('div');
    backWrap.className = "kh-back-wrapper";
    const btn = document.createElement('button');
    btn.className = "kh-back-btn";
    btn.innerHTML = khT('back_btn');
    btn.onclick = () => { document.getElementById('kh-search-input').value = ""; khDraw(""); };
    backWrap.appendChild(btn);
    out.appendChild(backWrap);

    if (!m) {
        const msg = document.createElement('div');
        msg.className = "kh-loading-msg";
        msg.innerText = khT('not_found');
        out.appendChild(msg);
        return;
    }

    out.appendChild(khCardUI(m));
    if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function khCardUI(m) {
    const div = document.createElement('div');
    div.className = "kh-detail-card kh-fade";
    const rels = KH_STORE.rel[m.name] || [];
    div.innerHTML = `
        <div class="kh-card-head"><div class="kh-type-tag">${khEsc(m.type)}</div><h2 class="kh-card-title">${khEsc(m.name)}</h2></div>
        <div class="kh-section-header">CHECKPOINTS</div>
        <div class="kh-release-list">${rels.map(khReleaseRow).join('')}</div>
        <div>
            ${renderSub(KH_STORE.comp[m.name]?.compatible_text_encoders, "ENCODERS", KH_STORE.enc)}
            ${renderSub(KH_STORE.comp[m.name]?.compatible_vaes, "VAE MODELS", KH_STORE.vae)}
        </div>`;
    return div;
}

/**
 * Render a single release row (used by both checkpoints and sub-components).
 */
function khReleaseRow(r) {
    return `
        <div class="kh-release-row">
            <div class="kh-release-info">
                <span class="kh-mono kh-quant-name">${khEsc(r.quantization_name)}</span>
                <span class="kh-gb-tag">${khEsc(r.file_size_gb)} GB</span>
            </div>
            <div class="kh-release-actions">
                <span class="kh-btn-copy" data-copy="${khEsc(r.repository)}">${KH_DATA.copyIcon}</span>
                <a href="${khEsc(r.repository)}" target="_blank" rel="noopener" class="kh-btn-dl"><img src="${KH_DATA.hf}" class="kh-hf-icon" alt="Hugging Face">${KH_DATA.dlIcon}</a>
            </div>
        </div>`;
}

function renderSub(data, label, store) {
    if (!data || data.includes("Included")) {
        return `<div><div class="kh-section-header">${label}</div><p class="kh-included-note">${khT('included')}</p></div>`;
    }
    let html = `<div><div class="kh-section-header">${label}</div>`;
    data.split('|').forEach((entry) => {
        const name = entry.trim();
        const releases = store[name] || [];
        html += `<div class="kh-sub-block">
            <p class="kh-sub-name">&gt; ${khEsc(name)}</p>
            <div>${releases.map(khReleaseRow).join('')}</div>
        </div>`;
    });
    return html + `</div>`;
}

/**
 * Search & Filter Handling.
 */
window.khToggleFilter = (v) => {
    const i = document.getElementById('kh-search-input');
    document.querySelectorAll('.kh-f-btn').forEach((b) => b.classList.remove('active'));
    if (khActiveFilter === v) {
        khActiveFilter = "";
        i.value = "";
    } else {
        khActiveFilter = v;
        i.value = v;
        document.getElementById('f-' + v).classList.add('active');
    }
    khDraw(i.value);
};

window.khResetApp = () => {
    khActiveFilter = "";
    document.getElementById('kh-search-input').value = "";
    document.querySelectorAll('.kh-f-btn').forEach((b) => b.classList.remove('active'));
    khDraw("");
};

/**
 * i18n Translation Logic.
 */
window.khSetLang = (lang) => {
    if (!KH_LANGS.includes(lang)) lang = "en";
    currentLang = lang;
    localStorage.setItem('shunt_lang', lang);
    document.documentElement.lang = lang;

    document.querySelectorAll('.kh-lang-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.innerText.toLowerCase() === lang);
    });

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) el.innerHTML = i18n[lang][key];
    });

    const searchInput = document.getElementById('kh-search-input');
    if (searchInput) searchInput.placeholder = i18n[lang].search_placeholder;

    // Re-render the current view so dynamic strings follow the language switch.
    if (khReady) {
        if (khView.mode === "detail") khShowDetail(khView.name, false);
        else khDraw(khView.query);
    }
};
