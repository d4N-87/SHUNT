/**
 * SHUNT - AI Resource Hub Logic
 * Handles data fetching, UI rendering, and terminal animations.
 */

const KH_DATA = {
    url: "https://raw.githubusercontent.com/d4N-87/KSimply/main/scripts/data/",
    hf: "https://huggingface.co/front/assets/huggingface_logo-noborder.svg",
    dlIcon: `<svg class="kh-dl-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>`,
    copyIcon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002h8a2 2 0 002-2v-2"></path></svg>`,
    checkIcon: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--brand-gold)"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>`
};

let KH_STORE = { base: [], comp: {}, rel: {}, enc: {}, vae: {} };
let khActiveFilter = "";

// Initialize App
window.addEventListener('DOMContentLoaded', khStart);

async function khStart() {
    try {
        // Fetch all CSV data from KSimply repository
        await Promise.all([
            khFetch('base_models.csv', 'base'),
            khFetch('model_compatibilities.csv', 'comp', 'model_name'),
            khFetch('model_releases.csv', 'rel', 'model_name', true),
            khFetch('text_encoder_releases.csv', 'enc', 'encoder_name', true),
            khFetch('vae_releases.csv', 'vae', 'vae_name', true)
        ]);

        // Set counters and language
        const regElement = document.getElementById('kh-val-reg');
        if(regElement) regElement.innerText = KH_STORE.base.length.toString().padStart(3, '0');
        
        khSetLang('it'); // Initializing Italian Language
        khAnimate(); 
        khDraw("");
        
        // Setup Search Listener
        document.getElementById('kh-search-input').addEventListener('input', (e) => khDraw(e.target.value));

    } catch(e) { 
        console.error("Critical Connection Error:", e);
        document.getElementById('kh-target').innerHTML = "SYSTEM CONNECTION ERROR"; 
    }
}

/**
 * Data Fetching Utility
 */
async function khFetch(f, k, ik = null, m = false) {
    const r = await fetch(KH_DATA.url + f + "?cb=" + Date.now());
    const t = await r.text();
    return new Promise(resolve => {
        Papa.parse(t, { header: true, skipEmptyLines: true, complete: (res) => {
            if (ik) res.data.forEach(row => {
                if (m) { 
                    if (!KH_STORE[k][row[ik]]) KH_STORE[k][row[ik]] = []; 
                    KH_STORE[k][row[ik]].push(row); 
                }
                else KH_STORE[k][row[ik]] = row;
            }); else KH_STORE[k] = res.data;
            resolve();
        }});
    });
}

/**
 * Technical Interface Animations
 */
function khAnimate() {
    // Stats fluctuations
    setInterval(() => {
        const loadEl = document.getElementById('kh-val-load');
        const hexEl = document.getElementById('kh-val-hex');
        if(loadEl) loadEl.innerText = (Math.random() * 100).toFixed(1) + "%";
        if(hexEl) hexEl.innerText = "0x" + Math.random().toString(16).substr(2, 2).toUpperCase();
    }, 1000);

    // ASCII Progress Bar
    let s = 0; 
    setInterval(() => { 
        s = (s + 1) % 41; 
        const bar = document.getElementById('kh-ascii-bar'); 
        if(bar) bar.innerText = "█".repeat(s) + "░".repeat(40-s); 
    }, 400);

    // CRT Sine Wave Canvas
    const c = document.getElementById('kh-sine-wave'); 
    if(!c) return;
    const ctx = c.getContext('2d'); 
    let off = 0;
    function wave() { 
        ctx.clearRect(0,0,c.width,c.height); 
        ctx.beginPath(); 
        ctx.strokeStyle = '#FFD21E'; 
        ctx.lineWidth = 1.2; 
        for(let x=0; x<c.width; x++) { 
            const y = 12 + Math.sin(x*0.1 + off)*8; 
            ctx.lineTo(x, y); 
        } 
        ctx.stroke(); 
        off += 0.08; 
        requestAnimationFrame(wave); 
    }
    wave();
}

/**
 * Clipboard Utility
 */
window.khCopy = (text, btnElement) => {
    navigator.clipboard.writeText(text);
    const originalContent = btnElement.innerHTML;
    btnElement.innerHTML = KH_DATA.checkIcon;
    setTimeout(() => {
        btnElement.innerHTML = originalContent;
    }, 2000);
};

/**
 * Rendering Engine
 */
function khDraw(q) {
    const out = document.getElementById('kh-target'); 
    if(!out) return;
    out.innerHTML = "";
    const query = q.toLowerCase();

    if (query === "") {
        const wrap = document.createElement('div'); 
        wrap.className = "kh-list-frame kh-fade";
        const grid = document.createElement('div'); 
        grid.className = "grid grid-cols-1 md:grid-cols-2 gap-x-6";
        
        [...KH_STORE.base].sort((a,b) => a.name.localeCompare(b.name)).forEach(m => {
            const el = document.createElement('div'); 
            el.className = "kh-model-box group";
            const type = m.type.includes("Video") ? "VIDEO" : m.type.includes("Image") ? "IMAGE" : "AUDIO";
            el.innerHTML = `<span class="kh-name-txt">${m.name}</span><span class="kh-cat-badge">${type}</span>`;
            el.onclick = () => khShowDetail(m.name);
            grid.appendChild(el);
        });
        wrap.appendChild(grid); 
        out.appendChild(wrap);
    } else {
        KH_STORE.base.filter(m => m.name.toLowerCase().includes(query) || m.type.toLowerCase().includes(query)).forEach(m => out.appendChild(khCardUI(m)));
    }
}

/**
 * Detail Page View
 */
function khShowDetail(n) {
    const out = document.getElementById('kh-target'); 
    out.innerHTML = "";
    const m = KH_STORE.base.find(x => x.name === n);
    
    const backWrap = document.createElement('div');
    backWrap.className = "kh-back-wrapper";
    const btn = document.createElement('button'); 
    btn.className = "kh-back-btn"; 
    btn.innerHTML = i18n[currentLang].back_btn; 
    btn.onclick = () => { document.getElementById('kh-search-input').value = ""; khDraw(""); };
    backWrap.appendChild(btn);
    
    out.appendChild(backWrap); 
    out.appendChild(khCardUI(m));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function khCardUI(m) {
    const div = document.createElement('div'); 
    div.className = "kh-detail-card kh-fade";
    const rels = KH_STORE.rel[m.name] || [];
    div.innerHTML = `
        <div class="mb-14 text-left"><div class="kh-type-tag">${m.type}</div><h2 class="kh-card-title">${m.name}</h2></div>
        <div class="kh-section-header">CHECKPOINTS</div>
        <div class="space-y-2 mb-16">${rels.map(r => `
            <div class="kh-release-row">
                <div class="flex items-center gap-2 text-left">
                    <span class="kh-mono text-white font-bold text-[12px] w-20 text-left">${r.quantization_name}</span>
                    <span class="kh-gb-tag">${r.file_size_gb} GB</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span onclick="khCopy('${r.repository}', this)" class="kh-btn-copy">${KH_DATA.copyIcon}</span>
                    <a href="${r.repository}" target="_blank" class="kh-btn-dl"><img src="${KH_DATA.hf}" class="kh-hf-icon">${KH_DATA.dlIcon}</a>
                </div>
            </div>`).join('')}
        </div>
        <div>
            ${renderSub(KH_STORE.comp[m.name]?.compatible_text_encoders, "ENCODERS", KH_STORE.enc)}
            ${renderSub(KH_STORE.comp[m.name]?.compatible_vaes, "VAE MODELS", KH_STORE.vae)}
        </div>`;
    return div;
}

function renderSub(d, l, s) {
    if (!d || d.includes("Included")) return `<div><div class="kh-section-header">${l}</div><p class="text-[10px] text-slate-500 italic pl-4">Already included in main model</p></div>`;
    let h = `<div><div class="kh-section-header">${l}</div>`;
    d.split('|').forEach(n => {
        const name = n.trim(); 
        const vs = s[name] || [];
        h += `<div class="mb-10 last:mb-0 text-left">
            <p style="font-family:'Fira Code',monospace; font-size:14px; font-weight:800; color:#888; text-transform:uppercase; margin-bottom:1rem;">> ${name}</p>
            <div class="space-y-2">${vs.map(v => `
                <div class="kh-release-row">
                    <div class="flex items-center gap-2 text-left">
                        <span class="kh-mono text-white font-bold text-[12px] w-20 text-left">${v.quantization_name}</span>
                        <span class="kh-gb-tag">${v.file_size_gb} GB</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span onclick="khCopy('${v.repository}', this)" class="kh-btn-copy">${KH_DATA.copyIcon}</span>
                        <a href="${v.repository}" target="_blank" class="kh-btn-dl"><img src="${KH_DATA.hf}" class="kh-hf-icon">${KH_DATA.dlIcon}</a>
                    </div>
                </div>`).join('')}
            </div></div>`;
    });
    return h + `</div>`;
}

/**
 * Search & Filter Handling
 */
window.khToggleFilter = (v) => {
    const i = document.getElementById('kh-search-input');
    document.querySelectorAll('.kh-f-btn').forEach(b => b.classList.remove('active'));
    if (khActiveFilter === v) { khActiveFilter = ""; i.value = ""; } 
    else { khActiveFilter = v; i.value = v; document.getElementById('f-' + v).classList.add('active'); }
    khDraw(i.value);
};

window.khResetApp = () => { 
    khActiveFilter = ""; 
    document.getElementById('kh-search-input').value = ""; 
    document.querySelectorAll('.kh-f-btn').forEach(b => b.classList.remove('active')); 
    khDraw(""); 
};

/**
 * i18n Translation Logic
 */
window.khSetLang = (lang) => {
    currentLang = lang;
    
    document.querySelectorAll('.kh-lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase() === lang);
    });

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) {
            el.innerHTML = i18n[lang][key];
        }
    });

    const searchInput = document.getElementById('kh-search-input');
    if (searchInput) searchInput.placeholder = i18n[lang].search_placeholder;
};