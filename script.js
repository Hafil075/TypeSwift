// script.js
// Typing Speed Test - vanilla JS (modular, no globals)
(function () {
  'use strict';

  // --- Data: sentences (12+) including provided sample ---
  const SENTENCES = [
    "The quick brown fox jumps over the lazy dog.",
    "Small steps every day add up to a big change.",
    "Typing accurately beats typing frantically every time.",
    "Don't judge each day by the harvest you reap.",
    "Accessibility matters: make interfaces for everyone.",
    "Concurrency can be subtle; prefer clarity over cleverness.",
    "She sells seashells by the seashore, a classic tongue twister.",
    "Error handling is an opportunity to communicate clearly.",
    "Keep code modular, testable, and easy to reason about.",
    "A watched pot never seems to boil, they say.",
    "Quickly fix bugs before they become expensive to maintain.",
    "Innovation often combines old ideas in new ways.",
    "Read the documentation before assuming behavior."
  ];

  // --- Cached DOM refs ---
  const sentenceArea = document.getElementById('sentenceArea');
  const hiddenInput = document.getElementById('hiddenInput');
  const countdownEl = document.getElementById('countdown');
  const wpmEl = document.getElementById('wpm');
  const accuracyEl = document.getElementById('accuracy');
  const charsTypedEl = document.getElementById('charsTyped');
  const mistakesEl = document.getElementById('mistakes');
  const timeProgress = document.getElementById('timeProgress');
  const startBtn = document.getElementById('startBtn');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const retryBtn = document.getElementById('retryBtn');
  const newBtn = document.getElementById('newBtn');
  const modeSelect = document.getElementById('modeSelect');

  // Overlay refs
  const overlay = document.getElementById('overlay');
  const finalWpm = document.getElementById('finalWpm');
  const finalAcc = document.getElementById('finalAcc');
  const finalCorrect = document.getElementById('finalCorrect');
  const finalMistakes = document.getElementById('finalMistakes');
  const timeUsedEl = document.getElementById('timeUsed');
  const overlayRetry = document.getElementById('overlayRetry');
  const overlayNew = document.getElementById('overlayNew');
  const overlayChange = document.getElementById('overlayChange');
  const closeOverlay = document.getElementById('closeOverlay');
  const leaderboardList = document.getElementById('leaderboardList');
  const ariaLive = document.getElementById('ariaLive');

  const darkToggle = document.getElementById('darkToggle');

  // --- App state (kept inside closure) ---
  let modeSeconds = 60; // default
  let currentSentence = '';
  let chars = []; // array of characters for rendering
  let index = 0; // current typing position
  let correctCount = 0;
  let mistakeCount = 0;
  let typedCount = 0; // total typed chars
  let timerId = null;
  let startTime = null;
  let elapsedBeforePause = 0; // not used but reserved
  let running = false;
  let timeLeft = modeSeconds;

  // Leaderboard storage key
  const LB_KEY = 'typing_leaderboard_v1';

  // --- Utility functions ---
  function rndSentence(exclude = null) {
    let pool = SENTENCES.slice();
    if (exclude) {
      pool = pool.filter(s => s !== exclude);
      if (pool.length === 0) pool = SENTENCES.slice();
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function renderSentence(text) {
    sentenceArea.innerHTML = '';
    chars = Array.from(text);
    chars.forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch;
      span.setAttribute('data-index', i);
      // mark current char
      if (i === 0) span.classList.add('current');
      sentenceArea.appendChild(span);
    });
  }

  function resetState(sameSentence = false) {
    if (!sameSentence) {
      currentSentence = rndSentence(currentSentence);
    }
    renderSentence(currentSentence);
    index = 0;
    correctCount = 0;
    mistakeCount = 0;
    typedCount = 0;
    timeLeft = modeSeconds;
    running = false;
    clearTimer();
    startTime = null;
    updateMetrics(0);
    updateTimeDisplay(timeLeft);
    setProgress(0);
    // focus input for keyboard start
    hiddenInput.value = '';
    hiddenInput.blur();
    // place focus to start button for keyboard access
    startBtn.focus();
  }

  function startTest() {
    if (running) return;
    running = true;
    startTime = Date.now();
    startBtn.setAttribute('aria-pressed', 'true');
    hiddenInput.focus();
    ariaAnnounce(`Test started: ${modeSeconds} seconds.`);
    startCountdown();
  }

  function clearTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startCountdown() {
    // tick every 100ms for smooth progress & live WPM calculation
    const start = Date.now();
    timerId = setInterval(() => {
      const now = Date.now();
      let elapsedMs = now - start;
      let elapsedSec = Math.floor(elapsedMs / 1000);
      let usedSec = Math.min(Math.floor((now - startTime) / 1000), modeSeconds);
      timeLeft = Math.max(0, modeSeconds - usedSec);
      updateTimeDisplay(timeLeft);
      // update progress bar
      setProgress(((modeSeconds - timeLeft) / modeSeconds) * 100);
      // update live WPM using elapsed time in minutes (use seconds elapsed >0)
      const elapsedSinceStartMs = now - startTime;
      const elapsedMinutes = Math.max(0.001, elapsedSinceStartMs / 60000); // avoid division by zero
      updateMetrics(elapsedMinutes);
      if (timeLeft <= 0) {
        endTest();
      }
    }, 100);
  }

  function updateTimeDisplay(sec) {
    countdownEl.textContent = String(sec);
    countdownEl.setAttribute('aria-live', 'polite');
  }

  function setProgress(percent) {
    timeProgress.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    timeProgress.setAttribute('aria-valuenow', String(Math.round(percent)));
  }

  function updateMetrics(elapsedMinutes) {
    // WPM formula: (correct characters / 5) / elapsedMinutes
    const wpm = Math.round((correctCount / 5) / elapsedMinutes) || 0;
    const accuracy = typedCount === 0 ? 100 : (correctCount / typedCount) * 100;
    wpmEl.textContent = wpm;
    accuracyEl.textContent = `${accuracy.toFixed(1)}%`;
    charsTypedEl.textContent = typedCount;
    mistakesEl.textContent = mistakeCount;
  }

  function handleInput(e) {
    // If test not started, start on first real key
    if (!running) {
      // Check if previous test was finished (index at end).
      // If so, we must reset for a new test before starting.
      if (index > 0 && index >= chars.length) {
        resetState(false);
      }

      // Only start for printable keys and backspace
      if (e.inputType && e.inputType.startsWith('insert') || e.inputType === 'deleteContentBackward') {
        startTest();
      } else {
        // some browsers don't set inputType - still start
        startTest();
      }
    }

    // value is the whole typed sequence in hiddenInput; we only need the last char or backspace
    const value = hiddenInput.value;
    // We will compare typedCount (how many typed so far) with hiddenInput length.
    // But to allow corrections, interpret as current typed length = value.length
    // We'll sync chars from 0..value.length-1
    const typedLen = value.length;
    typedCount = typedLen;

    // Reset classes to recalc
    const spans = sentenceArea.querySelectorAll('span.char');
    spans.forEach(s => s.classList.remove('correct', 'incorrect', 'current'));

    correctCount = 0;
    mistakeCount = 0;

    for (let i = 0; i < spans.length; i++) {
      const ch = chars[i];
      const span = spans[i];
      if (i < typedLen) {
        const typedChar = value[i];
        if (typedChar === ch) {
          span.classList.add('correct');
          correctCount++;
        } else {
          span.classList.add('incorrect');
          mistakeCount++;
        }
      }
      // mark current position
      if (i === typedLen) span.classList.add('current');
    }

    index = typedLen;

    // update live metrics using elapsed time since start
    if (running && startTime) {
      const elapsedMinutes = Math.max(0.001, (Date.now() - startTime) / 60000);
      updateMetrics(elapsedMinutes);
    }

    // If user completed sentence before time ends
    if (index >= chars.length) {
      // mark done and end
      endTest(true);
    }
  }

  function endTest(finishedEarly = false) {
    if (!running) return;
    running = false;
    startBtn.setAttribute('aria-pressed', 'false');
    clearTimer();
    // final metrics calculation using elapsed time
    const finalElapsedMs = Math.min(modeSeconds * 1000, Date.now() - startTime);
    const finalElapsedSec = Math.max(1, Math.round(finalElapsedMs / 1000));
    const elapsedMinutes = finalElapsedMs / 60000;
    const finalWpmVal = Math.round((correctCount / 5) / Math.max(0.001, elapsedMinutes)) || 0;
    const finalAccVal = typedCount === 0 ? 100 : (correctCount / typedCount) * 100;

    // show overlay with final details
    finalWpm.textContent = finalWpmVal;
    finalAcc.textContent = `${finalAccVal.toFixed(1)}%`;
    finalCorrect.textContent = correctCount;
    finalMistakes.textContent = mistakeCount;
    timeUsedEl.textContent = `${finalElapsedSec}s`;

    showOverlay();
    saveToLeaderboard({
      wpm: finalWpmVal,
      accuracy: finalAccVal,
      correct: correctCount,
      mistakes: mistakeCount,
      time: finalElapsedSec,
      sentence: currentSentence,
      mode: modeSeconds,
      date: new Date().toISOString()
    });

    // disable input while overlay visible
    hiddenInput.blur();
    ariaAnnounce(`Test finished. ${finalWpmVal} words per minute, ${finalAccVal.toFixed(1)} percent accuracy.`);
  }

  // Prevent copy/paste/context menu when test active
  function preventClipboardDuringTest(e) {
    if (running) {
      e.preventDefault();
      ariaAnnounce('Copy, paste and context menu are disabled during a test.');
    }
  }

  // Overlay control
  function showOverlay() {
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    populateLeaderboard();
    // focus close button for keyboard users
    closeOverlay.focus();
  }
  function hideOverlay() {
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    // allow starting again
    hiddenInput.value = '';
    hiddenInput.focus();
  }

  // Mode switching
  function setMode(seconds) {
    modeSeconds = Number(seconds);
    modeBtns.forEach(b => {
      b.classList.toggle('active', Number(b.dataset.seconds) === modeSeconds);
      b.setAttribute('aria-pressed', Number(b.dataset.seconds) === modeSeconds ? 'true' : 'false');
    });
    // sync select
    modeSelect.value = String(modeSeconds);
    // reset current test
    resetState(false);
    ariaAnnounce(`Mode changed to ${modeSeconds} seconds.`);
  }

  // Leaderboard (localStorage simple)
  function loadLeaderboard() {
    try {
      const raw = localStorage.getItem(LB_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function saveLeaderboard(lb) {
    try {
      localStorage.setItem(LB_KEY, JSON.stringify(lb));
    } catch (e) {
      // ignore quota errors
    }
  }
  function saveToLeaderboard(entry) {
    const lb = loadLeaderboard();
    lb.push(entry);
    // keep top 10 sorted by WPM desc
    lb.sort((a, b) => b.wpm - a.wpm);
    saveLeaderboard(lb.slice(0, 20));
  }
  function populateLeaderboard() {
    const lb = loadLeaderboard().filter(e => e.mode === modeSeconds).slice(0, 5);
    leaderboardList.innerHTML = '';
    if (lb.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No scores yet for this mode.';
      leaderboardList.appendChild(li);
      return;
    }
    lb.forEach(e => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${e.wpm} WPM</strong> — ${e.accuracy.toFixed(1)}% (${e.correct}c, ${e.mistakes}x)`;
      leaderboardList.appendChild(li);
    });
  }

  // accessibility announcer
  function ariaAnnounce(text) {
    ariaLive.textContent = '';
    setTimeout(() => {
      ariaLive.textContent = text;
    }, 50);
  }

  // init events
  function attachEvents() {
    // hidden input captures typing
    hiddenInput.addEventListener('input', handleInput);

    // prevent paste/copy/context menu while running
    hiddenInput.addEventListener('paste', preventClipboardDuringTest);
    hiddenInput.addEventListener('copy', preventClipboardDuringTest);
    hiddenInput.addEventListener('cut', preventClipboardDuringTest);
    hiddenInput.addEventListener('contextmenu', preventClipboardDuringTest);

    // start button
    startBtn.addEventListener('click', () => {
      if (!running) {
        // focus the hidden input then start
        hiddenInput.focus();
        startTest();
      } else {
        // allow pressing to end early
        endTest();
      }
    });

    // keyboard: Enter on start button toggles (native)
    // mode buttons
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        setMode(btn.dataset.seconds);
      });
    });

    // select
    modeSelect.addEventListener('change', (e) => setMode(e.target.value));

    // retry / new
    retryBtn.addEventListener('click', () => {
      resetState(true);
      ariaAnnounce('Retrying same sentence.');
    });
    newBtn.addEventListener('click', () => {
      resetState(false);
      ariaAnnounce('New test loaded.');
    });

    // overlay actions
    overlayRetry.addEventListener('click', () => {
      hideOverlay();
      resetState(true);
    });
    overlayNew.addEventListener('click', () => {
      hideOverlay();
      resetState(false);
    });
    overlayChange.addEventListener('click', () => {
      hideOverlay();
      // move focus to mode select for change
      modeSelect.focus();
    });
    closeOverlay.addEventListener('click', hideOverlay);

    // Keyboard shortcuts (Tab to restart, Esc to end) - global
    document.addEventListener('keydown', (e) => {
      // Only if overlay is hidden
      if (overlay.hidden) {
        if (e.key === 'Tab') {
          e.preventDefault();
          resetState(false);
          ariaAnnounce('Restarted test.');
        }
        if (e.key === 'Escape' && running) {
          e.preventDefault();
          endTest();
        }
      }
    });

    // close overlay with Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) hideOverlay();
    });

    // disable right-click on the sentence area while test is active
    sentenceArea.addEventListener('contextmenu', preventClipboardDuringTest);

    // Keep dark mode toggle
    darkToggle.addEventListener('change', () => {
      if (darkToggle.checked) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    });

    // Make startable by focusing sentence and pressing keys
    sentenceArea.addEventListener('click', () => hiddenInput.focus());
    // If user presses Enter while focusing select buttons etc, native behavior applies

    // Accessibility: when focusing start button, Enter toggles start/stop (already default)

    // Make startable by focusing sentence and pressing keys
    sentenceArea.addEventListener('click', () => {
      hiddenInput.focus();
      // optional visual feedback
      sentenceArea.classList.add('focused');
    });
    hiddenInput.addEventListener('blur', () => sentenceArea.classList.remove('focused'));

    // Prevent drag & drop text into input during test
    hiddenInput.addEventListener('drop', (e) => {
      if (running) {
        e.preventDefault();
        ariaAnnounce('Dropping text is disabled during a test.');
      }
    });
  }

  // --- Initialization ---
  function init() {
    // pick initial sentence and render
    currentSentence = rndSentence();
    renderSentence(currentSentence);

    // set default mode
    setMode(modeSeconds);

    attachEvents();

    // expose focus for keyboard users
    startBtn.tabIndex = 0;
    retryBtn.tabIndex = 0;
    newBtn.tabIndex = 0;

    // restore theme
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      darkToggle.checked = true;
    }

    // initial announcements
    ariaAnnounce('Typing Speed Test ready. Default mode 60 seconds. Press Start or begin typing to start.');
  }

  // Run
  init();

  // Expose nothing to global scope.

})();
