const TARGET_WORD = "КРИЛА";
const WORD_LENGTH = 5;
const INITIAL_ROWS = 6;

const KEYBOARD_ROWS = [
  ["Й", "Ц", "У", "К", "Е", "Н", "Г", "Ш", "Щ", "З", "Х", "Ї"],
  ["Ф", "І", "В", "А", "П", "Р", "О", "Л", "Д", "Ж", "Є"],
  ["ENTER", "Я", "Ч", "С", "М", "И", "Т", "Ь", "Б", "Ю", "Ґ", "BACKSPACE"],
];

const UKRAINIAN_LETTERS = new Set(
  KEYBOARD_ROWS.flat().filter((k) => k.length === 1)
);

const STATE_PRIORITY = {
  absent: 1,
  present: 2,
  correct: 3,
};

const boardEl = document.getElementById("board");
const keyboardEl = document.getElementById("keyboard");
const statusEl = document.getElementById("status");

let currentRow = 0;
let currentGuess = "";
let gameOver = false;
let isChecking = false;
let statusTimer = null;
let lastAnnouncement = "";
let confettiFrame = null;
let confettiCanvas = null;
let confettiTimers = [];
const wordCache = new Map();

function createRow(rowIndex) {
  const rowEl = document.createElement("div");
  rowEl.className = "row";
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tileEl = document.createElement("div");
    tileEl.className = "tile";
    tileEl.setAttribute("aria-label", `Рядок ${rowIndex + 1}, літера ${c + 1}`);
    rowEl.appendChild(tileEl);
  }
  boardEl.appendChild(rowEl);
  return rowEl;
}

function buildBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < INITIAL_ROWS; r++) {
    createRow(r);
  }
}

function buildKeyboard() {
  keyboardEl.innerHTML = "";
  for (const row of KEYBOARD_ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";
    for (const key of row) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "key";
      btn.dataset.key = key;

      if (key === "ENTER") {
        btn.textContent = "Ввід";
        btn.classList.add("wide");
        btn.setAttribute("aria-label", "Перевірити слово");
      } else if (key === "BACKSPACE") {
        btn.textContent = "⌫";
        btn.classList.add("wide");
        btn.setAttribute("aria-label", "Видалити літеру");
      } else {
        btn.textContent = key;
      }

      btn.addEventListener("click", () => handleKey(key));
      rowEl.appendChild(btn);
    }
    keyboardEl.appendChild(rowEl);
  }
}

function showStatus(message, type = "default") {
  clearTimeout(statusTimer);
  let text = message;
  if (text === lastAnnouncement) text += "\u00A0";
  lastAnnouncement = text;
  if (type === "warning") {
    statusEl.dataset.type = "warning";
  } else {
    delete statusEl.dataset.type;
  }
  statusEl.textContent = text;
  statusEl.classList.add("visible");
  statusTimer = setTimeout(() => {
    statusEl.classList.remove("visible");
  }, 2200);
}

function updateCurrentRow() {
  const rowEl = boardEl.children[currentRow];
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tileEl = rowEl.children[c];
    const letter = currentGuess[c] || "";
    tileEl.textContent = letter;
    tileEl.dataset.state = letter ? "tbd" : "";
  }
}

function evaluateGuess(guess, target) {
  const result = Array(WORD_LENGTH).fill("absent");
  const remaining = {};

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === target[i]) {
      result[i] = "correct";
    } else {
      remaining[target[i]] = (remaining[target[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    const ch = guess[i];
    if (remaining[ch] > 0) {
      result[i] = "present";
      remaining[ch] -= 1;
    }
  }

  return result;
}

function updateKeyboard(guess, states) {
  for (let i = 0; i < WORD_LENGTH; i++) {
    const letter = guess[i];
    const nextState = states[i];
    const keyBtn = keyboardEl.querySelector(`button[data-key="${letter}"]`);
    if (!keyBtn) continue;

    const prevState = keyBtn.dataset.state;
    if (!prevState || STATE_PRIORITY[nextState] > STATE_PRIORITY[prevState]) {
      keyBtn.dataset.state = nextState;
    }
  }
}

function shakeCurrentRow(message, type = "default") {
  const rowEl = boardEl.children[currentRow];
  rowEl.classList.remove("shake");
  void rowEl.offsetWidth;
  rowEl.classList.add("shake");
  showStatus(message, type);
}

async function validateWord(word) {
  if (word === TARGET_WORD) return true;
  if (wordCache.has(word)) return wordCache.get(word);

  const response = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      text: word.toLowerCase(),
      language: "uk",
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const hasSpellingError = Array.isArray(data.matches) && data.matches.some(
    (match) =>
      match.rule?.issueType === "misspelling" ||
      match.rule?.id?.startsWith("MORFOLOGIK")
  );
  const isValid = !hasSpellingError;
  wordCache.set(word, isValid);
  return isValid;
}

async function submitGuess() {
  if (currentGuess.length < WORD_LENGTH) {
    shakeCurrentRow("Недостатньо літер");
    return;
  }

  const rowEl = boardEl.children[currentRow];
  isChecking = true;
  rowEl.classList.add("checking");
  try {
    const isValid = await validateWord(currentGuess);
    if (!isValid) {
      rowEl.classList.remove("checking");
      shakeCurrentRow("Такого слова немає в словнику", "warning");
      return;
    }
  } catch {
    showStatus("Помилка перевірки слова, спробуйте ще раз");
    return;
  } finally {
    rowEl.classList.remove("checking");
    isChecking = false;
  }

  const states = evaluateGuess(currentGuess, TARGET_WORD);

  for (let c = 0; c < WORD_LENGTH; c++) {
    const tileEl = rowEl.children[c];
    tileEl.dataset.state = states[c];
    tileEl.classList.add("reveal");
  }

  updateKeyboard(currentGuess, states);

  if (currentGuess === TARGET_WORD) {
    gameOver = true;
    launchConfetti();
    return;
  }

  currentRow += 1;
  currentGuess = "";

  if (currentRow >= boardEl.children.length) {
    const newRow = createRow(currentRow);
    newRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function handleKey(key) {
  if (gameOver || isChecking) return;

  if (key === "BACKSPACE") {
    if (currentGuess.length > 0) {
      currentGuess = currentGuess.slice(0, -1);
      updateCurrentRow();
    }
    return;
  }

  if (key === "ENTER") {
    submitGuess();
    return;
  }

  if (UKRAINIAN_LETTERS.has(key) && currentGuess.length < WORD_LENGTH) {
    currentGuess += key;
    updateCurrentRow();
  }
}

function stopConfetti() {
  for (const id of confettiTimers) {
    clearTimeout(id);
  }
  confettiTimers = [];
  if (confettiFrame !== null) {
    cancelAnimationFrame(confettiFrame);
    confettiFrame = null;
  }
  if (confettiCanvas) {
    confettiCanvas.remove();
    confettiCanvas = null;
  }
}

function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  stopConfetti();

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100";
  document.body.appendChild(canvas);
  confettiCanvas = canvas;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    stopConfetti();
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const colors = [
    "#2e7d32",
    "#c49000",
    "#0057b7",
    "#ffd700",
    "#d45500",
    "#e91e63",
  ];

  const pieces = [];
  const bursts = [];
  const sides = ["left", "right", "top"];

  for (const side of sides) {
    for (let i = 0; i < 4; i++) {
      bursts.push({ side, delay: i * 1050 + Math.random() * 850 });
    }
  }

  let pendingBursts = bursts.length;

  function createPiece(x, y, vx, vy) {
    return {
      x,
      y,
      w: 8 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      vx,
      vy,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.025 + Math.random() * 0.035,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.1,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  }

  function spawnSideBurst(side) {
    const count = width < 600 ? 34 : 50;
    const minSpeed = Math.max(6.5, width * 0.011);
    const maxSpeed = Math.max(11.5, width * 0.018);
    const baseY = height * (0.28 + Math.random() * 0.42);
    const baseAngle = -0.25 - Math.random() * 0.55;

    for (let i = 0; i < count; i++) {
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      const angle = baseAngle + (Math.random() - 0.5) * 0.5;
      const vx = Math.cos(angle) * speed * (side === "left" ? 1 : -1);
      const vy = Math.sin(angle) * speed;
      const x = side === "left" ? -10 : width + 10;
      const y = baseY + (Math.random() - 0.5) * 70;
      pieces.push(createPiece(x, y, vx, vy));
    }
  }

  function spawnTopBurst() {
    const count = width < 600 ? 38 : 55;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.85;
      const speed = 1.9 + Math.random() * 2.2;
      pieces.push(
        createPiece(
          Math.random() * width,
          -20 - Math.random() * 90,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed
        )
      );
    }
  }

  function fireBurst(side) {
    pendingBursts -= 1;
    if (side === "top") {
      spawnTopBurst();
    } else {
      spawnSideBurst(side);
    }
  }

  for (const burst of bursts) {
    confettiTimers.push(setTimeout(() => fireBurst(burst.side), burst.delay));
  }

  let lastTime = performance.now();

  function tick(now) {
    const dt = Math.min((now - lastTime) / 16.667, 3);
    lastTime = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    let alive = pendingBursts > 0;
    const drag = Math.pow(0.985, dt);

    for (const p of pieces) {
      if (p.y >= height + 20) continue;
      alive = true;

      p.swayPhase += p.swaySpeed * dt;
      p.vx *= drag;
      p.x += (p.vx + Math.sin(p.swayPhase) * 0.65) * dt;
      p.y += p.vy * dt;
      p.vy = Math.min(p.vy + 0.08 * dt, 4.2);
      p.rot += p.vRot * dt;

      const cos = Math.cos(p.rot) * dpr;
      const sin = Math.sin(p.rot) * dpr;
      ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }

    if (alive) {
      confettiFrame = requestAnimationFrame(tick);
    } else {
      stopConfetti();
    }
  }

  confettiFrame = requestAnimationFrame(tick);
}

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (
    e.target instanceof HTMLButtonElement &&
    (e.key === "Enter" || e.key === " ")
  ) {
    return;
  }

  if (e.key === "Backspace") {
    e.preventDefault();
    handleKey("BACKSPACE");
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    handleKey("ENTER");
    return;
  }

  const upper = e.key.toUpperCase();
  if (UKRAINIAN_LETTERS.has(upper)) {
    handleKey(upper);
  }
});

buildBoard();
buildKeyboard();
