/* ============================================================
   YAPON TILI — app.js  (v2 — Audio + Listening Test)
   ============================================================ */

'use strict';



// ============================================================
//  STATE
// ============================================================
const state = {
  learnedK:  new Set(JSON.parse(localStorage.getItem('lk')  || '[]')),
  learnedKA: new Set(JSON.parse(localStorage.getItem('lka') || '[]')),
  learnedKW: new Set(JSON.parse(localStorage.getItem('lkw') || '[]')),
  history:        JSON.parse(localStorage.getItem('hist') || '[]'),
  kanjiPage: 0, kanjiFilter: 'all', kataTab: 'chart',
  flashType: 'kanji', flashIdx: 0, flashFlipped: false, flashDeck: [],
  testType: 'k-meaning', testQ: [], testIdx: 0, testCorrect: 0, testWrong: 0,
  currentModal: null, listenText: '',
};

function save() {
  try {
    localStorage.setItem('lk',   JSON.stringify([...state.learnedK]));
    localStorage.setItem('lka',  JSON.stringify([...state.learnedKA]));
    localStorage.setItem('lkw',  JSON.stringify([...state.learnedKW]));
    localStorage.setItem('hist', JSON.stringify(state.history.slice(0, 100)));
  } catch(e) {}
}

// ============================================================
//  NAVIGATION
// ============================================================
function showSection(id) {
  Speech.stop();
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('s-' + id)?.classList.add('active');
  document.getElementById('nb-' + id)?.classList.add('active');
  document.getElementById('mn-' + id)?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id === 'kanji')    renderKanji();
  if (id === 'katakana') renderKatakana();
  if (id === 'flash')    initFlash();
  if (id === 'progress') renderProgress();
  if (id === 'home')     updateHomeStats();
  if (id === 'test') {
    document.getElementById('test-setup').style.display = '';
    document.getElementById('test-area').style.display  = 'none';
    document.getElementById('test-result').style.display = 'none';
  }
}

// ============================================================
//  HOME
// ============================================================
function updateHomeStats() {
  const kL = state.learnedK.size, kaL = state.learnedKA.size, kwL = state.learnedKW.size;
  setText('h-klearned', kL + kaL);
  setText('h-tests', state.history.length);
  setStyle('pb-k',  'width', Math.round(kL  / KANJI_DATA.length * 100) + '%');
  setStyle('pb-ka', 'width', Math.round(kaL / 46 * 100) + '%');
  setStyle('pb-kw', 'width', Math.round(kwL / KATA_WORDS.length * 100) + '%');
  setText('ph-k',  kL  + ' / ' + KANJI_DATA.length);
  setText('ph-ka', kaL + ' / 46');
  setText('ph-kw', kwL + ' / ' + KATA_WORDS.length);
}

// ============================================================
//  KANJI
// ============================================================
const PAGE_SIZE = 20;
let kanjiFiltered = [];

function setKanjiFilter(f) {
  state.kanjiFilter = f; state.kanjiPage = 0;
  ['all','learned','new'].forEach(x => {
    const b = document.getElementById('filter-'+x);
    if (b) { b.classList.remove('active-filter','on'); b.style.cssText=''; }
  });
  const ab = document.getElementById('filter-'+f);
  if (ab) { if (f==='all') ab.classList.add('active-filter'); else ab.classList.add('on'); }
  renderKanji();
}

function renderKanji() {
  const q = (document.getElementById('kanji-search')?.value || '').toLowerCase().trim();
  kanjiFiltered = KANJI_DATA.filter(k => {
    const mQ = !q || k.k.includes(q) || k.m.toLowerCase().includes(q)
                  || k.on.toLowerCase().includes(q) || k.kun.toLowerCase().includes(q) || k.ex.includes(q);
    const mF = state.kanjiFilter==='all' || (state.kanjiFilter==='learned'&&state.learnedK.has(k.k)) || (state.kanjiFilter==='new'&&!state.learnedK.has(k.k));
    return mQ && mF;
  });
  const pages = Math.max(1, Math.ceil(kanjiFiltered.length / PAGE_SIZE));
  state.kanjiPage = Math.max(0, Math.min(state.kanjiPage, pages-1));
  const slice = kanjiFiltered.slice(state.kanjiPage * PAGE_SIZE, (state.kanjiPage+1) * PAGE_SIZE);
  setText('kb-badge', state.learnedK.size + ' / ' + KANJI_DATA.length + " o'rganildi");
  const grid = document.getElementById('kanji-grid');
  if (!grid) return;
  if (!slice.length) { grid.innerHTML = '<div class="no-results">🔍 Hech narsa topilmadi</div>'; }
  else {
    grid.innerHTML = slice.map(k => {
      const learned = state.learnedK.has(k.k), gi = KANJI_DATA.indexOf(k);
      return `<div class="kcard${learned?' learned':''}" onclick="openModal(${gi})" role="button">
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
  const mk = i => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (i===cur?' active':'');
    b.textContent = i+1;
    if (i===cur) b.setAttribute('aria-current','page');
    b.addEventListener('click', () => { state.kanjiPage=i; renderKanji(); window.scrollTo({top:120,behavior:'smooth'}); });
    return b;
  };
  const dots = () => { const d=document.createElement('button'); d.className='page-btn dots'; d.textContent='…'; d.disabled=true; pp.appendChild(d); };
  if (pages<=7) { for(let i=0;i<pages;i++) pp.appendChild(mk(i)); }
  else {
    pp.appendChild(mk(0));
    if (cur>2) dots();
    for(let i=Math.max(1,cur-1);i<=Math.min(pages-2,cur+1);i++) pp.appendChild(mk(i));
    if (cur<pages-3) dots();
    pp.appendChild(mk(pages-1));
  }
}

// ============================================================
//  MODAL
// ============================================================
function openModal(idx) {
  if (idx<0||idx>=KANJI_DATA.length) return;
  const k = KANJI_DATA[idx]; state.currentModal = idx;
  setText('modal-num', '#'+(idx+1)+' / '+KANJI_DATA.length);
  setText('modal-char', k.k); setText('modal-meaning', k.m);
  setText('modal-on', k.on); setText('modal-kun', k.kun);
  setText('modal-ex', k.ex); setText('modal-exm', k.em);
  const lb = document.getElementById('learn-btn');
  if (lb) {
    if (state.learnedK.has(k.k)) { lb.textContent="✓ O'rganilgan!"; lb.classList.add('done'); }
    else { lb.textContent="✓ O'rgandim deb belgilash"; lb.classList.remove('done'); }
  }
  const sb = document.getElementById('modal-speak-btn');
  if (sb) { sb.textContent='🔊 Ovozni eshitish (Yapon)'; sb.classList.remove('speaking'); }
  document.getElementById('modal-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (!e || e.target===document.getElementById('modal-overlay')) {
    Speech.stop();
    document.getElementById('modal-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function modalNav(dir) {
  Speech.stop();
  openModal((state.currentModal + dir + KANJI_DATA.length) % KANJI_DATA.length);
}

function speakModal() {
  const k = KANJI_DATA[state.currentModal];
  if (!k) return;
  const sb = document.getElementById('modal-speak-btn');
  const text = k.ex + '。' + (k.kun!=='—' ? k.kun.replace(/[()（）・]/g,'').split('・')[0] : k.on.split('・')[0]);
  if (sb) { sb.classList.add('speaking'); sb.textContent='🔊 O\'qilyapti...'; }
  Speech.speak(text, { rate: 0.8, onEnd: () => {
    if (sb) { sb.classList.remove('speaking'); sb.textContent='🔊 Ovozni eshitish (Yapon)'; }
  }});
}

function toggleLearnModal() {
  const k = KANJI_DATA[state.currentModal];
  if (!k || state.learnedK.has(k.k)) return;
  state.learnedK.add(k.k); save();
  const lb = document.getElementById('learn-btn');
  if (lb) { lb.textContent="✓ O'rganilgan!"; lb.classList.add('done'); }
  showToast('✓ '+k.k+" — O'rganildi!"); renderKanji(); updateHomeStats();
}

// ============================================================
//  KATAKANA
// ============================================================
function renderKatakana() {
  setText('kata-badge', state.learnedKA.size+" / 46 o'rganildi");
  if (state.kataTab==='chart') renderKataChart(); else renderKataWords();
}

function setKataTab(t) {
  state.kataTab = t;
  document.getElementById('kata-chart-section').style.display = t==='chart'?'':'none';
  document.getElementById('kata-words-section').style.display = t==='words'?'':'none';
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('kt-'+t)?.classList.add('active');
  if (t==='chart') renderKataChart(); else renderKataWords();
}

function renderKataChart() {
  const q = (document.getElementById('kata-search')?.value||'').toLowerCase().trim();
  const wrap = document.getElementById('kata-chart-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  KATA_CHART.forEach(row => {
    const filtered = row.chars.filter(c => !q || c.c.includes(q) || c.r.toLowerCase().includes(q));
    if (!filtered.length) return;
    const title = document.createElement('div');
    title.className='kata-section-title'; title.textContent=row.row; wrap.appendChild(title);
    const grid = document.createElement('div'); grid.className='kata-chart';
    filtered.forEach(c => {
      const learned = state.learnedKA.has(c.c);
      const div = document.createElement('div');
      div.className = 'kata-cell'+(learned?' learned':'');
      div.setAttribute('role','button');
      div.innerHTML = `<span class="kchar">${c.c}</span><span class="krom">${c.r}</span>`;
      div.addEventListener('click', () => {
        Speech.speak(c.c, { rate: 0.75 });
        toggleKataLearned(c, div);
      });
      grid.appendChild(div);
    });
    wrap.appendChild(grid);
  });
}

function toggleKataLearned(c, el) {
  if (!state.learnedKA.has(c.c)) {
    state.learnedKA.add(c.c); save();
    if (el) el.classList.add('learned');
    showToast('✓ '+c.c+' ('+c.r+") — O'rganildi!");
    setText('kata-badge', state.learnedKA.size+" / 46 o'rganildi");
    updateHomeStats();
  } else { showToast(c.c+' — '+c.r); }
}

function renderKataWords() {
  const q = (document.getElementById('kword-search')?.value||'').toLowerCase().trim();
  const filtered = KATA_WORDS.filter(w => !q || w.w.includes(q) || w.r.toLowerCase().includes(q) || w.m.toLowerCase().includes(q));
  const grid = document.getElementById('kata-words-grid');
  if (!grid) return;
  if (!filtered.length) { grid.innerHTML='<div class="no-results" style="grid-column:1/-1">🔍 Hech narsa topilmadi</div>'; return; }
  grid.innerHTML = filtered.map(w => {
    const learned = state.learnedKW.has(w.w), oi = KATA_WORDS.indexOf(w);
    return `<div class="word-card${learned?' learned':''}" role="button">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
        <div onclick="toggleWordLearned(${oi})" style="flex:1;cursor:pointer">
          <div class="wkata">${w.w}</div>
          <div class="wpron">${w.r}</div>
          <div class="wmean">${w.m}</div>
          ${learned?'<div class="wlearned-tag">✓ O\'rganilgan</div>':''}
        </div>
        <button class="speak-btn speak-sm" onclick="Speech.speak('${escAttr(w.w)}',{rate:0.75})" title="Ovozini eshitish">🔊</button>
      </div>
    </div>`;
  }).join('');
}

function toggleWordLearned(i) {
  const w = KATA_WORDS[i]; if (!w) return;
  if (!state.learnedKW.has(w.w)) {
    state.learnedKW.add(w.w); save();
    showToast('✓ '+w.w+" — O'rganildi!"); updateHomeStats();
  } else { showToast(w.w+' — '+w.m); }
  renderKataWords();
}

// ============================================================
//  FLASHCARDS
// ============================================================
let flashAutoAudio = false;

function toggleAutoAudio(cb) {
  flashAutoAudio = cb.checked;
  showToast(flashAutoAudio ? '🔊 Avtomatik ovoz yoqildi' : '🔇 Avtomatik ovoz o\'chirildi');
}

function buildDeck() {
  if (state.flashType==='kanji') return [...KANJI_DATA];
  if (state.flashType==='katakana') {
    const all = [];
    KATA_CHART.forEach(row => row.chars.forEach(c => all.push({k:c.c,m:c.r,on:c.r,kun:'—',ex:c.c,em:'Katakana belgisi',_kata:true})));
    return all;
  }
  if (state.flashType==='learned') {
    const kL = KANJI_DATA.filter(k=>state.learnedK.has(k.k));
    const kaL = [];
    KATA_CHART.forEach(row=>row.chars.forEach(c=>{ if(state.learnedKA.has(c.c)) kaL.push({k:c.c,m:c.r,on:c.r,kun:'—',ex:c.c,em:'Katakana belgisi',_kata:true}); }));
    return [...kL,...kaL];
  }
  return [...KANJI_DATA];
}

function initFlash() {
  state.flashDeck = buildDeck();
  if (!state.flashDeck.length) {
    const w = document.querySelector('.flash-wrap');
    if (w) w.innerHTML=`<div class="flash-empty"><p>O'rganilgan karta yo'q.</p><button class="fc-btn flip" onclick="setFlashType('kanji')" style="margin-top:16px">Kanji kartalariga o'tish</button></div>`;
    return;
  }
  if (state.flashIdx>=state.flashDeck.length) state.flashIdx=0;
  updateFlashCard();
}

function setFlashType(t) {
  state.flashType=t; state.flashIdx=0; state.flashFlipped=false; Speech.stop();
  document.querySelectorAll('.ftab').forEach(b=>b.classList.remove('active'));
  document.getElementById('ft-'+t)?.classList.add('active');
  initFlash();
}

function updateFlashCard() {
  const d = state.flashDeck; if (!d?.length) return;
  const k = d[state.flashIdx];
  state.flashFlipped = false;
  document.getElementById('flash-card')?.classList.remove('flipped');
  setText('fc-front', k.k); setText('fc-meaning', k.m);
  setText('fc-reading', k.on+(k.kun&&k.kun!=='—'?' / '+k.kun:''));
  setHTML('fc-example', `<span class="jp">${k.ex}</span> — ${k.em}`);
  setText('flash-meta', (state.flashIdx+1)+' / '+d.length);
  setStyle('flash-pb','width', Math.round((state.flashIdx+1)/d.length*100)+'%');
  const isL = state.learnedK.has(k.k)||state.learnedKA.has(k.k);
  const mb = document.getElementById('flash-mark-btn');
  if (mb) { mb.textContent=isL?"✓ O'rganilgan":"✓ O'rgandim"; mb.classList.toggle('is-learned',isL); }
  if (flashAutoAudio) setTimeout(()=>Speech.speak(k.k,{rate:0.75}), 300);
}

function flipCard() {
  state.flashFlipped=!state.flashFlipped;
  document.getElementById('flash-card')?.classList.toggle('flipped', state.flashFlipped);
  if (state.flashFlipped && flashAutoAudio) {
    const k = state.flashDeck[state.flashIdx];
    if (k) { const t=k.ex+(k.kun!=='—'?'。'+k.kun.replace(/[()（）・]/g,''):''); setTimeout(()=>Speech.speak(t,{rate:0.75}),200); }
  }
}

function flashNav(dir) {
  if (!state.flashDeck?.length) return;
  Speech.stop(); state.flashIdx=(state.flashIdx+dir+state.flashDeck.length)%state.flashDeck.length;
  updateFlashCard();
}

function markFlash() {
  const k=state.flashDeck?.[state.flashIdx]; if (!k) return;
  if (k._kata) state.learnedKA.add(k.k); else state.learnedK.add(k.k);
  save(); showToast("✓ O'rganildi!"); updateFlashCard(); updateHomeStats();
}

function speakCurrentFlash() {
  const k=state.flashDeck?.[state.flashIdx]; if (!k) return;
  const btn=document.getElementById('flash-speak-btn');
  if (btn) btn.classList.add('speaking');
  Speech.speak(k.k, {rate:0.75, onEnd:()=>btn?.classList.remove('speaking')});
}

// ============================================================
//  TEST
// ============================================================
let selType = 'k-meaning';

function selTestType(t) {
  selType=t;
  document.querySelectorAll('.ttype-card').forEach(c=>{c.classList.remove('sel');c.setAttribute('aria-checked','false');});
  const card=document.getElementById('tt-'+t);
  if(card){card.classList.add('sel');card.setAttribute('aria-checked','true');}
}

function startTest() {
  const n=parseInt(document.getElementById('qcount')?.value)||20;
  state.testType=selType; state.testQ=buildTestQuestions(selType,n);
  state.testIdx=0; state.testCorrect=0; state.testWrong=0;
  document.getElementById('test-setup').style.display='none';
  document.getElementById('test-area').style.display='block';
  document.getElementById('test-result').style.display='none';
  renderTestQ();
}

function buildTestQuestions(type,n) {
  const qs=[];
  if (type==='k-meaning'||type==='meaning-k') {
    shuffle([...KANJI_DATA]).slice(0,Math.min(n,KANJI_DATA.length)).forEach(k=>{
      const wrongs=shuffle(KANJI_DATA.filter(x=>x.k!==k.k)).slice(0,3);
      const choices=type==='k-meaning'?shuffle([k.m,...wrongs.map(w=>w.m)]):shuffle([k.k,...wrongs.map(w=>w.k)]);
      qs.push({prompt:type==='k-meaning'?k.k:k.m, answer:type==='k-meaning'?k.m:k.k, choices, isKanji:type==='meaning-k', label:type==='k-meaning'?"Kanjining ma'nosini tanlang":"Ma'nosiga mos kanjini tanlang", type});
    });
  }
  if (type==='kata-read') {
    const ac=[]; KATA_CHART.forEach(r=>r.chars.forEach(c=>ac.push(c)));
    shuffle([...ac]).slice(0,Math.min(n,ac.length)).forEach(c=>{
      const wrongs=shuffle(ac.filter(x=>x.c!==c.c)).slice(0,3);
      qs.push({prompt:c.c, answer:c.r, choices:shuffle([c.r,...wrongs.map(w=>w.r)]), isKanji:false, label:"Bu katakana qanday o'qiladi?", type});
    });
  }
  if (type==='kata-word') {
    shuffle([...KATA_WORDS]).slice(0,Math.min(n,KATA_WORDS.length)).forEach(w=>{
      const wrongs=shuffle(KATA_WORDS.filter(x=>x.w!==w.w)).slice(0,3);
      qs.push({prompt:w.w, answer:w.m, choices:shuffle([w.m,...wrongs.map(x=>x.m)]), isKanji:false, label:"Bu katakana so'zning ma'nosi nima?", type});
    });
  }
  if (type==='listen') {
    shuffle([...KANJI_DATA]).slice(0,Math.min(n,KANJI_DATA.length)).forEach(k=>{
      const wrongs=shuffle(KANJI_DATA.filter(x=>x.k!==k.k)).slice(0,3);
      const readText=k.ex+'。'+(k.kun!=='—'?k.kun.replace(/[()（）・]/g,'').split('・')[0]:k.on.split('・')[0]);
      qs.push({prompt:null, speakText:readText, kanjiChar:k.k, answer:k.m, choices:shuffle([k.m,...wrongs.map(w=>w.m)]), isKanji:false, label:"🔊 Ovozni eshiting va ma'nosini tanlang", type:'listen'});
    });
  }
  return qs;
}

function renderTestQ() {
  const q=state.testQ[state.testIdx], total=state.testQ.length;
  if (!q){endTest();return;}
  setText('tq-label','Savol '+(state.testIdx+1)+' / '+total);
  setText('tq-score','✓ '+state.testCorrect+'  ✗ '+state.testWrong);
  setStyle('test-pb','width',Math.round(state.testIdx/total*100)+'%');
  setText('q-label',q.label);
  const qc=document.getElementById('q-content');
  if (qc) {
    if (q.type==='listen') {
      state.listenText=q.speakText;
      qc.innerHTML=`<div class="listen-prompt">
        <div class="listen-play-btn" id="listen-play-btn" onclick="playListenAudio()" aria-label="Ovozni eshitish"></div>
        <div class="listen-hint">Tugmani bosing va ovozni eshiting</div>
        <div style="font-size:11px;color:var(--muted)">Qayta eshitish: <kbd>R</kbd></div>
      </div>`;
      setTimeout(()=>playListenAudio(),700);
    } else {
      const isL=q.prompt.length<=3&&/[\u3000-\u9FFF\uF900-\uFAFF\u30A0-\u30FF]/.test(q.prompt);
      qc.innerHTML=isL?`<div class="qchar jp">${escHtml(q.prompt)}</div>`:`<div class="qtext">${escHtml(q.prompt)}</div>`;
    }
  }
  const cc=document.getElementById('choices');
  if (!cc) return;
  cc.innerHTML=q.choices.map(c=>{
    const isJP=q.isKanji||/[\u3000-\u9FFF\u30A0-\u30FF]/.test(c);
    return `<button class="choice${isJP?' jp':''}" data-choice="${escAttr(c)}" data-answer="${escAttr(q.answer)}" onclick="answerTest(this)">${escHtml(c)}</button>`;
  }).join('');
}

function playListenAudio() {
  if (!state.listenText) return;
  const btn=document.getElementById('listen-play-btn');
  if (btn) btn.classList.add('playing');
  Speech.speak(state.listenText, {rate:0.75, onEnd:()=>btn?.classList.remove('playing')});
}

function answerTest(btn) {
  const chosen=btn.getAttribute('data-choice'), correct=btn.getAttribute('data-answer');
  document.querySelectorAll('.choice').forEach(b=>{b.disabled=true;b.onclick=null;});
  if (chosen===correct){btn.classList.add('correct');state.testCorrect++;}
  else {
    btn.classList.add('wrong');state.testWrong++;
    document.querySelectorAll('.choice').forEach(b=>{if(b.getAttribute('data-choice')===correct)b.classList.add('correct');});
  }
  setText('tq-score','✓ '+state.testCorrect+'  ✗ '+state.testWrong);
  const q=state.testQ[state.testIdx];
  if (q?.type==='listen'&&q.kanjiChar) {
    const qc=document.getElementById('q-content');
    if (qc) qc.innerHTML+=`<div class="qchar jp" style="font-size:56px;margin-top:12px;opacity:.75">${escHtml(q.kanjiChar)}</div>`;
  }
  setTimeout(()=>{state.testIdx++;Speech.stop();if(state.testIdx>=state.testQ.length)endTest();else renderTestQ();},1100);
}

function endTest() {
  document.getElementById('test-area').style.display='none';
  document.getElementById('test-result').style.display='block';
  Speech.stop();
  const total=state.testQ.length, pct=total>0?Math.round(state.testCorrect/total*100):0;
  setText('res-pct',pct+'%'); setText('res-c',state.testCorrect); setText('res-w',state.testWrong);
  setText('res-msg', pct>=90?'🎉 Ajoyib! Siz ustasiz!':pct>=70?'👏 Yaxshi natija! Davom eting!':pct>=50?"📚 Yaxshi, lekin ko'proq o'qing!":'💪 Kuch bilan davom eting!');
  state.history.unshift({date:new Date().toLocaleDateString('uz-UZ'),type:{'k-meaning':"Kanji → Ma'no",'meaning-k':"Ma'no → Kanji",'kata-read':"Katakana O'qish",'kata-word':"Katakana So'z",'listen':"🔊 Listening"}[state.testType]||'Test',score:pct+'%',details:state.testCorrect+'/'+total,pct});
  save();
}

function retryTest(){document.getElementById('test-result').style.display='none';startTest();}
function backToTestSetup(){Speech.stop();document.getElementById('test-area').style.display='none';document.getElementById('test-result').style.display='none';document.getElementById('test-setup').style.display='';}

// ============================================================
//  PROGRESS
// ============================================================
function renderProgress() {
  const kL=state.learnedK.size,kaL=state.learnedKA.size,kwL=state.learnedKW.size;
  setText('pk-count',kL+' / '+KANJI_DATA.length); setText('pka-count',kaL+' / 46'); setText('pkw-count',kwL+' / '+KATA_WORDS.length);
  setStyle('pk-bar','width',Math.round(kL/KANJI_DATA.length*100)+'%');
  setStyle('pka-bar','width',Math.round(kaL/46*100)+'%');
  setStyle('pkw-bar','width',Math.round(kwL/KATA_WORDS.length*100)+'%');
  const hl=document.getElementById('hist-list'); if (!hl) return;
  if (!state.history.length){hl.innerHTML='<div style="text-align:center;color:var(--muted);padding:20px;font-size:14px">Hali test topshirilmagan</div>';return;}
  hl.innerHTML=state.history.map(h=>`<div class="hist-item"><span class="hi-date">${escHtml(h.date)}</span><span class="hi-type">${escHtml(h.type)} <small style="color:var(--muted)">(${escHtml(h.details)})</small></span><span class="hi-score ${!h.pct?'':h.pct>=70?'good':h.pct<50?'bad':''}">${escHtml(h.score)}</span></div>`).join('');
}

function resetProgress() {
  if (!confirm("Barcha progressni o'chirishni xohlaysizmi?")) return;
  state.learnedK.clear();state.learnedKA.clear();state.learnedKW.clear();state.history=[];
  ['lk','lka','lkw','hist'].forEach(k=>localStorage.removeItem(k));
  renderProgress();updateHomeStats();renderKanji();
  showToast('Progress tozalandi');
}

// ============================================================
//  DAILY
// ============================================================
function startDaily() {
  const notL=KANJI_DATA.filter(k=>!state.learnedK.has(k.k));
  if (!notL.length){showToast("🎉 Barcha kanjini o'rgandingiz!");return;}
  state.flashType='kanji';state.flashDeck=shuffle(notL).slice(0,10);state.flashIdx=0;state.flashFlipped=false;
  document.querySelectorAll('.ftab').forEach(b=>b.classList.remove('active'));
  document.getElementById('ft-kanji')?.classList.add('active');
  showSection('flash');showToast('📅 Kunlik takrorlash boshlandi!');
}

// ============================================================
//  KEYBOARD
// ============================================================
document.addEventListener('keydown',e=>{
  const active=document.querySelector('.section.active')?.id;
  const mo=document.getElementById('modal-overlay')?.classList.contains('open');
  if (mo) {
    if(e.key==='Escape')closeModal();
    else if(e.key==='ArrowLeft')modalNav(-1);
    else if(e.key==='ArrowRight')modalNav(1);
    else if(e.key==='s'||e.key==='S')speakModal();
    return;
  }
  if (active==='s-flash'){
    if(e.key===' '||e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();flipCard();}
    if(e.key==='ArrowLeft')flashNav(-1);
    if(e.key==='ArrowRight')flashNav(1);
    if(e.key==='Enter')document.getElementById('flash-mark-btn')?.click();
    if(e.key==='s'||e.key==='S')speakCurrentFlash();
  }
  if (active==='s-test'){
    if(e.key==='r'||e.key==='R')document.getElementById('listen-play-btn')?.click();
  }
});

// ============================================================
//  TOAST + UTILS
// ============================================================
let toastTimer=null;
function showToast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2400);}
function setText(id,val){const e=document.getElementById(id);if(e)e.textContent=val;}
function setHTML(id,val){const e=document.getElementById(id);if(e)e.innerHTML=val;}
function setStyle(id,p,v){const e=document.getElementById(id);if(e)e.style[p]=v;}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function shuffle(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}

// ============================================================
//  INIT
// ============================================================
/* ============================================================
//  TEST SPEECH BUTTON
// ============================================================ */
function testSpeechNow() {
  const testWords = ['こんにちは', 'ありがとう', '日本語', '勉強'];
  const word = testWords[Math.floor(Math.random() * testWords.length)];
  Speech.speak(word, {
    rate: 0.8,
    force: true,
    onError: (e) => showToast('⚠️ Ovoz xatosi: ' + e.error + '. Chrome/Edge tavsiya etiladi.')
  });
  showToast('🔊 Test: ' + word);
}

document.addEventListener('DOMContentLoaded', () => {
  // Init speech engine
  Speech.init();

  // After 1s, show voice diagnostic in console
  setTimeout(() => {
    const voices = Speech.getVoiceList();
    const jp = voices.filter(v => v.lang.startsWith('ja'));
    console.log('%c🔊 Voice diagnostic', 'color:#2563EB;font-weight:700');
    console.log('Total voices:', voices.length);
    console.log('Japanese voices:', jp.map(v => v.name + ' (' + v.lang + ')'));
    if (!voices.length) {
      console.warn('No voices loaded. Try clicking anywhere on the page first (browser security requirement).');
    }
  }, 1000);

  document.getElementById('filter-all')?.classList.add('active-filter');
  updateHomeStats();
  renderKanji();
});
