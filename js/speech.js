/* ============================================================
   speech.js — Robust Web Speech API for Japanese TTS
   ============================================================ */

'use strict';

const Speech = (() => {
  const synth   = window.speechSynthesis;
  let jpVoice   = null;
  let allVoices = [];
  let ready     = false;
  let pendingQueue = [];

  /* ── 1. Load voices with retry ── */
  function loadVoices() {
    if (!synth) return;
    allVoices = synth.getVoices();

    // Priority order: exact ja-JP → any ja → any voice (last resort)
    jpVoice =
      allVoices.find(v => v.lang === 'ja-JP' && v.localService) ||
      allVoices.find(v => v.lang === 'ja-JP') ||
      allVoices.find(v => v.lang.startsWith('ja')) ||
      null;

    ready = allVoices.length > 0;

    if (ready) {
      console.log(
        '%c🔊 TTS ready%c ' + allVoices.length + ' voices loaded. JP voice: ' +
        (jpVoice ? jpVoice.name + ' (' + jpVoice.lang + ')' : 'none — will use lang=ja-JP fallback'),
        'color:#059669;font-weight:700', 'color:#475569'
      );
      updateIndicator(true);
      // Flush any queued speaks
      pendingQueue.forEach(fn => fn());
      pendingQueue = [];
    }
  }

  /* ── 2. Init with multiple strategies ── */
  function init() {
    if (!synth) {
      console.warn('SpeechSynthesis not supported in this browser.');
      updateIndicator(false);
      return;
    }

    // Strategy A: immediate call (works if voices already cached)
    loadVoices();

    // Strategy B: onvoiceschanged event
    synth.onvoiceschanged = loadVoices;

    // Strategy C: polling fallback (Firefox, some Android browsers)
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      loadVoices();
      if (ready || attempts >= 20) clearInterval(poll);
    }, 250);
  }

  /* ── 3. Core speak function ── */
  function speak(text, opts = {}) {
    if (!synth || !text) return;

    const {
      rate   = 0.80,
      pitch  = 1.0,
      onEnd  = null,
      onError = null,
      force  = false,   // skip queue, speak immediately
    } = opts;

    // If voices not ready yet — queue or force anyway
    if (!ready && !force) {
      pendingQueue.push(() => _doSpeak(text, rate, pitch, onEnd, onError));
      // Still try immediately without a JP voice
      _doSpeak(text, rate, pitch, onEnd, onError);
      return;
    }

    _doSpeak(text, rate, pitch, onEnd, onError);
  }

  function _doSpeak(text, rate, pitch, onEnd, onError) {
    // Cancel any current speech
    if (synth.speaking) synth.cancel();

    // Small delay after cancel to avoid Chrome bug where it silently fails
    setTimeout(() => {
      const utt   = new SpeechSynthesisUtterance(text);
      utt.lang    = 'ja-JP';
      utt.rate    = rate;
      utt.pitch   = pitch;

      // Assign voice if we have one, otherwise lang hint alone often works on Chrome
      if (jpVoice) utt.voice = jpVoice;

      utt.onend = () => {
        if (onEnd) onEnd();
      };

      utt.onerror = (e) => {
        // 'interrupted' is normal when cancel() is called
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('TTS error:', e.error, 'text:', text);
          if (onError) onError(e);
        }
      };

      synth.speak(utt);

      // Chrome bug workaround: speechSynthesis sometimes freezes
      // Resume it after a short delay
      setTimeout(() => {
        if (synth.paused) synth.resume();
      }, 150);

    }, synth.speaking ? 80 : 10);
  }

  function stop() {
    if (synth && synth.speaking) synth.cancel();
  }

  function isAvailable() { return !!synth; }   // API available (voices may load later)
  function hasJpVoice()  { return !!jpVoice; }
  function getVoiceList(){ return allVoices; }

  /* ── 4. Update UI indicator ── */
  function updateIndicator(ok) {
    const el = document.getElementById('speech-status');
    if (!el) return;
    if (!synth) {
      el.textContent = '🔇 Ovoz qo\'llab-quvvatlanmaydi';
      el.style.color = 'var(--red)';
    } else if (ok && jpVoice) {
      el.textContent = '🔊 Yapon ovozi tayyor';
      el.style.color = 'var(--sec)';
    } else if (ok) {
      el.textContent = '🔊 Ovoz mavjud (JP ovozi yo\'q, standart ishlatiladi)';
      el.style.color = 'var(--acc)';
    } else {
      el.textContent = '⏳ Ovoz yuklanmoqda...';
      el.style.color = 'var(--muted)';
    }
  }

  return { init, speak, stop, isAvailable, hasJpVoice, getVoiceList };
})();
