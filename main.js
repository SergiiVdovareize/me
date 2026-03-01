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
})();
