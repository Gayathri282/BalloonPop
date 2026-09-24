/**
 * Balloon Pop Dash - Child-Friendly Arcade Game Engine
 * Features: Web Audio synthesizer BGM & SFX, full-screen canvas playgrid,
 * level-up fanfares, cute animated character, and auto-pause on blur.
 */

(function () {
  "use strict";

  /* ==========================================
     Canvas & Responsive Viewport Setup
     ========================================== */
  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");

  var W = window.innerWidth;
  var H = window.innerHeight;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    W = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    H = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
  }
  window.addEventListener("resize", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }
  window.addEventListener("orientationchange", function () {
    setTimeout(resize, 150);
  });
  resize();

  /* ==========================================
     Audio Synthesizer (Web Audio API)
     ========================================== */
  var actx = null;
  var masterGain = null;
  var bgmGain = null;
  var bgmTimer = null;
  var bgmStep = 0;

  function initAudio() {
    if (!actx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        actx = new AC();

        masterGain = actx.createGain();
        masterGain.gain.value = 0.5;
        masterGain.connect(actx.destination);

        bgmGain = actx.createGain();
        bgmGain.gain.value = 0.18;
        bgmGain.connect(masterGain);
      } catch (e) {
        actx = null;
      }
    }
    if (actx && actx.state === "suspended") {
      actx.resume();
    }
  }

  function tone(o) {
    if (!actx) return;
    try {
      var t0 = actx.currentTime + (o.delay || 0);
      var osc = actx.createOscillator();
      var g = actx.createGain();
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(o.from, t0);
      if (o.to) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
      }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.15, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + o.dur + 0.03);
    } catch (e) {}
  }

  function noise(dur, vol, freq, q, type) {
    if (!actx) return;
    try {
      var n = Math.floor(actx.sampleRate * dur);
      var buf = actx.createBuffer(1, n, actx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) {
        d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      }
      var src = actx.createBufferSource();
      src.buffer = buf;
      var f = actx.createBiquadFilter();
      f.type = type || "bandpass";
      f.frequency.value = freq || 900;
      f.Q.value = q || 1;
      var g = actx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(masterGain);
      src.start();
    } catch (e) {}
  }

  // Cheerful looping background music melody notes (Hz)
  var BGM_NOTES = [
    523.25, 659.25, 784.00, 659.25, 587.33, 659.25, 698.46, 587.33,
    523.25, 659.25, 784.00, 880.00, 784.00, 659.25, 587.33, 523.25
  ];
  var BGM_BASS = [261.63, 261.63, 293.66, 293.66, 349.23, 349.23, 392.00, 392.00];

  function playBGMStep() {
    if (!actx || state !== STATE_PLAY) return;
    try {
      var note = BGM_NOTES[bgmStep % BGM_NOTES.length];
      var bass = BGM_BASS[Math.floor(bgmStep / 2) % BGM_BASS.length];

      var t0 = actx.currentTime;
      var osc = actx.createOscillator();
      var g = actx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(note, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      osc.connect(g);
      g.connect(bgmGain);
      osc.start(t0);
      osc.stop(t0 + 0.2);

      // Soft bass note on beat 0, 4, 8...
      if (bgmStep % 2 === 0) {
        var bOsc = actx.createOscillator();
        var bG = actx.createGain();
        bOsc.type = "sine";
        bOsc.frequency.setValueAtTime(bass, t0);
        bG.gain.setValueAtTime(0.0001, t0);
        bG.gain.exponentialRampToValueAtTime(0.12, t0 + 0.015);
        bG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
        bOsc.connect(bG);
        bG.connect(bgmGain);
        bOsc.start(t0);
        bOsc.stop(t0 + 0.28);
      }

      bgmStep++;
    } catch (e) {}
  }

  function startBGM() {
    stopBGM();
    bgmStep = 0;
    bgmTimer = setInterval(playBGMStep, 220);
  }

  function stopBGM() {
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
  }

  // Sound Effects Library
  var sfx = {
    pop: function () {
      noise(0.04, 0.09, 1800, 2);
      tone({ from: 520, to: 820, dur: 0.08, type: "sine", vol: 0.14 });
    },
    popGold: function () {
      tone({ from: 784, dur: 0.09, type: "square", vol: 0.12 });
      tone({ from: 1046, dur: 0.12, type: "sine", vol: 0.12, delay: 0.05 });
      tone({ from: 1318, dur: 0.18, type: "sine", vol: 0.1, delay: 0.1 });
    },
    popRainbow: function () {
      var scale = [523.25, 659.25, 784.00, 1046.50];
      for (var i = 0; i < scale.length; i++) {
        tone({ from: scale[i], dur: 0.12, type: "triangle", vol: 0.1, delay: i * 0.04 });
      }
    },
    levelUp: function () {
      var notes = [523.25, 659.25, 784.00, 1046.50, 1318.51];
      for (var i = 0; i < notes.length; i++) {
        tone({ from: notes[i], dur: 0.2, type: "triangle", vol: 0.15, delay: i * 0.07 });
      }
    },
    boom: function () {
      noise(0.25, 0.18, 280, 0.7);
      tone({ from: 220, to: 40, dur: 0.35, type: "sawtooth", vol: 0.15 });
    },
    gameOver: function () {
      var notes = [400, 350, 300, 220];
      for (var i = 0; i < notes.length; i++) {
        tone({ from: notes[i], dur: 0.2, type: "sawtooth", vol: 0.12, delay: i * 0.12 });
      }
    },
    click: function () {
      tone({ from: 600, to: 900, dur: 0.05, type: "sine", vol: 0.08 });
    }
  };

  /* ==========================================
     Game Constants & Palette
     ========================================== */
  var STATE_TITLE = 0;
  var STATE_PLAY = 1;
  var STATE_PAUSE = 2;
  var STATE_OVER = 3;
  var state = STATE_TITLE;

  var COLORS = [
    "#ff6f91", // Bubblegum Pink
    "#4ea8de", // Sky Blue
    "#70e000", // Mint Lime
    "#b5179e", // Soft Purple
    "#ff9e00"  // Sunny Orange
  ];

  /* ==========================================
     Game State Variables
     ========================================== */
  var balloons = [];
  var particles = [];
  var popups = [];
  var clouds = [];
  var score = 0;
  var lives = 3;
  var level = 1;
  var poppedCount = 0;
  var goldCount = 0;
  var bestScore = 0;
  var alive = true;
  var tclock = 0;
  var shake = 0;
  var spawnTimer = 0;
  var milestoneNext = 15;
  var flashRed = 0;
  var levelBannerT = 0;

  // Hero Character state
  var heroX = W / 2;
  var heroTargetX = W / 2;
  var heroDir = 1;
  var heroState = "idle"; // 'idle', 'cheer', 'hurt'
  var heroStateTimer = 0;

  try {
    bestScore = parseInt(localStorage.getItem("balloon_dash_best") || "0", 10) || 0;
  } catch (e) {}

  function initClouds() {
    clouds = [];
    for (var i = 0; i < 5; i++) {
      clouds.push({
        x: Math.random() * W,
        y: 40 + Math.random() * (H * 0.35),
        scale: 0.7 + Math.random() * 0.7,
        speed: 8 + Math.random() * 12
      });
    }
  }

  function resetGame() {
    balloons = [];
    particles = [];
    popups = [];
    score = 0;
    lives = 3;
    level = 1;
    poppedCount = 0;
    goldCount = 0;
    alive = true;
    tclock = 0;
    shake = 0;
    spawnTimer = 0.3;
    milestoneNext = 15;
    flashRed = 0;
    levelBannerT = 0;
    heroX = W / 2;
    heroTargetX = W / 2;
    heroState = "idle";
    initClouds();
    updateHUD();
  }

  /* ==========================================
     Spawning & Particles
     ========================================== */
  function burst(x, y, n, color, spread, power) {
    if (particles.length > 120) return;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.2832;
      var sp = Math.random() * power;
      particles.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.5,
        r: 3 + Math.random() * 4,
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
        color: color,
        isStar: Math.random() < 0.3
      });
    }
  }

  function spawnBalloon() {
    var bombProb = Math.min(0.3, 0.12 + level * 0.03);
    var goldProb = 0.1;
    var rainbowProb = 0.07;
    var r = Math.random();

    var type = "normal";
    if (r < bombProb) type = "bomb";
    else if (r < bombProb + goldProb) type = "gold";
    else if (r < bombProb + goldProb + rainbowProb) type = "rainbow";

    var radius = type === "gold" ? 28 : type === "bomb" ? 24 : 26;

    balloons.push({
      type: type,
      x: 35 + Math.random() * (W - 70),
      y: H + 40,
      r: radius,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      sway: Math.random() * 6.28,
      swaySpeed: 1 + Math.random() * 1.2,
      speedMult: 0.9 + Math.random() * 0.3,
      popT: 0,
      popping: false
    });
  }

  /* ==========================================
     Gameplay Interactions
     ========================================== */
  function tapAt(x, y) {
    if (state !== STATE_PLAY || !alive) return;

    // Small touch sparkle indicator
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      r: 4,
      life: 0.6,
      decay: 0.05,
      color: "#ffffff"
    });

    var bestTarget = null;
    var bestD = Infinity;

    // Generous touch hitbox radius (b.r + 26) for hyper touch sensitivity
    for (var i = 0; i < balloons.length; i++) {
      var b = balloons[i];
      if (b.popping) continue;
      var dx = x - b.x;
      var dy = y - b.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < b.r + 26 && d < bestD) {
        bestD = d;
        bestTarget = b;
      }
    }

    if (!bestTarget) return;

    bestTarget.popping = true;
    bestTarget.popT = 1;
    heroTargetX = bestTarget.x;
    if (bestTarget.x > heroX) heroDir = 1;
    else heroDir = -1;

    if (bestTarget.type === "normal") {
      score += 1;
      poppedCount++;
      sfx.pop();
      burst(bestTarget.x, bestTarget.y, 14, bestTarget.color, bestTarget.r * 1.2, 3.5);
      popups.push({ x: bestTarget.x, y: bestTarget.y - 10, life: 1, text: "+1", color: "#ffffff" });
      triggerHeroState("cheer", 0.4);
    } else if (bestTarget.type === "gold") {
      score += 5;
      poppedCount++;
      goldCount++;
      sfx.popGold();
      burst(bestTarget.x, bestTarget.y, 22, "#ffda3d", bestTarget.r * 1.4, 4.5);
      popups.push({ x: bestTarget.x, y: bestTarget.y - 10, life: 1, text: "+5 GOLD!", color: "#ffee58" });
      triggerHeroState("cheer", 0.6);
    } else if (bestTarget.type === "rainbow") {
      score += 3;
      poppedCount++;
      sfx.popRainbow();
      burst(bestTarget.x, bestTarget.y, 24, "#ff70a6", bestTarget.r * 1.5, 4.2);
      popups.push({ x: bestTarget.x, y: bestTarget.y - 10, life: 1, text: "+3 RAINBOW!", color: "#b5179e" });
      triggerHeroState("cheer", 0.5);
    } else if (bestTarget.type === "bomb") {
      lives--;
      sfx.boom();
      shake = Math.max(shake, 0.8);
      flashRed = 1;
      burst(bestTarget.x, bestTarget.y, 28, "#ff4d6d", bestTarget.r * 1.8, 5.0);
      popups.push({ x: bestTarget.x, y: bestTarget.y - 10, life: 1, text: "-1 LIFE!", color: "#ff4d6d" });
      triggerHeroState("hurt", 0.8);

      if (lives <= 0) {
        gameOver();
        return;
      }
    }

    // Check Level Progression
    if (score >= milestoneNext) {
      level++;
      milestoneNext += 15 + level * 5;
      levelBannerT = 1.8;
      sfx.levelUp();
      burst(W / 2, H * 0.35, 36, "#ffe566", W * 0.5, 6.0);
    }

    updateHUD();
  }

  function triggerHeroState(st, dur) {
    heroState = st;
    heroStateTimer = dur;
  }

  /* ==========================================
     Update Engine Step
     ========================================== */
  function update(dt) {
    tclock += dt;

    if (levelBannerT > 0) {
      levelBannerT -= dt;
    }

    // Hero Character position smoothing
    heroX += (heroTargetX - heroX) * 6 * dt;
    if (heroStateTimer > 0) {
      heroStateTimer -= dt;
      if (heroStateTimer <= 0) heroState = "idle";
    }

    // Cloud movements
    for (var c = 0; c < clouds.length; c++) {
      clouds[c].x += clouds[c].speed * dt;
      if (clouds[c].x > W + 80) clouds[c].x = -80;
    }

    if (state !== STATE_PLAY) return;

    var riseSpeed = 70 + Math.min(220, score * 1.5 + level * 15);

    // Spawning timer
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnBalloon();
      spawnTimer = Math.max(0.3, 0.95 - level * 0.08);
    }

    // Update Balloons
    for (var i = balloons.length - 1; i >= 0; i--) {
      var b = balloons[i];
      if (b.popping) {
        b.popT -= 6 * dt;
        if (b.popT <= 0) balloons.splice(i, 1);
        continue;
      }
      b.y -= riseSpeed * b.speedMult * dt;
      b.x += Math.sin(tclock * b.swaySpeed + b.sway) * 14 * dt;

      if (b.y < -70) {
        balloons.splice(i, 1);
      }
    }

    // Update Particles
    for (var p = particles.length - 1; p >= 0; p--) {
      var pt = particles[p];
      pt.x += pt.vx * dt * 60;
      pt.y += pt.vy * dt * 60;
      pt.vy += 0.22 * dt * 60 * 0.02;
      pt.life -= pt.decay * dt * 60;
      if (pt.life <= 0) particles.splice(p, 1);
    }

    // Update Popups
    for (var u = popups.length - 1; u >= 0; u--) {
      popups[u].y -= 1.2 * dt * 60;
      popups[u].life -= 0.022 * dt * 60;
      if (popups[u].life <= 0) popups.splice(u, 1);
    }

    if (shake > 0) shake = Math.max(0, shake - 2.5 * dt);
    if (flashRed > 0) flashRed = Math.max(0, flashRed - 2.2 * dt);
  }

  /* ==========================================
     Canvas Renderers & Drawings
     ========================================== */
  function drawBackground() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#7fd4f5");
    grad.addColorStop(0.5, "#5fc4f0");
    grad.addColorStop(1, "#3f9fd6");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Cute Sun
    ctx.save();
    ctx.fillStyle = "#fff3b0";
    ctx.beginPath();
    ctx.arc(W - 60, 70, 36, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = "#ffe566";
    ctx.beginPath();
    ctx.arc(W - 60, 70, 28, 0, 6.2832);
    ctx.fill();
    ctx.restore();

    // Floating Clouds
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (var c = 0; c < clouds.length; c++) {
      var cl = clouds[c];
      ctx.save();
      ctx.translate(cl.x, cl.y);
      ctx.scale(cl.scale, cl.scale);
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, 6.2832);
      ctx.arc(20, -6, 20, 0, 6.2832);
      ctx.arc(-20, -2, 18, 0, 6.2832);
      ctx.arc(36, 4, 15, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    }

    // Grassy Hills & Ground
    ctx.fillStyle = "#70e000";
    ctx.beginPath();
    ctx.ellipse(W * 0.3, H - 10, W * 0.45, 45, 0, 0, 6.2832);
    ctx.ellipse(W * 0.8, H - 5, W * 0.4, 40, 0, 0, 6.2832);
    ctx.fill();

    ctx.fillStyle = "#38b000";
    ctx.fillRect(0, H - 35, W, 35);
    ctx.fillStyle = "#9ef01a";
    ctx.fillRect(0, H - 35, W, 6);
  }

  function drawHeroCharacter() {
    ctx.save();
    ctx.translate(heroX, H - 36);

    // Bouncing walking motion
    var bounce = Math.sin(tclock * 10) * 4;
    if (heroState === "cheer") bounce = Math.sin(tclock * 22) * 12;

    ctx.translate(0, -bounce);
    ctx.scale(heroDir, 1);

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(0, 18 + bounce * 0.5, 20, 6, 0, 0, 6.2832);
    ctx.fill();

    // Bunny Ears
    ctx.fillStyle = "#ffb5a7";
    ctx.beginPath();
    ctx.ellipse(-10, -48, 6, 16, -0.1, 0, 6.2832);
    ctx.ellipse(10, -48, 6, 16, 0.1, 0, 6.2832);
    ctx.fill();
    ctx.fillStyle = "#fcd5ce";
    ctx.beginPath();
    ctx.ellipse(-10, -48, 3, 10, -0.1, 0, 6.2832);
    ctx.ellipse(10, -48, 3, 10, 0.1, 0, 6.2832);
    ctx.fill();

    // Body
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(0, -10, 18, 16, 0, 0, 6.2832);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0, -28, 18, 0, 6.2832);
    ctx.fill();

    // Rosy Cheeks
    ctx.fillStyle = "#ff85a1";
    ctx.beginPath();
    ctx.arc(-11, -25, 4, 0, 6.2832);
    ctx.arc(11, -25, 4, 0, 6.2832);
    ctx.fill();

    // Expressive Eyes
    ctx.fillStyle = "#2b2d42";
    if (heroState === "hurt") {
      // Spiral / Dizzy Eyes
      ctx.strokeStyle = "#2b2d42";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-9, -31); ctx.lineTo(-3, -25);
      ctx.moveTo(-3, -31); ctx.lineTo(-9, -25);
      ctx.moveTo(3, -31); ctx.lineTo(9, -25);
      ctx.moveTo(9, -31); ctx.lineTo(3, -25);
      ctx.stroke();
    } else if (heroState === "cheer") {
      // Happy ^ ^ Eyes
      ctx.strokeStyle = "#2b2d42";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-9, -27); ctx.lineTo(-6, -31); ctx.lineTo(-3, -27);
      ctx.moveTo(3, -27); ctx.lineTo(6, -31); ctx.lineTo(9, -27);
      ctx.stroke();
    } else {
      // Big Cute Cartoon Eyes
      ctx.beginPath();
      ctx.arc(-6, -28, 3.5, 0, 6.2832);
      ctx.arc(6, -28, 3.5, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-7, -29, 1.2, 0, 6.2832);
      ctx.arc(5, -29, 1.2, 0, 6.2832);
      ctx.fill();
    }

    // Cute Smile Nose
    ctx.fillStyle = "#ff70a6";
    ctx.beginPath();
    ctx.arc(0, -24, 2, 0, 6.2832);
    ctx.fill();

    ctx.restore();
  }

  function drawBalloon(b) {
    var scaleVal = b.popping ? Math.max(0, b.popT) : 1;
    if (b.popping && b.popT > 0.5) scaleVal = 1 + (1 - b.popT) * 0.8;
    var alphaVal = b.popping ? Math.max(0, b.popT) : 1;

    ctx.save();
    ctx.globalAlpha = alphaVal;
    ctx.translate(b.x, b.y);
    ctx.scale(scaleVal, scaleVal);

    if (b.type === "bomb") {
      // Bomb Fuse
      ctx.strokeStyle = "#ff9e00";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -b.r);
      ctx.quadraticCurveTo(8, -b.r - 12, 4, -b.r - 18);
      ctx.stroke();

      // Sparkle
      ctx.fillStyle = "#ffee58";
      ctx.beginPath();
      ctx.arc(4, -b.r - 18, 3 + Math.sin(tclock * 25) * 1.5, 0, 6.2832);
      ctx.fill();

      // Bomb Body
      var bg = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.3, 2, 0, 0, b.r);
      bg.addColorStop(0, "#495057");
      bg.addColorStop(1, "#212529");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, 6.2832);
      ctx.fill();

      // Funny Grumpy Eyes
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(-6, -4, 4, 0, 6.2832);
      ctx.arc(6, -4, 4, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = "#ff4d6d";
      ctx.beginPath();
      ctx.arc(-5, -4, 2, 0, 6.2832);
      ctx.arc(5, -4, 2, 0, 6.2832);
      ctx.fill();
    } else {
      // Glossy Color Balloon
      var mainColor = b.color;
      if (b.type === "gold") mainColor = "#ffda3d";
      if (b.type === "rainbow") mainColor = "hsl(" + (tclock * 120 % 360) + ", 90%, 65%)";

      var g = ctx.createRadialGradient(-b.r * 0.35, -b.r * 0.35, 2, 0, 0, b.r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, mainColor);
      g.addColorStop(1, mainColor);

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 0.9, b.r, 0, 0, 6.2832);
      ctx.fill();

      // String Tie
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.moveTo(-4, b.r - 1);
      ctx.lineTo(4, b.r - 1);
      ctx.lineTo(0, b.r + 7);
      ctx.closePath();
      ctx.fill();

      // String Wave
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, b.r + 7);
      ctx.quadraticCurveTo(8, b.r + 18, 0, b.r + 28);
      ctx.stroke();

      // Cute Smile Face on Balloon!
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(-6, -4, 2.5, 0, 6.2832);
      ctx.arc(6, -4, 2.5, 0, 6.2832);
      ctx.fill();

      // Smile mouth
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, -2, 5, 0.1, 3.04);
      ctx.stroke();

      // Gold Crown for Gold Balloons
      if (b.type === "gold") {
        ctx.fillStyle = "#ffe566";
        ctx.beginPath();
        ctx.moveTo(-10, -b.r + 2);
        ctx.lineTo(-12, -b.r - 10);
        ctx.lineTo(-4, -b.r - 4);
        ctx.lineTo(0, -b.r - 12);
        ctx.lineTo(4, -b.r - 4);
        ctx.lineTo(12, -b.r - 10);
        ctx.lineTo(10, -b.r + 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Screen Shake effect offset
    var sx = (Math.random() - 0.5) * shake * 12;
    var sy = (Math.random() - 0.5) * shake * 12;
    ctx.translate(sx, sy);

    drawBackground();

    // Draw Balloons
    for (var i = 0; i < balloons.length; i++) {
      drawBalloon(balloons[i]);
    }

    // Draw Hero Character
    drawHeroCharacter();

    // Draw Particles
    for (var p = 0; p < particles.length; p++) {
      var pt = particles[p];
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r * pt.life, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw Floating Text Popups
    ctx.textAlign = "center";
    ctx.font = "800 20px Fredoka, sans-serif";
    for (var u = 0; u < popups.length; u++) {
      ctx.globalAlpha = Math.max(0, popups[u].life);
      ctx.fillStyle = popups[u].color;
      ctx.fillText(popups[u].text, popups[u].x, popups[u].y);
    }
    ctx.globalAlpha = 1;

    // Flash Red on Damage
    if (flashRed > 0) {
      ctx.fillStyle = "rgba(255, 77, 109, " + flashRed * 0.3 + ")";
      ctx.fillRect(0, 0, W, H);
    }

    // Level Up Floating Banner Announcement
    if (levelBannerT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, levelBannerT);
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.shadowColor = "rgba(0,0,0,0.15)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(W / 2 - 130, H * 0.28 - 25, 260, 50, 25);
      ctx.fill();

      ctx.fillStyle = "#ff477e";
      ctx.font = "800 24px Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🎉 LEVEL " + level + " UP!", W / 2, H * 0.28 + 8);
      ctx.restore();
    }
  }

  /* ==========================================
     Main Game Loop
     ========================================== */
  var lastTs = 0;
  function gameLoop(ts) {
    requestAnimationFrame(gameLoop);
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    update(dt);
    render();
  }

  /* ==========================================
     HUD & UI Controls
     ========================================== */
  var titleEl = document.getElementById("title");
  var overEl = document.getElementById("over");
  var pauseEl = document.getElementById("pause");
  var hudEl = document.getElementById("hud");

  var hudScore = document.getElementById("hudScore");
  var levelBadge = document.getElementById("levelBadge");
  var livesContainer = document.getElementById("livesContainer");

  var finalScoreEl = document.getElementById("finalScore");
  var statPoppedEl = document.getElementById("statPopped");
  var statGoldEl = document.getElementById("statGold");
  var statLevelEl = document.getElementById("statLevel");
  var bestBadgeEl = document.getElementById("bestBadge");

  function updateHUD() {
    hudScore.textContent = score;
    levelBadge.textContent = "LVL " + level;

    // Render hearts
    var heartsHTML = "";
    for (var i = 0; i < 3; i++) {
      var isLost = i >= lives ? " lost" : "";
      heartsHTML += '<span class="heart-icon' + isLost + '">❤️</span>';
    }
    livesContainer.innerHTML = heartsHTML;
  }

  function startGame() {
    initAudio();
    resetGame();
    state = STATE_PLAY;
    titleEl.classList.add("hidden");
    overEl.classList.add("hidden");
    pauseEl.classList.add("hidden");
    hudEl.classList.remove("hidden");
    startBGM();
  }

  function pauseGame() {
    if (state !== STATE_PLAY) return;
    state = STATE_PAUSE;
    stopBGM();
    pauseEl.classList.remove("hidden");
  }

  function resumeGame() {
    if (state !== STATE_PAUSE) return;
    initAudio();
    state = STATE_PLAY;
    pauseEl.classList.add("hidden");
    startBGM();
  }

  function gameOver() {
    state = STATE_OVER;
    alive = false;
    stopBGM();
    sfx.gameOver();

    if (score > bestScore) {
      bestScore = score;
      try {
        localStorage.setItem("balloon_dash_best", String(bestScore));
      } catch (e) {}
    }

    finalScoreEl.textContent = score;
    statPoppedEl.textContent = poppedCount;
    statGoldEl.textContent = goldCount;
    statLevelEl.textContent = level;
    bestBadgeEl.textContent = "👑 Best: " + bestScore;

    hudEl.classList.add("hidden");
    overEl.classList.remove("hidden");
  }

  /* ==========================================
     Event Listeners
     ========================================== */
  document.getElementById("startBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    sfx.click();
    startGame();
  });

  document.getElementById("againBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    sfx.click();
    startGame();
  });

  document.getElementById("pauseBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    sfx.click();
    pauseGame();
  });

  document.getElementById("resumeBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    sfx.click();
    resumeGame();
  });

  document.getElementById("restartBtn").addEventListener("click", function (e) {
    e.stopPropagation();
    sfx.click();
    startGame();
  });

  // High-Sensitivity Touch & Pointer Handling
  function handleTouchPoint(clientX, clientY) {
    initAudio();
    if (state === STATE_PLAY) {
      tapAt(clientX, clientY);
    }
  }

  // Touch Start (Instant Multi-Touch response)
  canvas.addEventListener("touchstart", function (e) {
    e.preventDefault();
    initAudio();
    var touches = e.changedTouches || e.touches;
    for (var i = 0; i < touches.length; i++) {
      handleTouchPoint(touches[i].clientX, touches[i].clientY);
    }
  }, { passive: false });

  // Touch Move (Slide finger across balloons to pop!)
  canvas.addEventListener("touchmove", function (e) {
    e.preventDefault();
    if (state !== STATE_PLAY) return;
    var touches = e.touches;
    for (var i = 0; i < touches.length; i++) {
      handleTouchPoint(touches[i].clientX, touches[i].clientY);
    }
  }, { passive: false });

  // Fallback Pointer Events for Mouse / Stylus
  canvas.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "touch") {
      handleTouchPoint(e.clientX, e.clientY);
    }
  });

  canvas.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "touch" && e.buttons === 1) {
      handleTouchPoint(e.clientX, e.clientY);
    }
  });

  // Keyboard controls (Space / Esc)
  window.addEventListener("keydown", function (e) {
    if (e.key === " " || e.key === "Enter") {
      if (state === STATE_TITLE || state === STATE_OVER) startGame();
      else if (state === STATE_PAUSE) resumeGame();
    } else if (e.key === "Escape") {
      if (state === STATE_PLAY) pauseGame();
      else if (state === STATE_PAUSE) resumeGame();
    }
  });

  // Auto-pause when tab is hidden or window blurs/closes
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && state === STATE_PLAY) {
      pauseGame();
    }
  });

  window.addEventListener("blur", function () {
    if (state === STATE_PLAY) {
      pauseGame();
    }
  });

  window.addEventListener("contextmenu", function (e) {
    e.preventDefault();
  });

  /* Boot Game Engine */
  resetGame();
  requestAnimationFrame(gameLoop);
})();
