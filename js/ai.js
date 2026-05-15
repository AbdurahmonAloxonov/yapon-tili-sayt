/* ============================================================
   YAPON TILI — ai.js  (Gemini API)
   ============================================================ */
'use strict';

// ⬇️ SHU YERGA O'Z KALITINGIZNI YOZING
const API_KEY = 'AIzaSyCv-wcmEu0O7zochkRaUTZZ6RaciPBkoGk';

const AI = (() => {
  const messages = [];

  const SYSTEM_PROMPT = `Sen "AI Sensei" — yapon tili o'qituvchisisiz. O'zbekiston foydalanuvchilariga JLPT N4 darajasidagi yapon tilini o'rgatasan.
Qoidalar:
- Har doim O'ZBEK tilida javob ber
- Qisqa va aniq javob ber (2-4 gap)
- Kanji yozganda: kanji (hiragana) — ma'no formatida yoz
- Misollar ber: yaponcha + o'zbekcha tarjimasi
- Muloyim va rag'batlantiruvchi bo'l
Bu saytda 300 ta JLPT N4 kanji va katakana o'rgatiladi.`;

  function el(id) { return document.getElementById(id); }

  function renderMsg(role, text) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-msg ' + (role === 'user' ? 'ai-msg--user' : 'ai-msg--bot');
    if (role === 'assistant') {
      const av = document.createElement('div');
      av.className = 'ai-avatar'; av.textContent = '先';
      wrap.appendChild(av);
    }
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.innerHTML = text.replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    wrap.appendChild(bubble);
    el('ai-messages').appendChild(wrap);
    el('ai-messages').scrollTop = el('ai-messages').scrollHeight;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'ai-msg ai-msg--bot'; div.id = 'ai-typing';
    div.innerHTML = '<div class="ai-avatar">先</div><div class="ai-bubble ai-typing-dots"><span></span><span></span><span></span></div>';
    el('ai-messages').appendChild(div);
    el('ai-messages').scrollTop = el('ai-messages').scrollHeight;
  }
  function hideTyping() { const t = el('ai-typing'); if(t) t.remove(); }

  async function send() {
    const inp = el('ai-input');
    const text = inp.value.trim();
    if (!text) return;

    if (API_KEY === 'BU_YERGA_KALITINGIZNI_YOZING') {
      renderMsg('assistant', '⚠️ ai.js faylida API_KEY ni to\'ldiring.');
      return;
    }

    inp.value = ''; inp.disabled = true; el('ai-send').disabled = true;
    messages.push({ role: 'user', parts: [{ text }] });
    renderMsg('user', text);
    showTyping();

    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + API_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: messages.slice(-10)
          })
        }
      );
      const data = await res.json();
      hideTyping();
      if (data.candidates && data.candidates[0]) {
        const reply = data.candidates[0].content.parts[0].text;
        messages.push({ role: 'model', parts: [{ text: reply }] });
        renderMsg('assistant', reply);
      } else {
        renderMsg('assistant', '❌ Xato: ' + (data.error ? data.error.message : 'Qayta urinib ko\'ring'));
      }
    } catch(err) {
      hideTyping();
      renderMsg('assistant', '❌ Tarmoq xatosi. Internetni tekshiring.');
    }
    inp.disabled = false; el('ai-send').disabled = false; inp.focus();
  }

  function askQuick(text) { el('ai-input').value = text; send(); }

  function init() {
    el('ai-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    setTimeout(() => {
      renderMsg('assistant',
        'Salom! Men AI Sensei 🎌\n\nKanji, grammatika yoki JLPT N4 haqida savol bering.\nMisol: "水 kanji nima degani?"');
    }, 300);
  }

  return { init, send, askQuick };
})();
