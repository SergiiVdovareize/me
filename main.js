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
    a.addEventListener("click", () => trackEvent("EmailLinkClicked"));
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
        trackEvent("SetShortCvFormat");
      } else {
        document.body.classList.remove("short-mode");
        trackEvent("SetDetailedCvFormat");
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
        trackEvent(isHighContrast ? "SetContrastCvView" : "SetDefaultCvView");

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
      extraStandard: [
        { name: "PURPLE", hex: "#800080" },
        { name: "ORANGE", hex: "#ff8c00" },
        { name: "CYAN", hex: "#00bcd4" },
      ],
      extraHighContrast: [
        { name: "PURPLE", hex: "#cc00cc" },
        { name: "ORANGE", hex: "#ff9900" },
        { name: "CYAN", hex: "#00ffff" },
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
      maxScore: 0,
      time: STROOP_CONFIG.defaultTime,
      timerInterval: null,
      currentColorObj: null,
      currentWordObj: null,
      audioCtx: null,
      bonusMilestonesReached: 0,
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
      BONUS: "bonus",
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
          osc.type = "triangle";
          // Create a more urgent "double heartbeat" pulse
          [0, 0.2].forEach(offset => {
            const start = now + offset;
            osc.frequency.setValueAtTime(350, start);
            osc.frequency.exponentialRampToValueAtTime(280, start + 0.1);
            gainNode.gain.setValueAtTime(0, start);
            gainNode.gain.linearRampToValueAtTime(0.15, start + 0.05);
            gainNode.gain.exponentialRampToValueAtTime(0.01, start + 0.15);
          });
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        case TONE_TYPES.BONUS:
          osc.type = "sine";
          // Play a quick two-note happy chord-like sweep
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
          osc.frequency.setValueAtTime(880, now + 0.1);
          osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
          gainNode.gain.setValueAtTime(0.3, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        case TONE_TYPES.TICK:
          osc.type = "sine";
          osc.frequency.setValueAtTime(2500, now);
          gainNode.gain.setValueAtTime(0.08, now);
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
          break;
      }
    };

    const getActiveColors = () => {
      const isHighContrast = document.body.classList.contains("high-contrast");
      let colors = isHighContrast
        ? [...GAME_COLORS.highContrast]
        : [...GAME_COLORS.standard];
      
      if (gameState.maxScore >= 10) {
        const extraColors = isHighContrast
          ? GAME_COLORS.extraHighContrast
          : GAME_COLORS.extraStandard;
        colors = colors.concat(extraColors);
      }
      
      return colors;
    };

    const renderButtons = () => {
      if (!DOM.colorButtons) return;

      const colors = getActiveColors();
      
      // If container is empty (game start), just append all at once
      if (DOM.colorButtons.children.length === 0) {
        if (colors.length === 5) {
          DOM.colorButtons.classList.add('max-5-layout');
          DOM.colorButtons.classList.remove('max-8-layout');
        }

        colors.forEach((color) => {
          const btn = document.createElement("button");
          btn.dataset.colorName = color.name;
          btn.className = `color-btn color-${color.name.toLowerCase()}`;
          btn.textContent = color.name;
          btn.onclick = () => handleColorClick(color.name);
          DOM.colorButtons.appendChild(btn);
        });
        return;
      }

      if (colors.length > 5) {
        DOM.colorButtons.classList.add('max-8-layout');
        DOM.colorButtons.classList.remove('max-5-layout');
      }

      const existingButtons = Array.from(DOM.colorButtons.children);
      const existingNames = existingButtons.map(b => b.dataset.colorName);
      const targetNames = colors.map(c => c.name);

      // Remove buttons that are no longer needed
      existingButtons.forEach(btn => {
        if (!targetNames.includes(btn.dataset.colorName)) {
           btn.style.transform = 'scale(0.5)';
           btn.style.opacity = '0';
           btn.style.transition = 'all 0.2s ease-in';
           btn.style.pointerEvents = 'none';
           setTimeout(() => { if(btn.parentNode) btn.remove(); }, 200);
        }
      });

      // Add new buttons
      colors.forEach(color => {
        if (!existingNames.includes(color.name)) {
          const btn = document.createElement("button");
          btn.dataset.colorName = color.name;
          btn.className = `color-btn color-${color.name.toLowerCase()} btn-enter`;
          btn.textContent = color.name;
          btn.onclick = () => handleColorClick(color.name);
          btn.addEventListener('animationend', () => btn.classList.remove('btn-enter'), { once: true });
          DOM.colorButtons.appendChild(btn);
        }
      });

      // FLIP Animation logic when only shuffling is required (score >= 20 and < 30)
      // This block is for shuffling existing buttons without adding/removing,
      // or for applying grey-mode if maxScore >= 30.
      const needsRender = existingNames.length !== targetNames.length;

      if (needsRender || gameState.maxScore < 20 || gameState.maxScore >= 30) {
        DOM.colorButtons.innerHTML = "";
        
        if (gameState.maxScore >= 30) {
          DOM.colorButtons.classList.add("grey-mode");
        } else {
          DOM.colorButtons.classList.remove("grey-mode");
        }

        let displayColors = [...colors];
        if (gameState.maxScore >= 20 && gameState.maxScore < 30) {
          for (let i = displayColors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [displayColors[i], displayColors[j]] = [displayColors[j], displayColors[i]];
          }
        }
        
        displayColors.forEach((color) => {
          const btn = document.createElement("button");
          btn.dataset.colorName = color.name;
          
          // Only add entrance animation to buttons that weren't there before
          const isNewButton = !existingNames.includes(color.name);
          btn.className = `color-btn color-${color.name.toLowerCase()}${isNewButton ? ' btn-enter' : ''}`;
          
          btn.textContent = color.name;
          btn.onclick = () => handleColorClick(color.name);
          
          if (isNewButton) {
            btn.addEventListener('animationend', () => btn.classList.remove('btn-enter'), { once: true });
          }
          
          DOM.colorButtons.appendChild(btn);
        });
      } else if (gameState.maxScore >= 20 && gameState.maxScore < 30) {
        // This is the FLIP animation for shuffling when buttons are already present
        // and no new buttons are added/removed, and maxScore is between 20 and 30.
        const children = Array.from(DOM.colorButtons.children).filter(b => targetNames.includes(b.dataset.colorName));
        
        // FIRST: get initial positions of all child elements before moving them
        const firstPositions = children.map(child => {
          return { el: child, rect: child.getBoundingClientRect(), color: child.dataset.colorName };
        });
        
        // SHUFFLE DOM
        const order = [...firstPositions];
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }

        // Append in new order (this instantly updates the layout)
        order.forEach(({el}) => DOM.colorButtons.appendChild(el));

        // LAST: measure new positions
        const lastPositions = order.map(({el}) => el.getBoundingClientRect());

        // INVERT & PLAY
        order.forEach(({el}, index) => {
          const first = firstPositions.find(fp => fp.color === el.dataset.colorName).rect;
          const last = lastPositions[index];

          const deltaX = first.left - last.left;
          const deltaY = first.top - last.top;

          // Apply immediate transform to invert the move
          el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
          el.style.transition = 'transform 0s';

          // Wait one frame and then apply the fast transition to its native state
          requestAnimationFrame(() => {
            el.style.transition = 'transform 0.15s ease-out';
            el.style.transform = '';
          });
        });
      }
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
      const prevScore = gameState.score;
      const prevMaxScore = gameState.maxScore;
      const isCorrect = clickedColorName === gameState.currentColorObj.name;
      
      if (isCorrect) {
        gameState.score++;
        
        let playedBonusSound = false;
        
        // Track the highest score and give bonuses at every 10 points
        if (gameState.score > gameState.maxScore) {
          gameState.maxScore = gameState.score;
          
          const currentMilestone = Math.floor(gameState.maxScore / 10);
          if (currentMilestone > gameState.bonusMilestonesReached && gameState.maxScore > 0 && gameState.maxScore % 10 === 0) {
            gameState.bonusMilestonesReached = currentMilestone;
            gameState.time += 5;
            
            // Play positive bonus sound instead of the basic correct ping
            playTone(TONE_TYPES.BONUS);
            playedBonusSound = true;

            // visually pop the timer display
            if (DOM.timerDisplay) {
              DOM.timerDisplay.textContent = gameState.time;
              DOM.timerDisplay.classList.add("anim-pop");
              setTimeout(() => {
                if (DOM.timerDisplay) DOM.timerDisplay.classList.remove("anim-pop");
              }, 100);
            }
          }
        }
        
        if (!playedBonusSound) {
          playTone(TONE_TYPES.CORRECT);
        }
        
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

      // Trigger a re-render of buttons for threshold crossings or >= 20 shuffling
      // We only care about crossing thresholds upward now for adding features
      const crossed10Up = prevMaxScore < 10 && gameState.maxScore >= 10;
      const crossed30Up = prevMaxScore < 30 && gameState.maxScore >= 30;
      
      // We want to shuffle if 20 <= maxScore < 30 and the answer was correct, or if we just crossed 10 or 30
      if (crossed10Up || crossed30Up || (gameState.maxScore >= 20 && gameState.maxScore < 30 && isCorrect)) {
        renderButtons();
        
        if (crossed10Up || crossed30Up) {
          setTimeout(() => {
            if (DOM.bottomScroller) {
              DOM.bottomScroller.scrollIntoView({
                behavior: "smooth",
                block: "end",
              });
            }
          }, 350); // wait slightly longer for the entrance animation to finish
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
      gameState.maxScore = 0;
      gameState.bonusMilestonesReached = 0;
      gameState.time = STROOP_CONFIG.defaultTime;

      if (DOM.colorButtons) DOM.colorButtons.classList.remove("grey-mode");
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

  const getBrowser = (ua) => {
    if (/CriOS|Chrome/.test(ua) && !/Edg/.test(ua)) return "Chrome";
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return "Safari";
    if (/Firefox|FxiOS/.test(ua)) return "Firefox";
    if (/Edg/.test(ua)) return "Edge";
    return "Unknown";
  };

  const getOS = (ua) => {
    if (/Win/.test(ua)) return "Windows";
    if (/Mac/.test(ua) && !/iPhone|iPad/.test(ua)) return "macOS";
    if (/Android/.test(ua)) return "Android";
    if (/iPhone|iPad/.test(ua)) return "iOS";
    if (/Linux/.test(ua)) return "Linux";
    return "Unknown";
  };

  const getDevice = (ua) => {
    if (/iPhone/.test(ua)) return "iPhone";
    if (
      /iPad/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    )
      return "iPad";
    if (/iPod/.test(ua)) return "iPod";
    if (/Android/.test(ua)) {
      const match = ua.match(/Android [0-9\.]+; ([A-Za-z0-9\- ]+)\b/);
      if (match && match[1] && !match[1].includes("Build")) {
        return match[1].trim();
      }
      return /Tablet/.test(ua) ? "Android Tablet" : "Android Phone";
    }
    if (/Mobi/.test(ua)) return "Mobile";
    if (/Tablet/.test(ua)) return "Tablet";
    return "Desktop";
  };

  const fetchCountry = async () => {
    try {
      // Use ipapi.co for free geolocation (client-side)
      const response = await fetch("https://ipapi.co/json/");
      if (response.ok) {
        const data = await response.json();
        return {
          country: data.country_name,
          countryCode: data.country_code,
          city: data.city,
          timezone: data.timezone,
        };
      }
    } catch (e) {
      console.warn("Country detection failed", e);
    }
    return {
      country: "Unknown",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  };

  const initAnalytics = async () => {
    // Generate or retrieve a session ID to link events together for this visit
    let sessionId = sessionStorage.getItem("cv_session_id");
    if (!sessionId) {
      sessionId =
        "sess_" +
        Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36);
      sessionStorage.setItem("cv_session_id", sessionId);
    }

    const countryData = await fetchCountry();
    const ua = navigator.userAgent;

    // Gather unchanging system/browser data once on load
    baseProperties = {
      distinctId: sessionId,
      source: "browser",
      userAgent: ua,
      browser: getBrowser(ua),
      os: getOS(ua),
      device: getDevice(ua),
      language: navigator.language || navigator.userLanguage,
      country: countryData.country,
      countryCode: countryData.countryCode,
      city: countryData.city,
      timezone: countryData.timezone,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      timezoneOffset: new Date().getTimezoneOffset(),
    };

    // Send tracking event when the CV page is shown
    trackEvent("CVShown");
  };

  const initSocialLinks = () => {
    const waLink = document.getElementById("whatsapp-link");
    if (waLink)
      waLink.addEventListener("click", () => trackEvent("WhatsappLinkClicked"));

    const liLink = document.getElementById("linkedin-link");
    if (liLink)
      liLink.addEventListener("click", () => trackEvent("LinkedInLinkClicked"));

    const ghLink = document.getElementById("github-link");
    if (ghLink)
      ghLink.addEventListener("click", () => trackEvent("GithubLinkClicked"));

    // Track Pet Project Repository Links
    const repoLinks = document.querySelectorAll(".project-repo");
    repoLinks.forEach((link) => {
      link.addEventListener("click", () => {
        const project = link.closest("[data-project]")?.dataset.project;
        trackEvent("RepositoryClicked", { project });
      });
    });

    // Track Pet Project Demo Links
    const demoLinks = document.querySelectorAll(".try-it-link");
    demoLinks.forEach((link) => {
      link.addEventListener("click", () => {
        const project = link.closest("[data-project]")?.dataset.project;
        trackEvent("DemoClicked", { project });
      });
    });
  };

  // Initialize all modules
  initEmailObfuscation();
  initSocialLinks();
  initExperienceToggles();
  initContrastToggles();
  initStickyBar();
  initStroopGame();
  initAnalytics();
})();
