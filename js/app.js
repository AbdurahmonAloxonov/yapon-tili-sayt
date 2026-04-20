/* ============================================================
   YAPON TILI — app.js
   Main application logic
   ============================================================ */

'use strict';

// ============================================================
//  STATE MANAGEMENT
// ============================================================
const state = {
  learnedK:  new Set(JSON.parse(localStorage.getItem('lk')  || '[]')),
  learnedKA: new Set(JSON.parse(localStorage.getItem('lka') || '[]')),
  learnedKW: new Set(JSON.parse(localStorage.getItem('lkw') || '[]')),
  history:        JSON.parse(localStorage.getItem('hist') || '[]'),
  kanjiPage:   0,
  kanjiFilter: 'all',
  kataTab:     'chart',
  flashType:   'kanji',
  flashIdx:    0,
  flashFlipped: false,
  flashDeck:   [],
  testType:    'k-meaning',
  testQ:       [],
  testIdx:     0,
  testCorrect: 0,
  testWrong:   0,
  currentModal: null,
};

function save() {
  try {
    localStorage.setItem('lk',   JSON.stringify([...state.learnedK]));
    localStorage.setItem('lka',  JSON.stringify([...state.learnedKA]));
    localStorage.setItem('lkw',  JSON.stringify([...state.learnedKW]));
    localStorage.setItem('hist', JSON.stringify(state.history.slice(0, 100)));
  } catch(e) {
    console.warn('LocalStorage save failed:', e);
  }
}

// ============================================================
//  NAVIGATION
// ============================================================
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('s-' + id);
  const btn = document.getElementById('nb-' + id);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (id === 'kanji')    { renderKanji(); }
  if (id === 'katakana') { renderKatakana(); }
  if (id === 'flash')    { initFlash(); }
  if (id === 'progress') { renderProgress(); }
  if (id === 'home')     { updateHomeStats(); }
  if (id === 'test')     {
    // Reset test UI to setup screen
    const setup = document.getElementById('test-setup');
    const area  = document.getElementById('test-area');
    const res   = document.getElementById('test-result');
    if (setup) setup.style.display = '';
    if (area)  area.style.display  = 'none';
    if (res)   res.style.display   = 'none';
  }
}

// ============================================================
//  HOME STATS
// ============================================================
function updateHomeStats() {
  const kTotal  = KANJI_DATA.length;
  const kaTotal = 46;
  const kwTotal = KATA_WORDS.length;

  const kLearned  = state.learnedK.size;
  const kaLearned = state.learnedKA.size;
  const kwLearned = state.learnedKW.size;

  setText('h-klearned', kLearned + kaLearned);
  setText('h-tests',    state.history.length);

  const kPct  = Math.round(kLearned  / kTotal  * 100);
  const kaPct = Math.round(kaLearned / kaTotal * 100);
  const kwPct = Math.round(kwLearned / kwTotal * 100);

  setStyle('pb-k',  'width', kPct  + '%');
  setStyle('pb-ka', 'width', kaPct + '%');
  setStyle('pb-kw', 'width', kwPct + '%');

  setText('ph-k',  kLearned  + ' / ' + kTotal);
  setText('ph-ka', kaLearned + ' / ' + kaTotal);
  setText('ph-kw', kwLearned + ' / ' + kwTotal);
}

// ============================================================
//  KANJI SECTION
// ============================================================
const PAGE_SIZE = 20;
let kanjiFiltered = [];

function setKanjiFilter(f) {
  state.kanjiFilter = f;
  state.kanjiPage = 0;

  // Reset all filter buttons
  ['all', 'learned', 'new'].forEach(x => {
    const b = document.getElementById('filter-' + x);
    if (!b) return;
    b.classList.remove('active-filter', 'on');
    b.style.cssText = '';
  });

  const active = document.getElementById('filter-' + f);
  if (active) {
    if (f === 'all') {
      active.classList.add('active-filter');
    } else {
      active.classList.add('on');
    }
  }
  renderKanji();
}

function renderKanji() {
  const q = (document.getElementById('kanji-search')?.value || '').toLowerCase().trim();

  kanjiFiltered = KANJI_DATA.filter(k => {
    const matchQ = !q
      || k.k.includes(q)
      || k.m.toLowerCase().includes(q)
      || k.on.toLowerCase().includes(q)
      || k.kun.toLowerCase().includes(q)
      || k.ex.includes(q);

    const matchF =
      state.kanjiFilter === 'all'
      || (state.kanjiFilter === 'learned' && state.learnedK.has(k.k))
      || (state.kanjiFilter === 'new'     && !state.learnedK.has(k.k));

    return matchQ && matchF;
  });

  const total = kanjiFiltered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (state.kanjiPage >= pages) state.kanjiPage = pages - 1;
  if (state.kanjiPage < 0)      state.kanjiPage = 0;

  const start = state.kanjiPage * PAGE_SIZE;
  const slice = kanjiFiltered.slice(start, start + PAGE_SIZE);

  setText('kb-badge', state.learnedK.size + ' / ' + KANJI_DATA.length + " o'rganildi");

  const grid = document.getElementById('kanji-grid');
  if (!grid) return;

  if (!slice.length) {
    grid.innerHTML = '<div class="no-results">🔍 Hech narsa topilmadi</div>';
  } else {
    grid.innerHTML = slice.map(k => {
      const learned  = state.learnedK.has(k.k);
      const globalIdx = KANJI_DATA.indexOf(k);
      return `<div class="kcard${learned ? ' learned' : ''}" onclick="openModal(${globalIdx})" role="button" aria-label="${k.k} — ${k.m}">
        <span class="kanji-char">${k.k}</span>
        <div class="kanji-meaning">${k.m}</div>
        <div class="kanji-reading jp">${k.on}</div>
      </div>`;
    }).join('');
  }

  renderPagination(pages);
}

function renderPagination(pages) {
  const pp = document.getElementById('kanji-pages');
  if (!pp) return;
  pp.innerHTML = '';
  if (pages <= 1) return;

  const cur = state.kanjiPage;

  const mkBtn = (i, label) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (i === cur ? ' active' : '');
    b.textContent = label || (i + 1);
    b.setAttribute('aria-label', 'Sahifa ' + (i + 1));
    if (i === cur) b.setAttribute('aria-current', 'page');
    b.addEventListener('click', () => {
      state.kanjiPage = i;
      renderKanji();
      window.scrollTo({ top: 120, behavior: 'smooth' });
    });
    return b;
  };

  // Show smart pagination: first, prev, ...middle..., next, last
  const addDots = () => {
    const d = document.createElement('button');
    d.className = 'page-btn dots';
    d.textContent = '…';
    d.disabled = true;
    pp.appendChild(d);
  };

  if (pages <= 7) {
    for (let i = 0; i < pages; i++) pp.appendChild(mkBtn(i));
  } else {
    pp.appendChild(mkBtn(0));
    if (cur > 2) addDots();
    const lo = Math.max(1, cur - 1);
    const hi = Math.min(pages - 2, cur + 1);
    for (let i = lo; i <= hi; i++) pp.appendChild(mkBtn(i));
    if (cur < pages - 3) addDots();
    pp.appendChild(mkBtn(pages - 1));
  }
}

// ============================================================
//  KANJI DETAIL MODAL
// ============================================================
function openModal(idx) {
  if (idx < 0 || idx >= KANJI_DATA.length) return;
  const k = KANJI_DATA[idx];
  state.currentModal = idx;

  setText('modal-num',     '#' + (idx + 1) + ' / ' + KANJI_DATA.length);
  setText('modal-char',    k.k);
  setText('modal-meaning', k.m);
  setText('modal-on',      k.on);
  setText('modal-kun',     k.kun);
  setText('modal-ex',      k.ex);
  setText('modal-exm',     k.em);

  const lb = document.getElementById('learn-btn');
  if (lb) {
    if (state.learnedK.has(k.k)) {
      lb.textContent = "✓ O'rganilgan!";
      lb.classList.add('done');
    } else {
      lb.textContent = "✓ O'rgandim deb belgilash";
      lb.classList.remove('done');
    }
  }

  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function modalNav(dir) {
  let idx = (state.currentModal + dir + KANJI_DATA.length) % KANJI_DATA.length;
  openModal(idx);
}

function toggleLearnModal() {
  const idx = state.currentModal;
  if (idx === null || idx === undefined) return;
  const k = KANJI_DATA[idx];
  if (!state.learnedK.has(k.k)) {
    state.learnedK.add(k.k);
    save();
    const lb = document.getElementById('learn-btn');
    if (lb) { lb.textContent = "✓ O'rganilgan!"; lb.classList.add('done'); }
    showToast('✓ ' + k.k + " — O'rganildi!");
    renderKanji();
    updateHomeStats();
  }
}

// ============================================================
//  KATAKANA SECTION
// ============================================================
function renderKatakana() {
  const kaTotal = 46;
  setText('kata-badge', state.learnedKA.size + ' / ' + kaTotal + " o'rganildi");

  if (state.kataTab === 'chart') renderKataChart();
  else renderKataWords();
}

function setKataTab(t) {
  state.kataTab = t;
  const cs = document.getElementById('kata-chart-section');
  const ws = document.getElementById('kata-words-section');
  if (cs) cs.style.display = t === 'chart' ? '' : 'none';
  if (ws) ws.style.display = t === 'words' ? '' : 'none';

  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.getElementById('kt-' + t)?.classList.add('active');

  if (t === 'chart') renderKataChart();
  else renderKataWords();
}

function renderKataChart() {
  const q = (document.getElementById('kata-search')?.value || '').toLowerCase().trim();
  const wrap = document.getElementById('kata-chart-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  KATA_CHART.forEach(row => {
    const filtered = row.chars.filter(c =>
      !q || c.c.includes(q) || c.r.toLowerCase().includes(q)
    );
    if (!filtered.length) return;

    const title = document.createElement('div');
    title.className = 'kata-section-title';
    title.textContent = row.row;
    wrap.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'kata-chart';

    filtered.forEach(c => {
      const learned = state.learnedKA.has(c.c);
      const div = document.createElement('div');
      div.className = 'kata-cell' + (learned ? ' learned' : '');
      div.setAttribute('role', 'button');
      div.setAttribute('aria-label', c.c + ' — ' + c.r);
      div.innerHTML = `<span class="kchar">${c.c}</span><span class="krom">${c.r}</span>`;
      div.addEventListener('click', () => toggleKataLearned(c, div));
      grid.appendChild(div);
    });

    wrap.appendChild(grid);
  });
}

function toggleKataLearned(c, el) {
  if (!state.learnedKA.has(c.c)) {
    state.learnedKA.add(c.c);
    save();
    if (el) el.classList.add('learned');
    showToast('✓ ' + c.c + ' (' + c.r + ") — O'rganildi!");
    setText('kata-badge', state.learnedKA.size + " / 46 o'rganildi");
    updateHomeStats();
  } else {
    showToast(c.c + ' — ' + c.r);
  }
}

function renderKataWords() {
  const q = (document.getElementById('kword-search')?.value || '').toLowerCase().trim();
  const filtered = KATA_WORDS.filter(w =>
    !q || w.w.includes(q) || w.r.toLowerCase().includes(q) || w.m.toLowerCase().includes(q)
  );

  const grid = document.getElementById('kata-words-grid');
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = '<div class="no-results" style="grid-column:1/-1">🔍 Hech narsa topilmadi</div>';
    return;
  }

  grid.innerHTML = filtered.map((w, i) => {
    const learned = state.learnedKW.has(w.w);
    const origIdx = KATA_WORDS.indexOf(w);
    return `<div class="word-card${learned ? ' learned' : ''}" onclick="toggleWordLearned(${origIdx})" role="button" aria-label="${w.w} — ${w.m}">
      <div class="wkata">${w.w}</div>
      <div class="wpron">${w.r}</div>
      <div class="wmean">${w.m}</div>
      ${learned ? '<div class="wlearned-tag">✓ O\'rganilgan</div>' : ''}
    </div>`;
  }).join('');
}

function toggleWordLearned(i) {
  const w = KATA_WORDS[i];
  if (!w) return;
  if (!state.learnedKW.has(w.w)) {
    state.learnedKW.add(w.w);
    save();
    showToast('✓ ' + w.w + " — O'rganildi!");
    updateHomeStats();
  } else {
    showToast(w.w + ' — ' + w.m);
  }
  renderKataWords();
}

// ============================================================
//  FLASHCARDS
// ============================================================
function buildDeck() {
  if (state.flashType === 'kanji') {
    return [...KANJI_DATA];
  }
  if (state.flashType === 'katakana') {
    const all = [];
    KATA_CHART.forEach(row => row.chars.forEach(c => {
      all.push({ k: c.c, m: c.r, on: c.r, kun: '—', ex: c.c, em: 'Katakana belgisi', _kata: true });
    }));
    return all;
  }
  if (state.flashType === 'learned') {
    const kLearned = KANJI_DATA.filter(k => state.learnedK.has(k.k));
    const kaLearned = [];
    KATA_CHART.forEach(row => row.chars.forEach(c => {
      if (state.learnedKA.has(c.c)) {
        kaLearned.push({ k: c.c, m: c.r, on: c.r, kun: '—', ex: c.c, em: 'Katakana belgisi', _kata: true });
      }
    }));
    return [...kLearned, ...kaLearned];
  }
  return [...KANJI_DATA];
}

function initFlash() {
  state.flashDeck = buildDeck();

  const empty = document.getElementById('flash-empty');
  const wrap  = document.querySelector('.flash-wrap');

  if (!state.flashDeck.length) {
    if (wrap) wrap.innerHTML = `
      <div class="flash-empty">
        <p>O'rganilgan karta yo'q.</p>
        <p style="font-size:13px;color:var(--muted)">Avval kanji yoki katakana o'rganing.</p>
        <button class="fc-btn flip" onclick="setFlashType('kanji')" style="margin-top:16px">Kanji kartalariga o'tish</button>
      </div>`;
    return;
  }

  if (state.flashIdx >= state.flashDeck.length) state.flashIdx = 0;
  updateFlashCard();
}

function setFlashType(t) {
  state.flashType = t;
  state.flashIdx  = 0;
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  document.getElementById('ft-' + t)?.classList.add('active');
  initFlash();
}

function updateFlashCard() {
  const d = state.flashDeck;
  if (!d || !d.length) return;
  const k = d[state.flashIdx];

  state.flashFlipped = false;
  document.getElementById('flash-card')?.classList.remove('flipped');
  setText('fc-front',   k.k);
  setText('fc-meaning', k.m);
  setText('fc-reading', k.on + (k.kun && k.kun !== '—' ? ' / ' + k.kun : ''));
  setHTML('fc-example', `<span class="jp">${k.ex}</span> — ${k.em}`);
  setText('flash-meta', (state.flashIdx + 1) + ' / ' + d.length);

  // Progress bar in flashcard
  const pct = Math.round((state.flashIdx + 1) / d.length * 100);
  setStyle('flash-pb', 'width', pct + '%');

  const isLearned = state.learnedK.has(k.k) || state.learnedKA.has(k.k);
  const mb = document.getElementById('flash-mark-btn');
  if (mb) {
    mb.textContent = isLearned ? "✓ O'rganilgan" : "✓ O'rgandim";
    mb.classList.toggle('is-learned', isLearned);
  }
}

function flipCard() {
  state.flashFlipped = !state.flashFlipped;
  document.getElementById('flash-card')?.classList.toggle('flipped', state.flashFlipped);
}

function flashNav(dir) {
  if (!state.flashDeck.length) return;
  state.flashIdx = (state.flashIdx + dir + state.flashDeck.length) % state.flashDeck.length;
  updateFlashCard();
}

function markFlash() {
  const k = state.flashDeck[state.flashIdx];
  if (!k) return;
  if (k._kata) { state.learnedKA.add(k.k); }
  else         { state.learnedK.add(k.k); }
  save();
  showToast("✓ O'rganildi!");
  updateFlashCard();
  updateHomeStats();
}

// ============================================================
//  TEST SECTION
// ============================================================
let selType = 'k-meaning';

function selTestType(t) {
  selType = t;
  document.querySelectorAll('.ttype-card').forEach(c => c.classList.remove('sel'));
  document.getElementById('tt-' + t)?.classList.add('sel');
}

function startTest() {
  const n = parseInt(document.getElementById('qcount')?.value) || 20;
  state.testType    = selType;
  state.testQ       = buildTestQuestions(state.testType, n);
  state.testIdx     = 0;
  state.testCorrect = 0;
  state.testWrong   = 0;

  const setup = document.getElementById('test-setup');
  const area  = document.getElementById('test-area');
  const res   = document.getElementById('test-result');
  if (setup) setup.style.display = 'none';
  if (area)  area.style.display  = 'block';
  if (res)   res.style.display   = 'none';

  renderTestQ();
}

function buildTestQuestions(type, n) {
  const qs = [];

  if (type === 'k-meaning' || type === 'meaning-k') {
    const pool = shuffle([...KANJI_DATA]).slice(0, Math.min(n, KANJI_DATA.length));
    pool.forEach(k => {
      const wrongs = shuffle(KANJI_DATA.filter(x => x.k !== k.k)).slice(0, 3);
      const choices = type === 'k-meaning'
        ? shuffle([k.m, ...wrongs.map(w => w.m)])
        : shuffle([k.k, ...wrongs.map(w => w.k)]);
      qs.push({
        prompt:  type === 'k-meaning' ? k.k : k.m,
        answer:  type === 'k-meaning' ? k.m : k.k,
        choices,
        isKanji: type === 'meaning-k',
        label:   type === 'k-meaning' ? "Kanjining ma'nosini tanlang" : "Ma'nosiga mos kanjini tanlang",
        type,
      });
    });
  }

  if (type === 'kata-read') {
    const allChars = [];
    KATA_CHART.forEach(row => row.chars.forEach(c => allChars.push(c)));
    const pool = shuffle([...allChars]).slice(0, Math.min(n, allChars.length));
    pool.forEach(c => {
      const wrongs  = shuffle(allChars.filter(x => x.c !== c.c)).slice(0, 3);
      const choices = shuffle([c.r, ...wrongs.map(w => w.r)]);
      qs.push({
        prompt:  c.c,
        answer:  c.r,
        choices,
        isKanji: false,
        label:   "Bu katakana qanday o'qiladi?",
        type,
      });
    });
  }

  if (type === 'kata-word') {
    const pool = shuffle([...KATA_WORDS]).slice(0, Math.min(n, KATA_WORDS.length));
    pool.forEach(w => {
      const wrongs  = shuffle(KATA_WORDS.filter(x => x.w !== w.w)).slice(0, 3);
      const choices = shuffle([w.m, ...wrongs.map(x => x.m)]);
      qs.push({
        prompt:  w.w,
        answer:  w.m,
        choices,
        isKanji: false,
        label:   "Bu katakana so'zning ma'nosi nima?",
        type,
      });
    });
  }

  return qs;
}

function renderTestQ() {
  const q     = state.testQ[state.testIdx];
  const total = state.testQ.length;
  if (!q) { endTest(); return; }

  const pct = Math.round(state.testIdx / total * 100);
  setText('tq-label', 'Savol ' + (state.testIdx + 1) + ' / ' + total);
  setText('tq-score', '✓ ' + state.testCorrect + '  ✗ ' + state.testWrong);
  setStyle('test-pb', 'width', pct + '%');
  setText('q-label', q.label);

  const qc = document.getElementById('q-content');
  if (qc) {
    const isLargeJP = q.prompt.length <= 3 && /[\u3000-\u9FFF\uF900-\uFAFF\u30A0-\u30FF]/.test(q.prompt);
    qc.innerHTML = isLargeJP
      ? `<div class="qchar jp">${escHtml(q.prompt)}</div>`
      : `<div class="qtext">${escHtml(q.prompt)}</div>`;
  }

  const cc = document.getElementById('choices');
  if (!cc) return;
  cc.innerHTML = q.choices.map((c, i) => {
    const isJP = q.isKanji || /[\u3000-\u9FFF\u30A0-\u30FF]/.test(c);
    return `<button class="choice${isJP ? ' jp' : ''}" 
              data-choice="${escAttr(c)}" 
              data-answer="${escAttr(q.answer)}"
              onclick="answerTest(this)">
              ${escHtml(c)}
            </button>`;
  }).join('');
}

function answerTest(btn) {
  const chosen  = btn.getAttribute('data-choice');
  const correct = btn.getAttribute('data-answer');

  // Disable all buttons
  document.querySelectorAll('.choice').forEach(b => {
    b.disabled = true;
    b.onclick  = null;
  });

  if (chosen === correct) {
    btn.classList.add('correct');
    state.testCorrect++;
  } else {
    btn.classList.add('wrong');
    state.testWrong++;
    // Highlight the correct answer
    document.querySelectorAll('.choice').forEach(b => {
      if (b.getAttribute('data-choice') === correct) b.classList.add('correct');
    });
  }

  setText('tq-score', '✓ ' + state.testCorrect + '  ✗ ' + state.testWrong);

  setTimeout(() => {
    state.testIdx++;
    if (state.testIdx >= state.testQ.length) endTest();
    else renderTestQ();
  }, 1000);
}

function endTest() {
  const area = document.getElementById('test-area');
  const res  = document.getElementById('test-result');
  if (area) area.style.display = 'none';
  if (res)  res.style.display  = 'block';

  const total = state.testQ.length;
  const pct   = total > 0 ? Math.round(state.testCorrect / total * 100) : 0;
  setText('res-pct', pct + '%');
  setText('res-c',   state.testCorrect);
  setText('res-w',   state.testWrong);

  const msg =
    pct >= 90 ? '🎉 Ajoyib! Siz ustasiz!' :
    pct >= 70 ? '👏 Yaxshi natija! Davom eting!' :
    pct >= 50 ? "📚 Yaxshi, lekin ko'proq o'qing!" :
                '💪 Kuch bilan davom eting!';
  setText('res-msg', msg);

  const typeLabels = {
    'k-meaning':  "Kanji → Ma'no",
    'meaning-k':  "Ma'no → Kanji",
    'kata-read':  "Katakana O'qish",
    'kata-word':  "Katakana So'z",
  };

  state.history.unshift({
    date:    new Date().toLocaleDateString('uz-UZ'),
    type:    typeLabels[state.testType] || 'Test',
    score:   pct + '%',
    details: state.testCorrect + '/' + total,
    pct,
  });
  save();
}

function retryTest() {
  const res = document.getElementById('test-result');
  if (res) res.style.display = 'none';
  startTest();
}

function backToTestSetup() {
  const area  = document.getElementById('test-area');
  const res   = document.getElementById('test-result');
  const setup = document.getElementById('test-setup');
  if (area)  area.style.display  = 'none';
  if (res)   res.style.display   = 'none';
  if (setup) setup.style.display = '';
}

// ============================================================
//  PROGRESS SECTION
// ============================================================
function renderProgress() {
  const kTotal  = KANJI_DATA.length;
  const kaTotal = 46;
  const kwTotal = KATA_WORDS.length;

  const kLearned  = state.learnedK.size;
  const kaLearned = state.learnedKA.size;
  const kwLearned = state.learnedKW.size;

  setText('pk-count',  kLearned  + ' / ' + kTotal);
  setText('pka-count', kaLearned + ' / ' + kaTotal);
  setText('pkw-count', kwLearned + ' / ' + kwTotal);

  setStyle('pk-bar',  'width', Math.round(kLearned  / kTotal  * 100) + '%');
  setStyle('pka-bar', 'width', Math.round(kaLearned / kaTotal * 100) + '%');
  setStyle('pkw-bar', 'width', Math.round(kwLearned / kwTotal * 100) + '%');

  const hl = document.getElementById('hist-list');
  if (!hl) return;

  if (!state.history.length) {
    hl.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:14px">Hali test topshirilmagan</div>';
    return;
  }

  hl.innerHTML = state.history.map(h => {
    const cls = !h.pct ? '' : h.pct >= 70 ? 'good' : h.pct < 50 ? 'bad' : '';
    return `<div class="hist-item">
      <span class="hi-date">${escHtml(h.date)}</span>
      <span class="hi-type">${escHtml(h.type)} <small style="color:var(--muted)">(${escHtml(h.details)})</small></span>
      <span class="hi-score ${cls}">${escHtml(h.score)}</span>
    </div>`;
  }).join('');
}

function resetProgress() {
  if (!confirm("Barcha progressni o'chirishni xohlaysizmi? Bu amalni qaytarib bo'lmaydi.")) return;
  state.learnedK.clear();
  state.learnedKA.clear();
  state.learnedKW.clear();
  state.history = [];
  ['lk','lka','lkw','hist'].forEach(k => localStorage.removeItem(k));
  renderProgress();
  updateHomeStats();
  renderKanji();
  renderKatakana();
  showToast('Progress tozalandi');
}

// ============================================================
//  DAILY REVIEW
// ============================================================
function startDaily() {
  const notLearned = KANJI_DATA.filter(k => !state.learnedK.has(k.k));
  if (!notLearned.length) {
    showToast("🎉 Barcha kanjini o'rgandingiz!");
    return;
  }
  state.flashType  = 'kanji';
  state.flashDeck  = shuffle(notLearned).slice(0, 10);
  state.flashIdx   = 0;
  state.flashFlipped = false;
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  document.getElementById('ft-kanji')?.classList.add('active');
  showSection('flash');
  showToast('📅 Kunlik takrorlash boshlandi!');
}

// ============================================================
//  TOAST NOTIFICATION
// ============================================================
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ============================================================
//  KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', e => {
  const activeSection = document.querySelector('.section.active')?.id;
  const modalOpen = document.getElementById('modal-overlay')?.classList.contains('open');

  // Modal navigation
  if (modalOpen) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'ArrowLeft')  { modalNav(-1); return; }
    if (e.key === 'ArrowRight') { modalNav(1);  return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const lb = document.getElementById('learn-btn');
      if (lb && !lb.classList.contains('done')) lb.click();
      return;
    }
  }

  // Flashcard shortcuts
  if (activeSection === 's-flash' && !modalOpen) {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      flipCard();
    }
    if (e.key === 'ArrowLeft')  { flashNav(-1); }
    if (e.key === 'ArrowRight') { flashNav(1); }
    if (e.key === 'Enter') {
      const mb = document.getElementById('flash-mark-btn');
      if (mb && !mb.classList.contains('is-learned')) mb.click();
    }
  }
});

// ============================================================
//  UTILITY FUNCTIONS
// ============================================================
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setHTML(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = val;
}

function setStyle(id, prop, val) {
  const el = document.getElementById(id);
  if (el) el.style[prop] = val;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Ensure filter button states are correct on load
  const allBtn = document.getElementById('filter-all');
  if (allBtn) allBtn.classList.add('active-filter');

  updateHomeStats();
  renderKanji();

  // Lazy init other sections only when visited
  console.log(
    '%c🇯🇵 Yapon Tili N4%c loaded successfully — ' + KANJI_DATA.length + ' kanji, ' + KATA_WORDS.length + ' words',
    'color:#2563EB;font-weight:900;font-size:16px',
    'color:#64748B;font-size:12px'
  );
});
