/* ============================================================
   speech.js — Android & iOS uchun moslashtirilgan TTS
   ============================================================ */

'use strict';

const Speech = (() => {
  const synth = window.speechSynthesis;
  let jpVoice   = null;
  let allVoices = [];
  let ready     = false;
  let userInteracted = false;
  let pendingSpeak   = null;

  /* ── 1. User interaction kuzatish ── */
  function markInteraction() {
    if (userInteracted) return;
    userInteracted = true;
    // Agar pending speak bo'lsa, endi bajar
    if (pendingSpeak) {
      const fn = pendingSpeak;
      pendingSpeak = null;
      setTimeout(fn, 100);
    }
  }

  // Har qanday touch/click da flag o'rnatiladi
  document.addEventListener('touchstart', markInteraction, { once: true, passive: true });
  document.addEventListener('click',      markInteraction, { once: true });
  document.addEventListener('keydown',    markInteraction, { once: true });

  /* ── 2. Ovozlarni yuklash ── */
  function loadVoices() {
    if (!synth) return;
    allVoices = synth.getVoices();

    // Eng yaxshi yapon ovozini topish
    jpVoice =
      allVoices.find(v => v.lang === 'ja-JP' && v.localService) ||
      allVoices.find(v => v.lang === 'ja-JP') ||
      allVoices.find(v => v.lang.startsWith('ja')) ||
      null;

    ready = allVoices.length > 0;
    if (ready) updateIndicator(true);
  }

  /* ── 3. Init ── */
  function init() {
    if (!synth) {
      updateIndicator(false);
      return;
    }

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    // Android uchun polling
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      loadVoices();
      if (ready || attempts >= 30) clearInterval(poll);
    }, 300);
  }

  /* ── 4. Android Chrome bug workaround ── */
  function androidResume() {
    if (!synth) return;
    // Android Chrome da synth o'zicha to'xtab qoladi — har 10s resume
    const timer = setInterval(() => {
      if (!synth.speaking) { clearInterval(timer); return; }
      synth.pause();
      synth.resume();
    }, 10000);
    return timer;
  }

  /* ── 5. Core speak ── */
  function speak(text, opts = {}) {
    if (!synth || !text) return;

    const {
      rate    = 0.80,
      pitch   = 1.0,
      onEnd   = null,
      onError = null,
      force   = false,
    } = opts;

    // User interaksiya bo'lmasa kutish
    if (!userInteracted && !force) {
      pendingSpeak = () => _doSpeak(text, rate, pitch, onEnd, onError);
      // Baribir urinib ko'rish
      _doSpeak(text, rate, pitch, onEnd, onError);
      return;
    }

    _doSpeak(text, rate, pitch, onEnd, onError);
  }

  function _doSpeak(text, rate, pitch, onEnd, onError) {
    try {
      if (synth.speaking) synth.cancel();

      setTimeout(() => {
        try {
          const utt = new SpeechSynthesisUtterance(text);
          utt.lang  = 'ja-JP';
          utt.rate  = rate;
          utt.pitch = pitch;
          if (jpVoice) utt.voice = jpVoice;

          utt.onstart = () => {
            // Android bug workaround
            androidResume();
          };

          utt.onend = () => {
            if (onEnd) onEnd();
          };

          utt.onerror = (e) => {
            if (e.error !== 'interrupted' && e.error !== 'canceled') {
              console.warn('TTS xato:', e.error, '| Matn:', text);
              if (onError) onError(e);
              updateIndicator(false, e.error);
            }
          };

          synth.speak(utt);

          // Chrome/Android freeze bug fix
          setTimeout(() => {
            if (synth.paused) synth.resume();
          }, 200);

        } catch(err) {
          console.warn('TTS exception:', err);
        }
      }, synth.speaking ? 100 : 20);

    } catch(err) {
      console.warn('Speech cancel error:', err);
    }
  }

  function stop() {
    try {
      if (synth && (synth.speaking || synth.pending)) synth.cancel();
    } catch(e) {}
  }

  function isAvailable() { return !!synth; }
  function hasJpVoice()  { return !!jpVoice; }
  function getVoiceList(){ return allVoices; }

  /* ── 6. UI holat ko'rsatgich ── */
  function updateIndicator(ok, errMsg) {
    const el = document.getElementById('speech-status');
    if (!el) return;
    if (!synth) {
      el.textContent = '🔇 Ovoz qo\'llab-quvvatlanmaydi';
      el.style.color = 'var(--red)';
    } else if (errMsg) {
      el.textContent = '⚠️ Xato: ' + errMsg;
      el.style.color = 'var(--red)';
    } else if (ok && jpVoice) {
      el.textContent = '✅ Yapon ovozi tayyor';
      el.style.color = 'var(--sec)';
    } else if (ok) {
      el.textContent = '🔊 Standart ovoz (Yapon ovozi topilmadi)';
      el.style.color = 'var(--acc)';
    } else {
      el.textContent = '⏳ Ovoz yuklanmoqda... (ekranga teging)';
      el.style.color = 'var(--muted)';
    }
  }

  return { init, speak, stop, isAvailable, hasJpVoice, getVoiceList };
})();
