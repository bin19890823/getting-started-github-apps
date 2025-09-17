(() => {
  'use strict';

  const canvas = document.getElementById('game');
  if (!(canvas instanceof HTMLCanvasElement)) {
    return;
  }

  const ctx = canvas.getContext('2d');
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  const player = {
    width: 26,
    height: 32,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    tilt: 0
  };

  const controls = {
    left: false,
    right: false
  };

  let pointerActive = false;
  let stairs = [];

  const baseSpawnInterval = 0.95;
  let spawnInterval = baseSpawnInterval;
  let spawnTimer = 0;

  const baseStepSpeed = 90;
  let stepSpeed = baseStepSpeed;

  const baseGravity = 1400;
  let gravity = baseGravity;

  const basePlayerSpeed = 260;

  let distance = 0;
  let score = 0;
  let bestScore = 0;
  let highlightBest = false;

  let gameState = 'title';
  let lastTime = 0;
  let difficultyTimer = 0;

  const stepColors = ['#90e0ef', '#72efdd', '#56cfe1', '#80ffdb', '#64dfdf', '#ade8f4'];

  function randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loadBestScore() {
    try {
      const stored = localStorage.getItem('kidDownstairsBestScore');
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!Number.isNaN(parsed)) {
          bestScore = parsed;
        }
      }
    } catch (error) {
      bestScore = 0;
    }
  }

  function saveBestScore() {
    try {
      localStorage.setItem('kidDownstairsBestScore', String(bestScore));
    } catch (error) {
      // 忽略儲存失敗（例如無痕視窗）
    }
  }

  function createStep(yPosition) {
    const width = randomRange(70, 130);
    const height = 18;
    const y = typeof yPosition === 'number' ? yPosition : -height - randomRange(20, 70);
    const last = stairs[stairs.length - 1];

    let x;
    if (last) {
      const direction = Math.random() < 0.5 ? -1 : 1;
      const shift = randomRange(50, 140) * direction;
      x = clamp(last.x + shift, 0, WIDTH - width);

      if (Math.abs(x - last.x) < 30) {
        x = clamp(last.x + (direction < 0 ? -70 : 70), 0, WIDTH - width);
      }

      if (Math.random() < 0.2) {
        x = clamp(randomRange(last.x - 140, last.x + 140), 0, WIDTH - width);
      }
    } else {
      x = (WIDTH - width) / 2;
    }

    const color = stepColors[Math.floor(Math.random() * stepColors.length)];
    stairs.push({ x, y, width, height, color });
  }

  function resetState() {
    stairs = [];
    stepSpeed = baseStepSpeed;
    spawnInterval = baseSpawnInterval;
    spawnTimer = 0;
    gravity = baseGravity;
    distance = 0;
    score = 0;
    difficultyTimer = 0;
    highlightBest = false;

    let y = HEIGHT - 80;
    for (let i = 0; i < 9; i += 1) {
      createStep(y);
      y -= randomRange(60, 95);
    }

    const baseStep = stairs[0];
    player.x = baseStep.x + baseStep.width / 2 - player.width / 2;
    player.y = baseStep.y - player.height;
    player.vx = 0;
    player.vy = stepSpeed;
    player.tilt = 0;
    controls.left = false;
    controls.right = false;
    pointerActive = false;
  }

  function startGame() {
    resetState();
    gameState = 'running';
  }

  function handleStartRequest() {
    if (gameState === 'title' || gameState === 'gameover') {
      startGame();
    }
  }

  function gameOver() {
    gameState = 'gameover';
    stopPointer();
    player.y = Math.min(player.y, HEIGHT - player.height);
    player.vy = 0;
    player.tilt = 0;

    if (score > bestScore) {
      bestScore = score;
      highlightBest = true;
      saveBestScore();
    } else {
      highlightBest = false;
    }
  }

  function update(delta) {
    spawnTimer += delta;
    difficultyTimer += delta;

    if (difficultyTimer >= 8) {
      difficultyTimer = 0;
      stepSpeed = Math.min(stepSpeed + 12, 240);
      spawnInterval = Math.max(0.45, spawnInterval - 0.05);
      gravity = Math.min(gravity + 60, 1850);
    }

    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      createStep();
    }

    const dynamicSpeed = basePlayerSpeed + (stepSpeed - baseStepSpeed) * 0.6;

    player.vx = 0;
    if (controls.left) {
      player.vx -= dynamicSpeed;
    }
    if (controls.right) {
      player.vx += dynamicSpeed;
    }

    player.x += player.vx * delta;
    player.x = clamp(player.x, 0, WIDTH - player.width);

    const previousY = player.y;
    const previousBottom = previousY + player.height;

    player.vy += gravity * delta;
    player.y += player.vy * delta;
    const bottom = player.y + player.height;

    player.tilt += ((player.vx / (dynamicSpeed || 1)) - player.tilt) * 0.18;

    let onStep = false;

    for (let i = stairs.length - 1; i >= 0; i -= 1) {
      const step = stairs[i];
      const prevStepY = step.y;
      step.y += stepSpeed * delta;

      if (
        !onStep &&
        player.vy >= 0 &&
        previousBottom <= prevStepY &&
        bottom >= step.y &&
        player.x + player.width > step.x &&
        player.x < step.x + step.width
      ) {
        player.y = step.y - player.height;
        player.vy = stepSpeed;
        onStep = true;
      }

      if (step.y > HEIGHT + step.height) {
        stairs.splice(i, 1);
      }
    }

    distance += stepSpeed * delta;
    score = Math.max(0, Math.floor(distance / 10));

    if (player.y > HEIGHT) {
      gameOver();
    }
  }

  function drawKid() {
    const px = player.x;
    const py = player.y;
    const lean = clamp(player.tilt, -1, 1) * 0.4;

    ctx.save();
    ctx.translate(px + player.width / 2, py + player.height / 2);
    ctx.rotate(lean);

    const bodyWidth = player.width - 10;
    const bodyHeight = player.height - 16;

    ctx.fillStyle = '#ff8fab';
    ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2 + 6, bodyWidth, bodyHeight);

    const headRadius = player.width / 2 - 3;
    ctx.fillStyle = '#ffe5d9';
    ctx.beginPath();
    ctx.arc(0, -bodyHeight / 2 + 2, headRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1b263b';
    ctx.beginPath();
    ctx.arc(-6, -bodyHeight / 2 - 2, 2, 0, Math.PI * 2);
    ctx.arc(6, -bodyHeight / 2 - 2, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1b263b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -bodyHeight / 2 + 6, 7, 0, Math.PI);
    ctx.stroke();

    ctx.fillStyle = '#9d4edd';
    ctx.fillRect(-bodyWidth / 2 + 2, bodyHeight / 2 - 4, bodyWidth / 2 - 2, 6);
    ctx.fillRect(2, bodyHeight / 2 - 4, bodyWidth / 2 - 2, 6);

    ctx.restore();
  }

  function draw(timestamp) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#001233');
    gradient.addColorStop(0.5, '#001845');
    gradient.addColorStop(1, '#001d3d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const stripeOffset = (timestamp / 35) % 40;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    for (let y = -stripeOffset; y < HEIGHT; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y + 30);
      ctx.stroke();
    }

    stairs.forEach((step) => {
      ctx.fillStyle = step.color;
      ctx.fillRect(step.x, step.y, step.width, step.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(step.x, step.y, step.width, 4);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(step.x, step.y + step.height - 4, step.width, 4);
    });

    drawKid();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, WIDTH, 70);

    ctx.fillStyle = '#f8f9fa';
    ctx.font = '600 20px "Noto Sans TC", "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`分數 ${score}`, 16, 16);

    ctx.font = '500 16px "Noto Sans TC", "Segoe UI", sans-serif';
    ctx.fillStyle = highlightBest && gameState === 'gameover' ? '#ffd166' : '#dee2e6';
    ctx.fillText(`最佳 ${bestScore}`, 16, 44);

    if (gameState === 'title' || gameState === 'gameover') {
      ctx.fillStyle = 'rgba(7, 14, 30, 0.6)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = '#f1f3f5';
      ctx.textAlign = 'center';

      if (gameState === 'title') {
        ctx.font = '700 34px "Noto Sans TC", "Segoe UI", sans-serif';
        ctx.fillText('小朋友下樓梯', WIDTH / 2, HEIGHT / 2 - 120);
        ctx.font = '500 20px "Noto Sans TC", "Segoe UI", sans-serif';
        ctx.fillText('按空白鍵或點擊開始', WIDTH / 2, HEIGHT / 2 - 60);
        ctx.font = '400 18px "Noto Sans TC", "Segoe UI", sans-serif';
        ctx.fillText('左右方向鍵 / A、D 移動', WIDTH / 2, HEIGHT / 2 - 20);
        ctx.fillText('手機上請點按畫面左右兩側', WIDTH / 2, HEIGHT / 2 + 12);
      } else {
        ctx.font = '700 38px "Noto Sans TC", "Segoe UI", sans-serif';
        ctx.fillText('摔下去了！', WIDTH / 2, HEIGHT / 2 - 100);
        ctx.font = '500 22px "Noto Sans TC", "Segoe UI", sans-serif';
        ctx.fillText(`本次得分：${score}`, WIDTH / 2, HEIGHT / 2 - 52);
        if (highlightBest) {
          ctx.fillStyle = '#ffd166';
          ctx.font = '500 18px "Noto Sans TC", "Segoe UI", sans-serif';
          ctx.fillText('創下新紀錄！', WIDTH / 2, HEIGHT / 2 - 18);
          ctx.fillStyle = '#f1f3f5';
        }
        ctx.font = '400 18px "Noto Sans TC", "Segoe UI", sans-serif';
        ctx.fillText('按空白鍵或點擊重新開始', WIDTH / 2, HEIGHT / 2 + 20);
      }
    }
  }

  function gameLoop(timestamp) {
    if (!lastTime) {
      lastTime = timestamp;
    }

    const delta = Math.min((timestamp - lastTime) / 1000, 0.05);

    if (gameState === 'running') {
      update(delta);
    }

    draw(timestamp);
    lastTime = timestamp;
    window.requestAnimationFrame(gameLoop);
  }

  function handlePointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (event.clientX - rect.left) * scaleX;

    controls.left = x < WIDTH / 2;
    controls.right = !controls.left;
  }

  document.addEventListener('keydown', (event) => {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        controls.left = true;
        event.preventDefault();
        break;
      case 'ArrowRight':
      case 'KeyD':
        controls.right = true;
        event.preventDefault();
        break;
      case 'Space':
      case 'Enter':
        event.preventDefault();
        handleStartRequest();
        break;
      case 'KeyR':
        if (gameState === 'gameover') {
          event.preventDefault();
          startGame();
        }
        break;
      default:
        break;
    }
  });

  document.addEventListener('keyup', (event) => {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        controls.left = false;
        event.preventDefault();
        break;
      case 'ArrowRight':
      case 'KeyD':
        controls.right = false;
        event.preventDefault();
        break;
      default:
        break;
    }
  });

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (gameState !== 'running') {
      handleStartRequest();
    }
    pointerActive = true;
    handlePointer(event);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!pointerActive) {
      return;
    }
    event.preventDefault();
    handlePointer(event);
  });

  function stopPointer() {
    pointerActive = false;
    controls.left = false;
    controls.right = false;
  }

  canvas.addEventListener('pointerup', (event) => {
    event.preventDefault();
    stopPointer();
  });

  canvas.addEventListener('pointercancel', (event) => {
    event.preventDefault();
    stopPointer();
  });

  canvas.addEventListener('pointerleave', stopPointer);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  window.addEventListener('blur', stopPointer);

  loadBestScore();
  resetState();
  window.requestAnimationFrame(gameLoop);
})();
