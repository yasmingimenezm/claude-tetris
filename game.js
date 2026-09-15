'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#a7d8f0', // J - pastel blue
  '#ffb74d', // L - orange
  '#f06292', // D - donut pink
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // D - donut
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const SCORES_STORAGE_KEY = 'tetris-scores';
const STATS_STORAGE_KEY = 'tetris-stats';
const MAX_SCORES = 5;
const MAX_NAME_LENGTH = 12;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayCombo = document.getElementById('overlay-combo');
const overlayRecords = document.getElementById('overlay-records');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveNameBtn = document.getElementById('save-name-btn');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const startScreen = document.getElementById('start-screen');
const gameContainer = document.getElementById('game-container');
const startBtn = document.getElementById('start-btn');
const startRecords = document.getElementById('start-records');
const startBestCombo = document.getElementById('start-best-combo');
const startMaxLines = document.getElementById('start-max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const THEME_STORAGE_KEY = 'tetris-theme';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, combo, maxCombo;
let gridLineColor, blockHighlightColor;
let gameStarted = false;
let pendingSaveHandler = null, pendingSaveKeyHandler = null;

function clearPendingSaveHandlers() {
  if (!pendingSaveHandler) return;
  saveNameBtn.removeEventListener('click', pendingSaveHandler);
  nameInput.removeEventListener('keydown', pendingSaveKeyHandler);
  pendingSaveHandler = null;
  pendingSaveKeyHandler = null;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.checked = theme === 'light';
  const style = getComputedStyle(document.documentElement);
  gridLineColor = style.getPropertyValue('--color-grid-line').trim();
  blockHighlightColor = style.getPropertyValue('--color-block-highlight').trim();
}

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  if (current) draw();
});

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'dark');

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  if (gameOver) return;
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (gameOver) return;
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (gameOver) return;
  merge();
  const cleared = clearLines();
  if (!cleared) combo = 0;
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = blockHighlightColor;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (!gameOver) {
    // ghost
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  const stats = loadStats();
  saveStats({
    maxLines: Math.max(stats.maxLines, lines),
    bestCombo: Math.max(stats.bestCombo, maxCombo),
  });

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayCombo.textContent = `Mejor combo: ${maxCombo} · Líneas: ${lines}`;

  const scores = loadScores();
  const qualifies = scores.length < MAX_SCORES || score > scores[scores.length - 1].score;

  clearPendingSaveHandlers();

  if (qualifies) {
    nameEntry.classList.remove('hidden');
    overlayRecords.textContent = '';
    nameInput.value = '';
    nameInput.focus();

    pendingSaveHandler = () => {
      const { list, entry } = addScoreEntry(nameInput.value, score);
      renderRecords(overlayRecords, list, entry);
      nameEntry.classList.add('hidden');
      clearPendingSaveHandlers();
    };
    pendingSaveKeyHandler = e => {
      if (e.key === 'Enter') pendingSaveHandler();
    };
    saveNameBtn.addEventListener('click', pendingSaveHandler);
    nameInput.addEventListener('keydown', pendingSaveKeyHandler);
  } else {
    nameEntry.classList.add('hidden');
    renderRecords(overlayRecords, scores, null);
  }

  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  overlayCombo.textContent = '';
  overlayRecords.textContent = '';
  clearPendingSaveHandlers();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

/* ---- Records (persistencia local) ---- */

function loadScores() {
  try {
    const raw = localStorage.getItem(SCORES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(e => e && typeof e.name === 'string' && typeof e.score === 'number' && typeof e.date === 'string')
      .slice(0, MAX_SCORES);
  } catch {
    return [];
  }
}

function saveScores(list) {
  try {
    localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage no disponible (modo privado, cuota, etc.) — se ignora.
  }
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return { maxLines: 0, bestCombo: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { maxLines: 0, bestCombo: 0 };
    return {
      maxLines: typeof parsed.maxLines === 'number' ? parsed.maxLines : 0,
      bestCombo: typeof parsed.bestCombo === 'number' ? parsed.bestCombo : 0,
    };
  } catch {
    return { maxLines: 0, bestCombo: 0 };
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // localStorage no disponible — se ignora.
  }
}

function sanitizeName(name) {
  const trimmed = (name || '').toString().trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || 'Anónimo';
}

function addScoreEntry(name, s) {
  const scores = loadScores();
  const entry = { name: sanitizeName(name), score: s, date: new Date().toISOString() };
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const trimmed = scores.slice(0, MAX_SCORES);
  saveScores(trimmed);
  return { list: trimmed, entry };
}

function renderRecords(container, scores, highlightEntry) {
  container.textContent = '';
  if (!scores.length) {
    const p = document.createElement('p');
    p.className = 'records-empty';
    p.textContent = 'Sin récords todavía';
    container.appendChild(p);
    return;
  }
  const list = document.createElement('ol');
  list.className = 'records-list';
  scores.forEach(entry => {
    const li = document.createElement('li');
    if (highlightEntry && entry === highlightEntry) li.classList.add('records-highlight');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'records-name';
    nameSpan.textContent = entry.name;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'records-score';
    scoreSpan.textContent = entry.score.toLocaleString();
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    list.appendChild(li);
  });
  container.appendChild(list);
}

function renderStartScreen() {
  const scores = loadScores();
  const stats = loadStats();
  renderRecords(startRecords, scores, null);
  startBestCombo.textContent = stats.bestCombo;
  startMaxLines.textContent = stats.maxLines;
}

startBtn.addEventListener('click', () => {
  gameStarted = true;
  startScreen.classList.add('hidden');
  gameContainer.classList.remove('hidden');
  init();
});

resetRecordsBtn.addEventListener('click', () => {
  localStorage.removeItem(SCORES_STORAGE_KEY);
  localStorage.removeItem(STATS_STORAGE_KEY);
  renderStartScreen();
});

renderStartScreen();

document.addEventListener('keydown', e => {
  if (!gameStarted) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
