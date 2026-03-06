"use strict";

(() => {
  // Shared state across UI toggles and scroll listeners
  let isSwitchingMode = false;
  let modeSwitchTimeout = null;
  let lastY = window.scrollY;
  let baseProperties = {};

  const initEmailObfuscation = () => {
    // Obfuscated email — assembled at runtime so bots scraping static HTML won't find it
    const el = document.getElementById("email-link");
    if (!el) return;
    const parts = ["servdo", "@", "gmail", ".", "com"];
    const addr = parts.join("");
    const a = document.createElement("a");
    a.href = "mailto:" + addr;
    a.textContent = addr;
    el.replaceWith(a);
  };

  const initExperienceToggles = () => {
    const allBtns = document.querySelectorAll(".exp-toggle-btn");

    const setMode = (mode) => {
      isSwitchingMode = true;
      clearTimeout(modeSwitchTimeout);

      allBtns.forEach((b) => {
        b.classList.toggle("active", b.dataset.mode === mode);
      });
      if (mode === "short") {
        document.body.classList.add("short-mode");
      } else {
        document.body.classList.remove("short-mode");
      }

      // Allow some time for layout changes and induced scrolling to settle
      modeSwitchTimeout = setTimeout(() => {
        isSwitchingMode = false;
        lastY = window.scrollY; // Update lastY to prevent false positive scroll direction
      }, 150);
    };

    allBtns.forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });
  };

  const initContrastToggles = () => {
    const contrastBtns = document.querySelectorAll(".contrast-toggle-btn");
    let isHighContrast = localStorage.getItem("high-contrast") === "true";
    const themeColorMeta = document.getElementById("theme-color-meta");

    const setContrast = (isHigh) => {
      if (isHigh) {
        document.body.classList.add("high-contrast");
        contrastBtns.forEach((btn) => btn.classList.add("active"));
        if (themeColorMeta) themeColorMeta.setAttribute("content", "#000000");
      } else {
        document.body.classList.remove("high-contrast");
        contrastBtns.forEach((btn) => btn.classList.remove("active"));
        if (themeColorMeta) themeColorMeta.setAttribute("content", "#faf9f6");
      }
      localStorage.setItem("high-contrast", isHigh);

      // Re-render Stroop colors if game is active
      if (
        typeof window.StroopGame !== "undefined" &&
        window.StroopGame.isActive()
      ) {
        window.StroopGame.reRender();
      }
    };

    // Initialize contrast from localStorage
    setContrast(isHighContrast);

    contrastBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        isSwitchingMode = true;
        clearTimeout(modeSwitchTimeout);

        isHighContrast = !isHighContrast;
        setContrast(isHighContrast);

        modeSwitchTimeout = setTimeout(() => {
          isSwitchingMode = false;
          lastY = window.scrollY;
        }, 150);
      });
    });
  };

  const initStickyBar = () => {
    const stickyBar = document.getElementById("stickyCvBar");
    const heroToggle = document.querySelector(".cv-format-toggle");
    if (!stickyBar || !heroToggle) return;

    let stickyBarVisible = false;
    let hideTimer = null;
    let rafPending = false;

    const heroToggleVisible = () => {
      return heroToggle.getBoundingClientRect().bottom > 0;
    };

    const showBar = () => {
      if (stickyBarVisible) return;
      stickyBar.classList.add("visible");
      clearTimeout(hideTimer);
      stickyBarVisible = true;
      hideTimer = setTimeout(hideBar, 5000);
    };

    const hideBar = () => {
      if (!stickyBarVisible) return;
      stickyBar.classList.remove("visible");
      stickyBarVisible = false;
    };

    stickyBar.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    stickyBar.addEventListener("mouseleave", () => {
      hideTimer = setTimeout(hideBar, 5000);
    });

    window.addEventListener(
      "scroll",
      () => {
        if (rafPending) return;
        rafPending = true;

        requestAnimationFrame(() => {
          const currentY = window.scrollY;

          if (isSwitchingMode) {
            lastY = currentY;
            rafPending = false;
            return;
          }

          const scrollingUp = currentY < lastY;

          if (scrollingUp && !heroToggleVisible()) {
            showBar();
          } else if (!scrollingUp || heroToggleVisible()) {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(hideBar, 200);
          }
          lastY = currentY;
          rafPending = false;
        });
      },
      { passive: true },
    );
  };

  const initStroopGame = () => {
    const STROOP_CONFIG = {
      defaultTime: 60,
      warningTime: 10,
      tickTime: 3,
      trickProbability: 0.3,
    };

    const GAME_COLORS = {
      standard: [
        { name: "RED", hex: "#d12e2e" },
        { name: "BLUE", hex: "#0057b7" },
        { name: "GREEN", hex: "#2e8b57" },
        { name: "YELLOW", hex: "#ffd700" },
        { name: "BLACK", hex: "#1a1a1a" },
      ],
      highContrast: [
        { name: "RED", hex: "#ff3333" },
        { name: "BLUE", hex: "#3399ff" },
        { name: "GREEN", hex: "#33cc33" },
        { name: "YELLOW", hex: "#ffff00" },
        { name: "WHITE", hex: "#ffffff" },
      ],
    };

    const DOM = {
      section: document.getElementById("stroopGameSection"),
      bottomScroller: document.getElementById("bottom-scroller"),
      intro: document.getElementById("stroopIntro"),
      container: document.getElementById("stroopGameContainer"),
      gameOver: document.getElementById("stroopGameOver"),
      startBtn: document.getElementById("startStroopBtn"),
      restartBtn: document.getElementById("restartStroopBtn"),
      wordDisplay: document.getElementById("stroopWord"),
      colorButtons: document.getElementById("stroopColorButtons"),
      scoreDisplay: document.getElementById("stroopScore"),
      timerDisplay: document.getElementById("stroopTimer"),
      finalScoreDisplay: document.getElementById("finalScore"),
    };

    const gameState = {
      score: 0,
      time: STROOP_CONFIG.defaultTime,
      timerInterval: null,
      currentColorObj: null,
      currentWordObj: null,
      audioCtx: null,
    };

    const initAudio = () => {
      if (!gameState.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) gameState.audioCtx = new AudioContext();
      }
      if (gameState.audioCtx && gameState.audioCtx.state === "suspended") {
        gameState.audioCtx.resume();
      }
    };

    const TONE_TYPES = {
      CORRECT: "correct",
      WRONG: "wrong",
      START: "start",
      END: "end",
      WARNING10: "warning10",
      TICK: "tick",
    };

    const playTone = (type) => {
      if (!gameState.audioCtx) return;
      if (gameState.audioCtx.state === "suspended") gameState.audioCtx.resume();

      const osc = gameState.audioCtx.createOscillator();
      const gainNode = gameState.audioCtx.createGain();

      osc.connect(gainNode);
      gainNode.connect(gameState.audioCtx.destination);

      const now = gameState.audioCtx.currentTime;

      switch (type) {
        case TONE_TYPES.CORRECT:
          osc.type = "sine";
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        case TONE_TYPES.WRONG:
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(150, now);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
          break;
        case TONE_TYPES.START:
          osc.type = "square";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(554.37, now + 0.1);
          osc.frequency.setValueAtTime(659.25, now + 0.2);
          osc.frequency.setValueAtTime(880, now + 0.3);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        case TONE_TYPES.END:
          osc.type = "triangle";
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.8);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
          osc.start(now);
          osc.stop(now + 0.8);
          break;
        case TONE_TYPES.WARNING10:
          osc.type = "square";
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.setValueAtTime(1000, now + 0.15);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gainNode.gain.setValueAtTime(0, now + 0.1); // gap
          gainNode.gain.setValueAtTime(0.1, now + 0.15);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        case TONE_TYPES.TICK:
          osc.type = "sine";
          osc.frequency.setValueAtTime(800, now);
          gainNode.gain.setValueAtTime(0.1, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
      }
    };

    const getActiveColors = () => {
      return document.body.classList.contains("high-contrast")
        ? GAME_COLORS.highContrast
        : GAME_COLORS.standard;
    };

    const renderButtons = () => {
      if (!DOM.colorButtons) return;
      DOM.colorButtons.innerHTML = "";
      const colors = getActiveColors();
      colors.forEach((color) => {
        const btn = document.createElement("button");
        btn.className = `color-btn color-${color.name.toLowerCase()}`;
        btn.textContent = color.name;
        btn.onclick = () => handleColorClick(color.name);
        DOM.colorButtons.appendChild(btn);
      });
    };

    const updateStroopWordColor = () => {
      if (DOM.wordDisplay && gameState.currentColorObj) {
        nextWord();
      }
    };

    const nextWord = () => {
      if (!DOM.wordDisplay) return;
      const colors = getActiveColors();
      let wordIndex;
      let colorIndex;

      // Generate a new word that is different from the previous one
      do {
        wordIndex = Math.floor(Math.random() * colors.length);
      } while (
        gameState.currentWordObj &&
        colors[wordIndex].name === gameState.currentWordObj.name
      );

      // Generate a new color that is different from the previous one
      do {
        colorIndex = Math.floor(Math.random() * colors.length);
      } while (
        gameState.currentColorObj &&
        colors[colorIndex].name === gameState.currentColorObj.name
      );

      // Ensure word and color are different most of the time
      if (Math.random() > STROOP_CONFIG.trickProbability) {
        let attempt = 0;
        while (colorIndex === wordIndex && attempt < 10) {
          let newColorIndex = Math.floor(Math.random() * colors.length);
          if (
            !gameState.currentColorObj ||
            colors[newColorIndex].name !== gameState.currentColorObj.name
          ) {
            colorIndex = newColorIndex;
          }
          attempt++;
        }
      }

      gameState.currentWordObj = colors[wordIndex];
      gameState.currentColorObj = colors[colorIndex];

      DOM.wordDisplay.textContent = gameState.currentWordObj.name;
      DOM.wordDisplay.className = `word-display color-${gameState.currentColorObj.name.toLowerCase()}`;
    };

    const handleColorClick = (clickedColorName) => {
      if (clickedColorName === gameState.currentColorObj.name) {
        playTone(TONE_TYPES.CORRECT);
        gameState.score++;
        if (DOM.scoreDisplay) DOM.scoreDisplay.textContent = gameState.score;
        if (DOM.wordDisplay) {
          DOM.wordDisplay.classList.add("anim-pop");
          setTimeout(() => {
            if (DOM.wordDisplay) DOM.wordDisplay.classList.remove("anim-pop");
          }, 100);
        }
        nextWord();
      } else {
        playTone(TONE_TYPES.WRONG);
        gameState.score = Math.max(0, gameState.score - 1);
        if (DOM.scoreDisplay) DOM.scoreDisplay.textContent = gameState.score;
        if (DOM.wordDisplay) {
          DOM.wordDisplay.classList.add("anim-shake");
          setTimeout(() => {
            if (DOM.wordDisplay) DOM.wordDisplay.classList.remove("anim-shake");
          }, 150);
        }
      }
    };

    const endStroopGame = () => {
      trackEvent("EndGame", { score: gameState.score });
      playTone(TONE_TYPES.END);
      clearInterval(gameState.timerInterval);
      if (DOM.container) DOM.container.classList.add("hidden");
      if (DOM.gameOver) DOM.gameOver.classList.remove("hidden");
      if (DOM.finalScoreDisplay)
        DOM.finalScoreDisplay.textContent = gameState.score;
      if (DOM.restartBtn) {
        DOM.restartBtn.disabled = true;
        setTimeout(() => {
          if (DOM.restartBtn) DOM.restartBtn.disabled = false;
        }, 3000);
      }
    };

    const pauseGame = () => {
      if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
      }
      // Optional UI cue showing it's paused
      if (DOM.container) {
        DOM.container.classList.add("game-paused");
      }
    };

    const resumeGame = () => {
      // Only resume if the game is actually active and not already ticking
      if (
        !window.StroopGame.isActive() ||
        gameState.time <= 0 ||
        gameState.timerInterval
      )
        return;

      if (DOM.container) {
        DOM.container.classList.remove("game-paused");
      }

      gameState.timerInterval = setInterval(() => {
        gameState.time--;
        if (DOM.timerDisplay) DOM.timerDisplay.textContent = gameState.time;

        if (gameState.time === STROOP_CONFIG.warningTime) {
          playTone(TONE_TYPES.WARNING10);
        } else if (
          gameState.time <= STROOP_CONFIG.tickTime &&
          gameState.time > 0
        ) {
          playTone(TONE_TYPES.TICK);
        }

        if (gameState.time <= 0) {
          endStroopGame();
        }
      }, 1000);
    };

    const startStroopGame = () => {
      initAudio();
      playTone(TONE_TYPES.START);

      gameState.score = 0;
      gameState.time = STROOP_CONFIG.defaultTime;

      if (DOM.scoreDisplay) DOM.scoreDisplay.textContent = gameState.score;
      if (DOM.timerDisplay) DOM.timerDisplay.textContent = gameState.time;

      if (DOM.intro) DOM.intro.classList.add("hidden");
      if (DOM.gameOver) DOM.gameOver.classList.add("hidden");
      if (DOM.container) {
        DOM.container.classList.remove("hidden");
        DOM.container.classList.remove("game-paused");
        // Give the browser a tiny tick to render the display:block before scrolling
        setTimeout(() => {
          if (DOM.bottomScroller) {
            DOM.bottomScroller.scrollIntoView({
              behavior: "smooth",
              block: "end",
            });
          }
        }, 50);
      }

      renderButtons();
      nextWord();

      if (gameState.timerInterval) clearInterval(gameState.timerInterval);
      gameState.timerInterval = null; // Clear out any existing to trigger a fresh resume
      resumeGame();
    };

    // Export minimal API for contrast toggling
    window.StroopGame = {
      isActive: () =>
        DOM.container &&
        !DOM.container.classList.contains("hidden") &&
        DOM.gameOver.classList.contains("hidden"),
      reRender: () => {
        renderButtons();
        updateStroopWordColor();
      },
    };

    // Handle visibility changes (switching tabs or minimizing)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        pauseGame();
      } else {
        resumeGame();
      }
    });

    // Handle window focus lost (clicking on another window while tab is still visible)
    window.addEventListener("blur", pauseGame);
    window.addEventListener("focus", resumeGame);

    if (DOM.startBtn && DOM.restartBtn) {
      DOM.startBtn.addEventListener("click", () => {
        trackEvent("StartGame");
        startStroopGame();
      });
      DOM.restartBtn.addEventListener("click", () => {
        trackEvent("StartGame", { type: "replay" });
        startStroopGame();
      });
    }
  };

  // Create a globally accessible tracking method
  const trackEvent = (eventName, extraProperties = {}) => {
    fetch("https://api.vdovareize.me/analytics/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: eventName,
        properties: {
          ...baseProperties,
          ...extraProperties,
        },
      }),
    }).catch((error) => {
      // Fail silently to not disrupt the user experience if analytics server is down
      console.warn("tracking failed:", error);
    });
  };

  const initAnalytics = () => {
    // Generate or retrieve a session ID to link events together for this visit
    let sessionId = sessionStorage.getItem("cv_session_id");
    if (!sessionId) {
      sessionId =
        "sess_" +
        Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36);
      sessionStorage.setItem("cv_session_id", sessionId);
    }

    // Parse basic user agent properties
    const ua = navigator.userAgent;
    let browser = "Unknown";
    let os = "Unknown";
    let device = "Desktop";

    // Basic Browser Detection
    if (/CriOS|Chrome/.test(ua) && !/Edg/.test(ua)) browser = "Chrome";
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
    else if (/Firefox|FxiOS/.test(ua)) browser = "Firefox";
    else if (/Edg/.test(ua)) browser = "Edge";

    // Basic OS Detection
    if (/Win/.test(ua)) os = "Windows";
    else if (/Mac/.test(ua) && !/iPhone|iPad/.test(ua)) os = "macOS";
    else if (/Android/.test(ua)) os = "Android";
    else if (/iPhone|iPad/.test(ua)) os = "iOS";
    else if (/Linux/.test(ua)) os = "Linux";

    // Basic Device Detection
    if (/iPhone/.test(ua)) device = "iPhone";
    else if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) device = "iPad";
    else if (/iPod/.test(ua)) device = "iPod";
    else if (/Android/.test(ua)) {
      // Try to extract Android device model
      const match = ua.match(/Android [0-9\.]+; ([A-Za-z0-9\- ]+)\b/);
      if (match && match[1] && !match[1].includes("Build")) {
        device = match[1].trim(); // e.g. "SM-G981B" or "Pixel 4"
      } else {
        device = /Tablet/.test(ua) ? "Android Tablet" : "Android Phone";
      }
    }
    else if (/Mobi/.test(ua)) device = "Mobile";
    else if (/Tablet/.test(ua)) device = "Tablet";

    // Gather unchanging system/browser data once on load
    baseProperties = {
      distinctId: sessionId,
      source: "browser",
      userAgent: ua,
      browser: browser,
      os: os,
      device: device,
      language: navigator.language || navigator.userLanguage,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      timezoneOffset: new Date().getTimezoneOffset(),
    };

    // Send tracking event when the CV page is shown
    trackEvent("CVShown");
  };

  // Initialize all modules
  initEmailObfuscation();
  initExperienceToggles();
  initContrastToggles();
  initStickyBar();
  initStroopGame();
  initAnalytics();
})();
