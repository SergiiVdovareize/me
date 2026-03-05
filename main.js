(() => {
  // Obfuscated email — assembled at runtime so bots scraping static HTML won't find it
  const el = document.getElementById("email-link");
  const parts = ["servdo", "@", "gmail", ".", "com"];
  const addr = parts.join("");
  const a = document.createElement("a");
  let stickyBarVisible = false;
  a.href = "mailto:" + addr;
  a.textContent = addr;
  el.replaceWith(a);

  const allBtns = document.querySelectorAll(".exp-toggle-btn");

  let isSwitchingMode = false;
  let modeSwitchTimeout = null;

  function setMode(mode) {
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
  }

  allBtns.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  const contrastBtns = document.querySelectorAll(".contrast-toggle-btn");
  let isHighContrast = localStorage.getItem("high-contrast") === "true";
  const themeColorMeta = document.getElementById("theme-color-meta");

  function setContrast(isHigh) {
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
    const sGameContainer = document.getElementById("stroopGameContainer");
    if (sGameContainer && !sGameContainer.classList.contains("hidden")) {
      // Re-trigger global renderButtons if it's available in this scope
      renderButtons()
      updateStroopWordColor()
    }
  }

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

  const stickyBar = document.getElementById("stickyCvBar");
  const heroToggle = document.querySelector(".cv-format-toggle");
  let lastY = window.scrollY;
  let hideTimer = null;

  function heroToggleVisible() {
    return heroToggle.getBoundingClientRect().bottom > 0;
  }

  function showBar() {
    if (stickyBarVisible) return;
    stickyBar.classList.add("visible");
    clearTimeout(hideTimer);
    stickyBarVisible = true;
    hideTimer = setTimeout(hideBar, 5000);
  }

  function hideBar() {
    if (!stickyBarVisible) return;
    stickyBar.classList.remove("visible");
    stickyBarVisible = false;
  }

  stickyBar.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  stickyBar.addEventListener("mouseleave", () => {
    hideTimer = setTimeout(hideBar, 5000);
  });

  let rafPending = false;

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
          // scrolling down or toggle back in view — hide immediately

          clearTimeout(hideTimer);
          hideTimer = setTimeout(hideBar, 200);
        }
        lastY = currentY;
        rafPending = false;
      });
    },
    { passive: true },
  );

  // const hero = document.querySelector('.hero');
  // const observer = new IntersectionObserver(
  //     ([entry]) => {
  //         if (!entry.isIntersecting) {
  //             showBar();
  //         }
  //     },
  //     { threshold: 0 }
  // );
  // observer.observe(hero);

  // --- Stroop Game Logic ---
  const colors = [
    { name: "RED", hex: "#d12e2e" },
    { name: "BLUE", hex: "#0057b7" },
    { name: "GREEN", hex: "#2e8b57" },
    { name: "YELLOW", hex: "#ffd700" },
    { name: "BLACK", hex: "#1a1a1a" }
  ];

  const highContrastColors = [
    { name: "RED", hex: "#ff3333" },
    { name: "BLUE", hex: "#3399ff" },
    { name: "GREEN", hex: "#33cc33" },
    { name: "YELLOW", hex: "#ffff00" },
    { name: "WHITE", hex: "#ffffff" }
  ];

  const stroopGameSection = document.getElementById("stroopGameSection");
  const stroopIntro = document.getElementById("stroopIntro");
  const stroopGameContainer = document.getElementById("stroopGameContainer");
  const stroopGameOver = document.getElementById("stroopGameOver");
  const startStroopBtn = document.getElementById("startStroopBtn");
  const restartStroopBtn = document.getElementById("restartStroopBtn");
  const stroopWordDisplay = document.getElementById("stroopWord");
  const stroopColorButtons = document.getElementById("stroopColorButtons");
  const stroopScoreDisplay = document.getElementById("stroopScore");
  const stroopTimerDisplay = document.getElementById("stroopTimer");
  const finalScoreDisplay = document.getElementById("finalScore");

  let stroopScore = 0;
  let stroopTime = 17;
  let stroopTimerInterval;
  let currentColorObj = null;

  function getColors() {
    const isHC = document.body.classList.contains("high-contrast");
    return isHC ? highContrastColors : colors;
  }

  function renderButtons() {
    if (!stroopColorButtons) return;
    stroopColorButtons.innerHTML = "";
    const currentColors = getColors();
    currentColors.forEach(color => {
      const btn = document.createElement("button");
      btn.className = "color-btn";
      btn.textContent = color.name;
      btn.style.backgroundColor = color.hex;
      btn.style.color = (color.name === "YELLOW" || color.name === "WHITE") ? "#000" : "#fff";
      btn.style.borderColor = color.hex;
      btn.onclick = () => handleColorClick(color.name);
      stroopColorButtons.appendChild(btn);
    });
  }
  // window.renderStroopButtons = renderButtons;

  function updateStroopWordColor() {
    if (stroopWordDisplay && currentColorObj) {
        nextWord();
    }
  }
  // window.updateStroopWordColor = updateStroopWordColor;

  let currentWordObj = null;

  function nextWord() {
    if (!stroopWordDisplay) return;
    const currentColors = getColors();
    let wordIndex;
    let colorIndex;

    // Generate a new word that is different from the previous one
    do {
      wordIndex = Math.floor(Math.random() * currentColors.length);
    } while (currentWordObj && currentColors[wordIndex].name === currentWordObj.name);

    // Generate a new color that is different from the previous one
    do {
      colorIndex = Math.floor(Math.random() * currentColors.length);
    } while (currentColorObj && currentColors[colorIndex].name === currentColorObj.name);
    
    // Ensure word and color are different most of the time
    if (Math.random() > 0.3) {
      // Find a color that is not the same as the word, and not the same as the previous color
      let attempt = 0;
      while (colorIndex === wordIndex && attempt < 10) {
        let newColorIndex = Math.floor(Math.random() * currentColors.length);
        if (!currentColorObj || currentColors[newColorIndex].name !== currentColorObj.name) {
             colorIndex = newColorIndex;
        }
        attempt++;
      }
    }
    
    currentWordObj = currentColors[wordIndex];
    currentColorObj = currentColors[colorIndex];
    
    stroopWordDisplay.textContent = currentWordObj.name;
    stroopWordDisplay.style.color = currentColorObj.hex;
  }

  let audioCtx = null;

  function playSound(isCorrect) {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (isCorrect) {
      // High quick beep for correct
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.1);
    } else {
      // Low buzz for wrong
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.2);
    }
  }

  function handleColorClick(clickedColorName) {
    if (clickedColorName === currentColorObj.name) {
      // Correct!
      playSound(true);
      stroopScore++;
      if (stroopScoreDisplay) stroopScoreDisplay.textContent = stroopScore;
      if (stroopWordDisplay) {
        stroopWordDisplay.style.transform = "scale(1.1)";
        setTimeout(() => stroopWordDisplay.style.transform = "scale(1)", 100);
      }
      nextWord();
    } else {
      // Wrong!
      playSound(false);
      stroopScore = Math.max(0, stroopScore - 1);
      if (stroopScoreDisplay) stroopScoreDisplay.textContent = stroopScore;
      if (stroopWordDisplay) {
        stroopWordDisplay.style.transform = "translateX(-10px)";
        setTimeout(() => stroopWordDisplay.style.transform = "translateX(10px)", 50);
        setTimeout(() => stroopWordDisplay.style.transform = "translateX(0)", 100);
      }
    }
  }

  function playTimerSound(type) {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'start') {
      // Ascending major arpeggio feel
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);     // A4
      osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1); // C#5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2); // E5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3);    // A5
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'end') {
      // Descending end chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);      // A5
      osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.8); // A2
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.8);
    } else if (type === 'warning10') {
      // More urgent, distinct double-beep alert
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
      osc.frequency.setValueAtTime(1000, audioCtx.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.1); // gap
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'tick') {
      // Short tick for last 3 seconds
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.1);
    }
  }

  function startStroopGame() {
    // Attempt to resume AudioContext so start sound plays properly on the very first click
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    playTimerSound('start');
    
    if (stroopScoreDisplay) stroopScoreDisplay.textContent = stroopScore;
    if (stroopTimerDisplay) stroopTimerDisplay.textContent = stroopTime;
    
    if (stroopIntro) stroopIntro.classList.add("hidden");
    if (stroopGameOver) stroopGameOver.classList.add("hidden");
    if (stroopGameContainer) stroopGameContainer.classList.remove("hidden");
    
    renderButtons();
    nextWord();
    
    clearInterval(stroopTimerInterval);
    stroopTimerInterval = setInterval(() => {
      stroopTime--;
      if (stroopTimerDisplay) stroopTimerDisplay.textContent = stroopTime;
      
      if (stroopTime === 10) {
        // playTimerSound('warning10');
      } else if (stroopTime <= 3 && stroopTime > 0) {
        playTimerSound('tick');
      }

      if (stroopTime <= 0) {
        endStroopGame();
      }
    }, 1000);
  }

  function endStroopGame() {
    playTimerSound('end');
    clearInterval(stroopTimerInterval);
    if (stroopGameContainer) stroopGameContainer.classList.add("hidden");
    if (stroopGameOver) stroopGameOver.classList.remove("hidden");
    if (finalScoreDisplay) finalScoreDisplay.textContent = stroopScore;
  }

  if (startStroopBtn && restartStroopBtn) {
    startStroopBtn.addEventListener("click", startStroopGame);
    restartStroopBtn.addEventListener("click", startStroopGame);
  }

})();
