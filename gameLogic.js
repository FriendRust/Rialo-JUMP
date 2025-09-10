// ======================= gameLogic.js (v4) =======================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gameOverModal = document.getElementById('gameOverModal');
const finalScoreText = document.getElementById('finalScore');
const restartButton = document.getElementById('restartButton');
const howToPlayButton = document.getElementById('howToPlayButton');

const BASE_W = 400, BASE_H = 800;
const SCALE = Math.min(canvas.width / BASE_W, canvas.height / BASE_H);

const START_X = Math.round(200 * SCALE);
const START_Y = Math.round(700 * SCALE);

let player = {
  x: START_X,
  y: START_Y,
  width:  Math.round(75 * SCALE),
  height: Math.round(75 * SCALE),
  dy: 0,
  dx: 0,
  gravity: 0.12 * SCALE,
  jumpPower: -8 * SCALE,
  speed: 6 * SCALE,
  state: 'idle'
};

let platforms = [];
let shrimps = [];      
let score = 0;
let gameOver = false;
let gameState = 'menu';
let paused = false;

const BASE_PLATFORM_W = 100, BASE_PLATFORM_H = 25;
const BASE_SPRING_W   = 100, BASE_SPRING_H   = 25;
const BASE_SPIKED_W   = 100, BASE_SPIKED_H   = 25;
const BASE_DISP_W     = 100, BASE_DISP_H     = 25;

let platformWidth       = Math.round(BASE_PLATFORM_W * SCALE);
let platformHeight      = Math.round(BASE_PLATFORM_H * SCALE);
let springWidth         = Math.round(BASE_SPRING_W   * SCALE);
let springHeight        = Math.round(BASE_SPRING_H   * SCALE);
let spikedWidth         = Math.round(BASE_SPIKED_W   * SCALE);
let spikedHeight        = Math.round(BASE_SPIKED_H   * SCALE);
let disappearingWidth   = Math.round(BASE_DISP_W     * SCALE);
let disappearingHeight  = Math.round(BASE_DISP_H     * SCALE);

const platformCount = 5;
let scrollThreshold       = Math.round(160 * SCALE);
let scrollSpeed           = 5 * SCALE;
const scrollSpeedIncrease = 0.10 * SCALE;
let maxJumpDistance       = Math.round(220 * SCALE);
let movingPlatformSpeed   = 0.9 * SCALE;

const P_MOVING    = 0.22;
const P_SPRING    = 0.08;
const P_SPIKED    = 0.05;   // было 0.06
const P_DISAPPEAR = 0.12;

const MIN_X_GAP  = Math.round(80 * SCALE);

const BASE_SHRIMP_W = 40, BASE_SHRIMP_H = 40;
const SHRIMP_W = Math.round(BASE_SHRIMP_W * SCALE);
const SHRIMP_H = Math.round(BASE_SHRIMP_H * SCALE);
const SHRIMP_VALUE = 1;
const SHRIMP_CAP = 30;
const SHRIMP_INTERVAL_MS_BASE   = 900;
const SHRIMP_INTERVAL_MS_JITTER = 600;
let nextShrimpAt = 0;

let keys = { left: false, right: false };

function randXWithGap(prevX, width) {
  let tries = 0;
  while (tries < 25) {
    const x = Math.random() * (canvas.width - width);
    if (prevX == null || Math.abs(x - prevX) >= MIN_X_GAP) return x;
    tries++;
  }
  return prevX < canvas.width / 2
    ? Math.min(prevX + MIN_X_GAP, canvas.width - width)
    : Math.max(prevX - MIN_X_GAP, 0);
}
function randXFarFrom(targetX, width) {
  let tries = 0;
  while (tries < 25) {
    const x = Math.random() * (canvas.width - width);
    if (Math.abs(x - targetX) >= MIN_X_GAP) return x;
    tries++;
  }
  return targetX < canvas.width / 2
    ? Math.min(targetX + MIN_X_GAP, canvas.width - width)
    : Math.max(targetX - MIN_X_GAP, 0);
}

function spawnShrimpAt(x, y) {
  if (shrimps.length >= SHRIMP_CAP) return;
  shrimps.push({ x, y, w: SHRIMP_W, h: SHRIMP_H, collected: false });
}
function scheduleNextShrimp() {
  nextShrimpAt =
    Date.now() + SHRIMP_INTERVAL_MS_BASE + Math.floor(Math.random() * SHRIMP_INTERVAL_MS_JITTER);
}

function initPlatforms() {
  platforms = [];
  shrimps = [];
  let lastX = null;

  const startX = Math.max(0, Math.min(player.x - platformWidth / 2, canvas.width - platformWidth));
  const startY = Math.min(
    player.y + player.height - Math.round(6 * SCALE),
    canvas.height - Math.round(10 * SCALE)
  );
  platforms.push({
    x: startX, y: startY,
    moving: false, direction: 1, scored: false,
    disappearing: false, spiked: false, spring: false
  });
  lastX = startX;

  for (let i = 1; i < platformCount; i++) {
    const x = randXWithGap(lastX, platformWidth);
    lastX = x;
    let plat = {
      x,
      y: canvas.height - (i * (canvas.height / platformCount)),
      moving: Math.random() < P_MOVING,
      direction: Math.random() > 0.5 ? 1 : -1,
      scored: false,
      disappearing: Math.random() < P_DISAPPEAR,
      disappearingWidth, disappearingHeight,
      spiked: Math.random() < P_SPIKED,
      spring: Math.random() < P_SPRING,
      springWidth, springHeight, spikedWidth, spikedHeight
    };
    if (plat.spiked) plat.disappearing = false; 
    platforms.push(plat);

    if (plat.spiked) {
      const buddyX = randXFarFrom(plat.x, platformWidth);
      platforms.push({
        x: buddyX,
        y: plat.y,
        moving: Math.random() < P_MOVING,
        direction: Math.random() > 0.5 ? 1 : -1,
        scored: false,
        disappearing: false,
        spiked: false,
        spring: Math.random() < P_SPRING,
        springWidth, springHeight, spikedWidth, spikedHeight
      });
    }
  }
}

function showGameOver() {
  gameOver = true;
  finalScoreText.textContent = `Score: ${score}`;
  gameOverModal.classList.add('show');
}

async function update() {
  if (gameState !== 'playing' || gameOver || paused) return;

  const dynamicScrollSpeed = scrollSpeed + Math.floor(score / 12) * scrollSpeedIncrease;

  player.dy += player.gravity;
  player.y += player.dy;

  if (keys.left) player.dx = -player.speed;
  else if (keys.right) player.dx = player.speed;
  else player.dx = 0;
  player.x += player.dx;

  if (player.x + player.width < 0) player.x = canvas.width;
  if (player.x > canvas.width) player.x = -player.width;

  if (player.y < scrollThreshold) {
    const dy = dynamicScrollSpeed;
    platforms.forEach(p => (p.y += dy));
    shrimps.forEach(s  => (s.y += dy));
    player.y += dy;
  }

  platforms.forEach(p => {
    if (p.moving) {
      const currentWidth = p.spring ? p.springWidth
        : (p.spiked ? p.spikedWidth
        : (p.disappearing ? p.disappearingWidth : platformWidth));
      p.x += p.direction * movingPlatformSpeed;
      if (p.x <= 0) p.direction = 1;
      if (p.x + currentWidth >= canvas.width) p.direction = -1;
    }
  });

  platforms = platforms.filter(p => p.y < canvas.height);
  shrimps   = shrimps.filter(s => s.y < canvas.height + Math.round(40 * SCALE) && !s.collected);

  if (platforms.length === 0) {
    const x = Math.random() * (canvas.width - platformWidth);
    platforms.push({
      x, y: -platformHeight,
      moving: Math.random() < P_MOVING, direction: Math.random() > 0.5 ? 1 : -1,
      scored: false,
      disappearing: Math.random() < P_DISAPPEAR, disappearingWidth, disappearingHeight,
      spiked: Math.random() < P_SPIKED,
      spring: Math.random() < P_SPRING, springWidth, springHeight, spikedWidth, spikedHeight
    });
  }

  if (Date.now() >= nextShrimpAt && gameState === 'playing') {
    const minAbove = Math.round(canvas.height * 0.25);
    const maxAbove = Math.round(canvas.height * 0.65);
    const above = Math.round(minAbove + Math.random() * (maxAbove - minAbove));
    const y = player.y - above;

    const margin = Math.round(20 * SCALE);
    const x = Math.round(margin + Math.random() * (canvas.width - SHRIMP_W - margin * 2));

    spawnShrimpAt(x, y);
    scheduleNextShrimp();
  }

  let highestPlatform = platforms.length > 0
    ? platforms.reduce((h, p) => (p.y < h.y ? p : h), platforms[0])
    : { y: 0 };

  let stepMin = Math.round(70 * SCALE);
  if (maxJumpDistance <= stepMin + Math.round(5 * SCALE)) {
    stepMin = Math.max(Math.round(30 * SCALE), Math.floor(maxJumpDistance * 0.6));
  }

  const perFrameCap = 4;
  let generatedThisFrame = 0;
  let lastX = platforms.length ? platforms[platforms.length - 1].x : null;

  while (highestPlatform.y > -maxJumpDistance && generatedThisFrame < perFrameCap) {
    const delta = Math.random() * (maxJumpDistance - stepMin) + stepMin;
    const newY = highestPlatform.y - delta;

    const x = randXWithGap(lastX, platformWidth);
    lastX = x;

    const plat = {
      x, y: newY,
      moving: Math.random() < P_MOVING,
      direction: Math.random() > 0.5 ? 1 : -1,
      scored: false,
      disappearing: Math.random() < P_DISAPPEAR,
      disappearingWidth, disappearingHeight,
      spiked: Math.random() < P_SPIKED,
      spring: Math.random() < P_SPRING,
      springWidth, springHeight, spikedWidth, spikedHeight
    };
    if (plat.spiked) plat.disappearing = false;
    platforms.push(plat);

    if (plat.spiked) {
      const buddyX = randXFarFrom(plat.x, platformWidth);
      platforms.push({
        x: buddyX,
        y: plat.y,
        moving: Math.random() < P_MOVING,
        direction: Math.random() > 0.5 ? 1 : -1,
        scored: false,
        disappearing: false, 
        spiked: false,
        spring: Math.random() < P_SPRING,
        springWidth, springHeight, spikedWidth, spikedHeight
      });
    }

    highestPlatform = platforms.reduce((h, p) => (p.y < h.y ? p : h), platforms[0]);
    generatedThisFrame++;
  }

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    const w = p.spring ? p.springWidth
      : (p.spiked ? p.spikedWidth
      : (p.disappearing ? p.disappearingWidth : platformWidth));
    const h = p.spring ? p.springHeight
      : (p.spiked ? p.spikedHeight
      : (p.disappearing ? p.disappearingHeight : platformHeight));

    if (
      player.dy > 0 &&
      player.y + player.height > p.y &&
      player.y + player.height < p.y + h + Math.round(8 * SCALE) &&
      player.x + player.width > p.x &&
      player.x < p.x + w
    ) {
      if (p.spiked) { showGameOver(); return; }
      player.dy = p.spring ? player.jumpPower * 1.25 : player.jumpPower;
      if (p.disappearing) platforms.splice(i, 1);
      break;
    }
  }

  for (let s of shrimps) {
    if (!s.collected &&
        player.x < s.x + s.w &&
        player.x + player.width > s.x &&
        player.y < s.y + s.h &&
        player.y + player.height > s.y) {
      s.collected = true;
      score += SHRIMP_VALUE;
    }
  }

  if (player.dy < 0) player.state = 'jump';
  else if (player.dy > 2 * SCALE) player.state = 'fall';
  else player.state = 'idle';

  if (player.y > canvas.height) showGameOver();
}

function resetGame() {
  player.x = START_X;
  player.y = START_Y;
  player.dy = 0; player.dx = 0; player.state = 'idle';

  score = 0;
  platforms = [];
  shrimps = [];
  scrollThreshold     = Math.round(160 * SCALE);
  scrollSpeed         = 5 * SCALE;
  maxJumpDistance     = Math.round(220 * SCALE);
  movingPlatformSpeed = 0.9 * SCALE;

  gameOver = false; paused = false; gameState = 'menu';
  gameOverModal.classList.remove('show');

  initPlatforms();
  scheduleNextShrimp();
}

function togglePause() { if (gameState === 'playing' && !gameOver) paused = !paused; }
function setPause(v)    { if (gameState === 'playing' && !gameOver) paused = !!v; }

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'ф') keys.left = true;
  if (e.key === 'ArrowRight'|| e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'в') keys.right = true;

  if (e.key === 'Enter') {
    if (gameState === 'menu') {
      gameState = 'playing';
      scheduleNextShrimp();
      gameData.startGameLoop();
    } else if (gameState === 'howToPlay') {
      gameState = 'menu';
    } else if (gameOver) {
      resetGame();
      gameState = 'playing';
      scheduleNextShrimp();
      gameData.startGameLoop();
    }
  }

  if (e.key === 'Escape') { if (gameState === 'howToPlay') { gameState = 'menu'; return; } togglePause(); }
  if (e.key === 'p' || e.key === 'P') togglePause();
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'ф') keys.left = false;
  if (e.key === 'ArrowRight'|| e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'в') keys.right = false;
});

restartButton.addEventListener('click', () => {
  resetGame();
  gameState = 'playing';
  scheduleNextShrimp();
  gameData.startGameLoop();
});

howToPlayButton.addEventListener('click', () => { if (gameState === 'menu') gameState = 'howToPlay'; });

export const gameData = {
  canvas, ctx, player,
  getPlatforms: () => platforms,
  getShrimps:   () => shrimps,
  getScore: () => score,
  getGameOver: () => gameOver,
  getGameState: () => gameState,
  platformWidth, platformHeight,
  disappearingWidth, disappearingHeight,
  update, resetGame, initPlatforms,
  startGameLoop: () => {},
  togglePause, setPause, getPaused: () => paused,
};

scheduleNextShrimp();
