/* ============================================================
   speech.js — Google Translate TTS (Android/iOS uchun ishonchli)
   Web Speech API EMAS — Audio element orqali ishlaydi
   ============================================================ */

'use strict';

const Speech = (() => {
  let currentAudio = null;
  let speakingBtn  = null;

  /* ── Google Translate TTS URL ── */
  function getTTSUrl(text) {
    const encoded = encodeURIComponent(text);
    return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=ja&client=tw-ob`;
  }

  /* ── Asosiy speak funksiya ── */
  function speak(text, opts = {}) {
    if (!text) return;
    const { onEnd = null, onError = null } = opts;

    // Oldingi audioni to'xtatish
    stop();

    const url   = getTTSUrl(text);
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    currentAudio = audio;

    audio.onended = () => {
      resetBtn();
      if (onEnd) onEnd();
    };

    audio.onerror = () => {
      // Google TTS CORS blok qilsa — Web Speech API ga fallback
      console.warn('Google TTS xato — Web Speech fallback');
      resetBtn();
      fallbackSpeak(text, opts);
      if (onError) onError();
    };

    audio.play().catch(() => {
      resetBtn();
      fallbackSpeak(text, opts);
    });
  }

  /* ── Fallback: Web Speech API ── */
  function fallbackSpeak(text, opts = {}) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (synth.speaking) synth.cancel();

    setTimeout(() => {
      const utt   = new SpeechSynthesisUtterance(text);
      utt.lang    = 'ja-JP';
      utt.rate    = opts.rate || 0.80;
      utt.pitch   = 1.0;
      const jpVoice = synth.getVoices().find(v => v.lang.startsWith('ja'));
      if (jpVoice) utt.voice = jpVoice;
      utt.onend   = () => { if (opts.onEnd) opts.onEnd(); };
      utt.onerror = (e) => { if (e.error !== 'interrupted') console.warn('TTS xato:', e.error); };
      synth.speak(utt);
      if (synth.paused) synth.resume();
    }, 50);
  }

  /* ── To'xtatish ── */
  function stop() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel();
    }
    resetBtn();
  }

  function resetBtn() {
    if (speakingBtn) {
      speakingBtn.classList.remove('speaking');
      if (speakingBtn.dataset.orig) {
        speakingBtn.textContent = speakingBtn.dataset.orig;
      }
      speakingBtn = null;
    }
  }

  /* ── Tugma bilan ishlatish ── */
  function speakWithBtn(text, btn, opts = {}) {
    if (!text) return;
    speakingBtn = btn;
    if (btn) {
      btn.dataset.orig = btn.textContent;
      btn.classList.add('speaking');
      btn.textContent  = '⏸ O\'qilyapti...';
    }
    speak(text, {
      ...opts,
      onEnd:   () => { resetBtn(); if (opts.onEnd)   opts.onEnd();   },
      onError: () => { resetBtn(); if (opts.onError) opts.onError(); }
    });
  }

  /* ── Init (Web Speech voices yuklash) ── */
  function init() {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    updateIndicator(true);
  }

  function isAvailable()  { return true; }
  function hasJpVoice()   { return true; }
  function getVoiceList() { return []; }

  function updateIndicator(ok) {
    const el = document.getElementById('speech-status');
    if (!el) return;
    el.textContent = ok ? '✅ Ovoz tayyor (Google TTS)' : '🔇 Ovoz mavjud emas';
    el.style.color = ok ? 'var(--sec)' : 'var(--red)';
  }

  return { init, speak, speakWithBtn, stop, isAvailable, hasJpVoice, getVoiceList };
})();
