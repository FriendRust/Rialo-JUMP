import { gameData } from './gameLogic.js';

const {
  canvas, ctx, player,
  platformWidth, platformHeight,
  disappearingWidth, disappearingHeight,
  update, initPlatforms,
  getScore, getGameOver, getGameState, getPlatforms, getShrimps
} = gameData;

let animationFrameId = null;

const startButton = document.getElementById('startButton');

if (startButton) {
  startButton.addEventListener('click', () => {
    if (gameData.getGameState && gameData.getGameState() === 'menu') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }
  });
}

const BASE_W = 400, BASE_H = 800;
const SCALE = Math.min(canvas.width / BASE_W, canvas.height / BASE_H);

const playerSprites = { idle: new Image(), jump: new Image(), fall: new Image() };
playerSprites.idle.src = 'player_idle.png?v=17';
playerSprites.jump.src = 'player_jump.png?v=17';
playerSprites.fall.src = 'player_fall.png?v=17';
let spritesLoaded = { idle: false, jump: false, fall: false };
for (const k in playerSprites) playerSprites[k].onload = () => (spritesLoaded[k] = true);

function drawPlayer() {
  const state = player.state || 'idle';
  const img = playerSprites[state];
  if (img && spritesLoaded[state]) ctx.drawImage(img, player.x, player.y, player.width, player.height);
  else { ctx.fillStyle = '#FFD700'; ctx.fillRect(player.x, player.y, player.width, player.height); }
}

const backgroundImage = new Image();
backgroundImage.src = 'background.png?v=17';
let backgroundLoaded = false;
backgroundImage.onload = () => (backgroundLoaded = true);

function drawImageCover(img, dx, dy, dw, dh) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sx, sy, sw, sh;
  if (dr > ir) { sw = img.width; sh = img.width / dr; sx = 0; sy = (img.height - sh) / 2; }
  else { sw = img.height * dr; sh = img.height; sx = (img.width - sw) / 2; sy = 0; }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

const normalPlatformImage = new Image();        normalPlatformImage.src = 'platform.png?v=17';
const springPlatformImage = new Image();        springPlatformImage.src = 'springPlatform.png?v=17';
const spikedPlatformImage = new Image();        spikedPlatformImage.src = 'spikedPlatform.png?v=17';
const disappearingPlatformImage = new Image();  disappearingPlatformImage.src = 'disappearingPlatform.png?v=17';

let normalPlatformLoaded = false, springPlatformLoaded = false, spikedPlatformLoaded = false, disappearingPlatformLoaded = false;
normalPlatformImage.onload = () => (normalPlatformLoaded = true);
springPlatformImage.onload = () => (springPlatformLoaded = true);
spikedPlatformImage.onload = () => (spikedPlatformLoaded = true);
disappearingPlatformImage.onload = () => (disappearingPlatformLoaded = true);

const shrimpImage = new Image();
shrimpImage.src = 'shrimp.png?v=17';
let shrimpLoaded = false;
shrimpImage.onload = () => (shrimpLoaded = true);

const mainMenu = document.getElementById('mainMenu');
const howToPlayModal = document.getElementById('howToPlayModal');
const controlsHint = document.getElementById('controlsHint');
const pauseBtn = document.getElementById('pauseBtn');
let showControlsHint = true, hasJumped = false;

if (pauseBtn) {
  pauseBtn.addEventListener('click', () => {
    if (typeof gameData.togglePause !== 'function' || typeof gameData.getPaused !== 'function') return;
    gameData.togglePause();
    if (gameData.getPaused()) { stopGameLoop(); draw(true); }
    else { gameData.startGameLoop(); }
  });
}

function drawPlatforms() {
  const platforms = getPlatforms();
  if (!platforms || platforms.length === 0) return;

  platforms.forEach(p => {
    if (p.spiked) {
      if (spikedPlatformLoaded) {
        const y = p.y - (p.spikedHeight / 2);
        ctx.drawImage(spikedPlatformImage, p.x, y, p.spikedWidth, p.spikedHeight);
      } else { ctx.fillStyle = '#8B0000'; ctx.fillRect(p.x, p.y, p.spikedWidth, p.spikedHeight); }
    } else if (p.spring) {
      if (springPlatformLoaded) {
        const y = p.y - Math.round(p.springHeight * 0.35);
        ctx.drawImage(springPlatformImage, p.x, y, p.springWidth, p.springHeight);
      } else { ctx.fillStyle = '#7A3FFF'; ctx.fillRect(p.x, p.y, p.springWidth, p.springHeight); }
    } else if (p.disappearing) {
      if (disappearingPlatformLoaded) {
        const y = p.y - Math.round(p.disappearingHeight * 0.30);
        ctx.drawImage(disappearingPlatformImage, p.x, y, p.disappearingWidth, p.disappearingHeight);
      } else { ctx.fillStyle = 'rgba(211,211,230,0.7)'; ctx.fillRect(p.x, p.y, p.disappearingWidth, p.disappearingHeight); }
    } else {
      if (normalPlatformLoaded) {
        const y = p.y - Math.round(platformHeight * 0.25);
        ctx.drawImage(normalPlatformImage, p.x, y, platformWidth, platformHeight);
      } else { ctx.fillStyle = '#B96AC9'; ctx.fillRect(p.x, p.y, platformWidth, platformHeight); }
    }
  });
}

function drawShrimps() {
  const shrimps = getShrimps();
  if (!shrimps || shrimps.length === 0) return;
  shrimps.forEach(s => {
    if (s.collected) return;
    if (shrimpLoaded) ctx.drawImage(shrimpImage, s.x, s.y, s.w, s.h);
    else { ctx.fillStyle = '#FF7F50'; ctx.fillRect(s.x, s.y, s.w, s.h); }
  });
}

function draw(flagPausedOverlay = false) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (backgroundLoaded) drawImageCover(backgroundImage, 0, 0, canvas.width, canvas.height);
  else { const g = ctx.createLinearGradient(0, 0, 0, canvas.height/2); g.addColorStop(0,'#87CEEB'); g.addColorStop(1,'#1E90FF'); ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height); }

  if (getGameState() === 'playing') {
    drawPlayer();
    drawPlatforms();
    drawShrimps();

    ctx.fillStyle = 'white'; ctx.strokeStyle = 'black'; ctx.lineWidth = 1;
    ctx.font = `${Math.round(16 * SCALE)}px 'Press Start 2P'`;
    ctx.fillText(`Score: ${getScore()}`, Math.round(10 * SCALE), Math.round(30 * SCALE));
    ctx.strokeText(`Score: ${getScore()}`, Math.round(10 * SCALE), Math.round(30 * SCALE));

    if (controlsHint) controlsHint.classList.toggle('show', showControlsHint);
  }

  if (getGameState() === 'menu') { mainMenu.classList.add('show'); howToPlayModal.classList.remove('show'); }
  else if (getGameState() === 'howToPlay') { mainMenu.classList.remove('show'); howToPlayModal.classList.add('show'); }
  else { mainMenu.classList.remove('show'); howToPlayModal.classList.remove('show'); }

  if (flagPausedOverlay || gameData.getPaused()) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = `${Math.round(24 * SCALE)}px 'Press Start 2P'`;
    ctx.textAlign = 'center'; ctx.fillText('PAUSED', canvas.width/2, canvas.height/2);
    ctx.restore();
  }
}

function gameLoop() {
  if (gameData.getPaused()) { draw(true); return; }
  try { update(); draw(); } 
  catch (err) {
    console.error('[Render error]', err);
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#fff'; ctx.font=`${Math.round(18 * SCALE)}px 'Press Start 2P'`; ctx.textAlign='center';
    ctx.fillText('ERROR (see console)', canvas.width/2, canvas.height/2); ctx.restore();
  }
  if (!getGameOver()) animationFrameId = requestAnimationFrame(gameLoop);

  if (!hasJumped && player.y < canvas.height - Math.round(100 * SCALE) && getGameState() === 'playing') {
    hasJumped = true; showControlsHint = false;
  }
}

function stopGameLoop() { if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; } }
gameData.startGameLoop = () => { stopGameLoop(); gameLoop(); };

initPlatforms();
gameLoop();
