'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Audio (WebAudio sintetizado, sin archivos externos) ─────────────────────────
const audio = {
  ctx: null,
  master: null,
  enabled: true,
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
  },
  beep({ freq = 440, type = 'square', dur = 0.1, vol = 1, slide = 0 } = {}) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.01);
  },
  noise({ dur = 0.2, vol = 0.4, lp = 1000 } = {}) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.01);
  },
};

const sfx = {
  shoot()       { audio.beep({ freq: 880,  type: 'square',   dur: 0.06, vol: 0.15 }); },
  shootTriple() { audio.beep({ freq: 1100, type: 'square',   dur: 0.05, vol: 0.18, slide: 400 }); },
  enemyShoot()  { audio.beep({ freq: 220,  type: 'sawtooth', dur: 0.12, vol: 0.18, slide: -80 }); },
  hit(size)     { audio.beep({ freq: 220 - size * 40, type: 'square', dur: 0.08, vol: 0.2 }); },
  explode(s)    { audio.noise({ dur: 0.18 + s * 0.05, vol: 0.35, lp: 700 - s * 120 }); },
  ufoDie()      { audio.noise({ dur: 0.4,  vol: 0.4,  lp: 800 }); },
  powerup()     { audio.beep({ freq: 600,  type: 'triangle', dur: 0.15, vol: 0.2, slide: 800 }); },
  shield()      { audio.beep({ freq: 800,  type: 'sine',     dur: 0.25, vol: 0.2, slide: -200 }); },
  shieldBlock() { audio.beep({ freq: 400,  type: 'square',   dur: 0.1,  vol: 0.2 }); },
  death()       { audio.noise({ dur: 0.7,  vol: 0.5,  lp: 300 }); },
  respawn()     { audio.beep({ freq: 300,  type: 'sine',     dur: 0.2,  vol: 0.2, slide: 600 }); },
  levelUp()     { audio.beep({ freq: 440, type: 'square', dur: 0.12, vol: 0.2, slide: 600 });
                  setTimeout(() => audio.beep({ freq: 660, type: 'square', dur: 0.15, vol: 0.2, slide: 800 }), 100); },
  skin()        { audio.beep({ freq: 1200, type: 'sine',     dur: 0.08, vol: 0.15, slide: -400 }); },
  tripleOn()    { audio.beep({ freq: 500,  type: 'triangle', dur: 0.2,  vol: 0.2, slide: 800 }); },
  gameOver()    { audio.beep({ freq: 300,  type: 'sawtooth', dur: 0.4,  vol: 0.3, slide: -200 }); },
  hyperspace()  { audio.beep({ freq: 1400, type: 'sawtooth', dur: 0.18, vol: 0.18, slide: -1200 });
                  audio.noise({ dur: 0.08, vol: 0.12, lp: 3000 }); },
  pause()       { audio.beep({ freq: 440,  type: 'square',   dur: 0.06, vol: 0.15, slide: -120 }); },
  resume()      { audio.beep({ freq: 440,  type: 'square',   dur: 0.06, vol: 0.15, slide:  120 }); },
  newRecord()   { audio.beep({ freq: 523,  type: 'square',   dur: 0.10, vol: 0.18 });
                  setTimeout(() => audio.beep({ freq: 659, type: 'square', dur: 0.10, vol: 0.18 }), 100);
                  setTimeout(() => audio.beep({ freq: 784, type: 'square', dur: 0.10, vol: 0.18 }), 200);
                  setTimeout(() => audio.beep({ freq: 1046,type: 'square',   dur: 0.20, vol: 0.20 }), 300); },
};

// ── Música chiptune sintetizada ───────────────────────────────────────────────
// Patrón de 32 semicorcheas a 100 BPM (paso = 0.15s, compás = 4.8s).
// Cada entrada es [lead Hz, bajo Hz]; 0 = silencio.
const MUSIC = [
  [293.66, 73.42], [   0,    0], [293.66,    0], [   0,    0],
  [349.23,    0], [   0,    0], [293.66,    0], [   0,    0],
  [440.00, 73.42], [   0,    0], [349.23,    0], [   0,    0],
  [293.66,    0], [   0,    0], [261.63,    0], [   0,    0],
  [293.66, 73.42], [   0,    0], [293.66,    0], [   0,    0],
  [349.23,    0], [   0,    0], [293.66,    0], [   0,    0],
  [392.00, 73.42], [   0,    0], [349.23,    0], [   0,    0],
  [293.66,    0], [   0,    0], [466.16,    0], [   0,    0],
];

const MUSIC_STEP = 60 / 100 / 4; // 0.15s por semicorchea

const music = {
  gain: null,
  interval: null,
  stepIdx: 0,
  nextTime: 0,

  ensureBus() {
    if (this.gain || !audio.ctx) return;
    this.gain = audio.ctx.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(audio.master);
  },

  start() {
    if (this.interval) return;
    this.ensureBus();
    if (!audio.ctx) return;
    this.stepIdx = 0;
    this.nextTime = audio.ctx.currentTime + 0.15;
    this.tick();
    this.interval = setInterval(() => this.tick(), 25);
  },

  stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  },

  tick() {
    if (!audio.ctx || !audio.enabled) return;
    while (this.nextTime < audio.ctx.currentTime + 0.1) {
      this.scheduleStep(this.stepIdx, this.nextTime);
      this.stepIdx = (this.stepIdx + 1) % MUSIC.length;
      this.nextTime += MUSIC_STEP;
    }
  },

  scheduleStep(idx, when) {
    const [lead, bass] = MUSIC[idx];
    if (lead > 0) {
      const o = audio.ctx.createOscillator();
      const f = audio.ctx.createBiquadFilter();
      const g = audio.ctx.createGain();
      f.type = 'lowpass';
      f.frequency.value = 1500;
      o.type = 'square';
      o.frequency.value = lead;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.05, when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);
      o.connect(f).connect(g).connect(this.gain);
      o.start(when); o.stop(when + 0.14);
    }
    if (bass > 0) {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = bass;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.06, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.45);
      o.connect(g).connect(this.gain);
      o.start(when); o.stop(when + 0.46);
    }
  },
};

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  audio.init();
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Fondo de estrellas (paralaje en 3 capas) ──────────────────────────────────
// Lejana: muchas, pequeñas, lentas, tenues.   Media y cercana: menos, más rápidas.
// Todas avanzan hacia abajo; cuando la nave acelera, la capa cercana se acelera
// más, dando sensación de velocidad.
const STAR_LAYERS = [
  { count:  90, speed:  18, r: 0.7, b: 0.30, thrustMul: 1.0 },
  { count:  55, speed:  48, r: 1.0, b: 0.55, thrustMul: 1.25 },
  { count:  25, speed: 110, r: 1.4, b: 0.85, thrustMul: 1.55 },
];

let stars = [];

function makeStars() {
  stars = [];
  for (const L of STAR_LAYERS) {
    for (let i = 0; i < L.count; i++) {
      stars.push({
        x:  Math.random() * W,
        y:  Math.random() * H,
        vx: rand(-3, 3),
        vy: L.speed + rand(-L.speed * 0.2, L.speed * 0.2),
        r:  L.r,
        b:  L.b,
        tm: L.thrustMul,
        tw: Math.random() * Math.PI * 2,
        tws: rand(1.5, 4),
      });
    }
  }
}

function updateStars(dt) {
  const boost = (ship && !ship.dead && ship.thrusting) ? 1.4 : 1;
  for (const s of stars) {
    const m = boost > 1 ? s.tm : 1;
    s.x = wrap(s.x + s.vx * dt, W);
    s.y = wrap(s.y + s.vy * m * dt, H);
  }
}

let _starsTime = 0;
function drawStars() {
  _starsTime += 1 / 60; // aproximación; el twinkle no necesita ser exacto
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    const tw = s.b * (0.7 + 0.3 * Math.sin(_starsTime * s.tws + s.tw));
    if (tw < 0.05) continue;
    ctx.globalAlpha = tw;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Proyectil enemigo ────────────────────────────────────────────────────────
class EnemyBullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 320;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl    = 1.5;
    this.radius = 3;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = 'rgba(255, 90, 74, 0.35)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// ── Power-up de velocidad ────────────────────────────────────────────────────
const POWERUP_CHANCE        = 0.15;   // probabilidad de drop por asteroide destruido
const POWERUP_TTL           = 10;     // segundos que vive el drop en pantalla
const SPEED_BOOST_DURATION  = 5;      // segundos que dura el efecto (2x THRUST)

// ── Habilidad: triple shot (activada por el jugador) ─────────────────────────
const TRIPLE_SHOT_DURATION  = 5;      // segundos activo disparando 3 balas en abanico
const TRIPLE_SHOT_COOLDOWN  = 20;     // segundos de recarga entre activaciones

// ── Estrella fugaz ───────────────────────────────────────────────────────────
const STAR_CHANCE  = 0.6;    // probabilidad de spawn por nivel iniciado
const STAR_SPEED   = 300;    // px/s (vs 32–85 de los normales)
const STAR_TTL     = 8;      // segundos de vida; se funde en los últimos 2
const STAR_POINTS  = 150;    // puntos por fragmento

// ── Power-up de escudo ───────────────────────────────────────────────────────
const SHIELD_CHANCE  = 0.10;  // probabilidad de drop por asteroide (excluyente con boost)
const SHIELD_CHARGES = 3;     // impactos que absorbe antes de agotarse

// ── OVNI enemigo ─────────────────────────────────────────────────────────────
const UFO_SPAWN_MIN = 8;      // segundos mínimos entre spawns
const UFO_SPAWN_MAX = 14;     // segundos máximos entre spawns
const UFO_SPEED     = 140;    // px/s
const UFO_RADIUS    = 18;     // radio de colisión / dibujo
const UFO_FIRE_MIN  = 1.2;    // segundos mínimos entre disparos
const UFO_FIRE_MAX  = 1.8;
const UFO_POINTS    = 200;

class Asteroid {
  constructor(x, y, size = 3, star = false) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;
    this.expired = false;        // se fue por TTL (para distinguir al filtrar)

    // Estado "estrella fugaz": rápida, temporal, hereda al partirse
    this.star = star;
    this.ttl  = star ? STAR_TTL : null;

    const angle = rand(0, Math.PI * 2);
    const base  = star ? STAR_SPEED : SPEEDS[size];
    const speed = base + (star ? rand(-30, 30) : rand(-15, 15));
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  // Estrella fugaz que cruza la pantalla: entra desde un borde al azar,
  // tamaño grande (pero a mitad de radio visual) y dirección aleatoria.
  static star() {
    const edge = randInt(0, 3);
    let x, y;
    const HALF_R = RADII[3] / 2;   // 25 — radio visual a la mitad
    switch (edge) {
      case 0: x = rand(0, W); y = -HALF_R; break;   // arriba
      case 1: x = W + HALF_R; y = rand(0, H); break; // derecha
      case 2: x = rand(0, W); y = H + HALF_R; break; // abajo
      case 3: x = -HALF_R; y = rand(0, H); break;   // izquierda
    }
    // Ajuste para que el wrap la ponga al otro lado en el primer frame
    x = wrap(x, W);
    y = wrap(y, H);
    const a = new Asteroid(x, y, 3, true);
    a.radius = HALF_R;   // mitad de tamaño; sigue partiendo como un grande
    // Fuerza dirección hacia el interior de la pantalla
    const dx = W / 2 - a.x;
    const dy = H / 2 - a.y;
    const ang = Math.atan2(dy, dx) + rand(-0.6, 0.6);
    a.vx = Math.cos(ang) * STAR_SPEED;
    a.vy = Math.sin(ang) * STAR_SPEED;
    return a;
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;

    if (this.star) {
      this.ttl -= dt;
      if (this.ttl <= 0) {
        this.dead    = true;
        this.expired = true;
      }
    }
  }

  split() {
    if (this.size <= 1) return [];
    // Las estrellas fugaces heredan su estado a los fragmentos
    const children = [
      new Asteroid(this.x, this.y, this.size - 1, this.star),
      new Asteroid(this.x, this.y, this.size - 1, this.star),
    ];
    // Si el padre era una estrella, los hijos conservan la mitad de su radio
    if (this.star) children.forEach(c => c.radius = this.radius / 2);
    return children;
  }

  draw() {
    if (this.star) { this.drawStar(); return; }
    this.drawRock();
  }

  // Asteroide normal: polígono irregular blanco
  drawRock() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Estrella fugaz: pequeño sol con estela cónica, halo, rayos y fade-out
  drawStar() {
    const fade  = Math.max(0, Math.min(1, this.ttl / 2));   // 0..1
    const speed = Math.hypot(this.vx, this.vy) || 1;
    const ux    = this.vx / speed;
    const uy    = this.vy / speed;                            // dirección del movimiento
    const px    = -uy;   // perpendicular (rotación -90°)
    const py    =  ux;

    const r     = this.radius;
    const tail  = r * 2.6;                                    // longitud de la punta
    const halfW = r * 0.85;                                   // semiancho de la base

    const tipX   = this.x - ux * tail;
    const tipY   = this.y - uy * tail;
    const baseLX = this.x - ux * 0.25 * r + px * halfW;
    const baseLY = this.y - uy * 0.25 * r + py * halfW;
    const baseRX = this.x - ux * 0.25 * r - px * halfW;
    const baseRY = this.y - uy * 0.25 * r - py * halfW;

    // 1) Estela cónica (degradado hacia el borde)
    {
      const g = ctx.createLinearGradient(this.x, this.y, tipX, tipY);
      g.addColorStop(0, `rgba(255, 240, 190, ${0.85 * fade})`);
      g.addColorStop(0.4, `rgba(255, 210, 120, ${0.35 * fade})`);
      g.addColorStop(1, 'rgba(255, 180, 70, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(baseLX, baseLY);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(baseRX, baseRY);
      ctx.closePath();
      ctx.fill();

      // Línea central brillante (núcleo de la estela)
      ctx.strokeStyle = `rgba(255, 250, 230, ${0.9 * fade})`;
      ctx.lineWidth   = 3;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - ux * r * 1.6, this.y - uy * r * 1.6);
      ctx.stroke();
    }

    // 2) Halo exterior
    {
      const haloR = r * 1.9;
      const g = ctx.createRadialGradient(this.x, this.y, r * 0.6,
                                         this.x, this.y, haloR);
      g.addColorStop(0, `rgba(255, 220, 120, ${0.35 * fade})`);
      g.addColorStop(1, 'rgba(255, 220, 120, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, haloR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3) Rayos (8 cortos radiantes, rotan con la pieza)
    {
      const rayLen = r * 0.55;
      ctx.strokeStyle = `rgba(255, 210, 122, ${0.8 * fade})`;
      ctx.lineWidth   = 1.5;
      ctx.lineCap     = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + this.rot;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(a) * (r * 0.95),
                   this.y + Math.sin(a) * (r * 0.95));
        ctx.lineTo(this.x + Math.cos(a) * (r + rayLen),
                   this.y + Math.sin(a) * (r + rayLen));
        ctx.stroke();
      }
    }

    // 4) Núcleo del sol (gradiente radial, blanco-crema → amarillo → naranja)
    {
      const g = ctx.createRadialGradient(this.x, this.y, 0,
                                         this.x, this.y, r);
      g.addColorStop(0,    `rgba(255, 253, 235, ${fade})`);
      g.addColorStop(0.45, `rgba(255, 226, 122, ${fade})`);
      g.addColorStop(1,    `rgba(255, 179, 71,  ${fade})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Anillo sutil en el borde
      ctx.strokeStyle = `rgba(255, 200, 90, ${0.7 * fade})`;
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
  }
}

// ── Skins ──────────────────────────────────────────────────────────────────────
const SKINS = [
  { id: 'classic', name: 'Clásica',
    stroke: '#fff',    boost: '#ffc24b', thrust: 'rgba(255,130,0,0.85)',
    hull: [[ 20,  0], [-12, -9], [ -7,  0], [-12,  9]],
    cockpit: null },
  { id: 'dart', name: 'Dardo',
    stroke: '#5cf2ff', boost: '#ffec4b', thrust: 'rgba(120,220,255,0.85)',
    hull: [[ 22,  0], [-14, -5], [ -8, -1], [ -8,  1], [-14,  5]],
    cockpit: 'dot', cockpitOffset: [6, 0], cockpitRadius: 2 },
  { id: 'delta', name: 'Delta',
    stroke: '#7cff7a', boost: '#ffd24b', thrust: 'rgba(160,255,140,0.85)',
    hull: [[ 22,  0], [-16,-12], [-10, -2], [-10,  2], [-16, 12]],
    cockpit: 'square', cockpitOffset: [3, 0], cockpitRadius: 2 },
  { id: 'arrow', name: 'Flecha',
    stroke: '#ff5cf2', boost: '#ffe04b', thrust: 'rgba(255,140,230,0.85)',
    hull: [[ 22,  0], [-14,-10], [ -6, -2], [ -6,  2], [-14, 10]],
    cockpit: 'square', cockpitOffset: [4, 0], cockpitRadius: 2.5 },
  { id: 'pixel', name: 'Pixel',
    stroke: '#ff4d6d', boost: '#ffd24b', thrust: 'rgba(255,90,90,0.85)',
    hull: [[ 20,  0], [ 12, -4], [-12, -8], [ -8,  0], [-12,  8], [ 12,  4]],
    cockpit: 'square', cockpitOffset: [4, 0], cockpitRadius: 2 },
  { id: 'titan', name: 'Titán',
    stroke: '#b4dcff', boost: '#ffe04b', thrust: 'rgba(180,220,255,0.85)',
    hull: [[ 20,  0], [-12, -9], [ -7,  0], [-12,  9]],
    cockpit: 'dot', cockpitOffset: [6, 0], cockpitRadius: 2,
    scale: 2, scoreMultiplier: 2 },
];

let currentSkinIndex = 0;
let skinToast = 0;

try {
  const saved = localStorage.getItem('asteroids.skin');
  const idx = SKINS.findIndex(s => s.id === saved);
  if (idx >= 0) currentSkinIndex = idx;
} catch (e) { /* localStorage puede no estar disponible */ }

const getSkin = () => SKINS[currentSkinIndex];

function setSkin(i) {
  currentSkinIndex = ((i % SKINS.length) + SKINS.length) % SKINS.length;
  try { localStorage.setItem('asteroids.skin', SKINS[currentSkinIndex].id); }
  catch (e) { /* ignorar */ }
  skinToast = 1.2;
}

function cycleSkin() { setSkin(currentSkinIndex + 1); sfx.skin(); }

// ── OVNI enemigo ─────────────────────────────────────────────────────────────
class Ufo {
  constructor() {
    this.radius    = UFO_RADIUS;
    this.dead      = false;
    this.fireTimer = rand(UFO_FIRE_MIN, UFO_FIRE_MAX);

    const edge = randInt(0, 3);
    let x, y, vx, vy;
    const m = UFO_RADIUS + 2;
    switch (edge) {
      case 0: x = rand(m, W - m); y =  m;          vx = 0;           vy =  UFO_SPEED; break;
      case 1: x = W - m;          y = rand(m, H - m); vx = -UFO_SPEED; vy = 0;           break;
      case 2: x = rand(m, W - m); y = H - m;          vx = 0;           vy = -UFO_SPEED; break;
      case 3: x = m;              y = rand(m, H - m); vx =  UFO_SPEED; vy = 0;           break;
    }
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.fireTimer -= dt;
  }

  tryShoot(shipX, shipY) {
    if (this.fireTimer > 0) return null;
    this.fireTimer = rand(UFO_FIRE_MIN, UFO_FIRE_MAX);
    const angle = Math.atan2(shipY - this.y, shipX - this.x) + rand(-0.15, 0.15);
    return new EnemyBullet(this.x, this.y, angle);
  }

  draw() {
    const w = UFO_RADIUS * 1.8;
    const h = UFO_RADIUS * 0.7;

    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.fillStyle   = '#000';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;

    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -h / 4, w / 4, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(0, h / 4, h / 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12 * (getSkin().scale || 1);
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
    this.speedBoost    = 0;   // segundos restantes de propulsión x2
    this.tripleShot    = 0;   // segundos restantes con triple disparo activo
    this.tripleShotCd  = 0;   // segundos restantes de recarga antes de poder reactivar
    this.shieldCharges = 0;   // 0 = sin escudo; >0 = absorbe esa cantidad de impactos
    this.shieldPulse   = 0;   // para animación de la burbuja
    this.hyperspaceCd  = 0;   // segundos restantes antes de poder hiperespaciar
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoost    > 0) this.speedBoost    -= dt;
    if (this.tripleShot    > 0) this.tripleShot    -= dt;
    if (this.tripleShotCd  > 0) this.tripleShotCd  -= dt;
    if (this.hyperspaceCd  > 0) this.hyperspaceCd  -= dt;
    if (this.shieldCharges > 0) this.shieldPulse  += dt;

    const ROT    = 3.5;   // rad/s
    const THRUST = this.speedBoost > 0 ? 520 : 260;  // px/s² (x2 durante el boost)
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21 * (getSkin().scale || 1);
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      // 3 balas desde el morro, en abanico de ±0.10 rad (~5.7°)
      const SPREAD = 0.10;
      return [
        new Bullet(ox, oy, this.angle - SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = getSkin();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    const skinScale = skin.scale || 1;
    if (skinScale !== 1) ctx.scale(skinScale, skinScale);
    // Cian mientras el triple shot esté activo, dorada del skin durante boost, color base del skin en reposo
    ctx.strokeStyle = this.tripleShot > 0 ? '#7cdcff'
                    : this.speedBoost > 0 ? skin.boost
                    : skin.stroke;
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta de la nave según el skin activo
    ctx.beginPath();
    ctx.moveTo(skin.hull[0][0], skin.hull[0][1]);
    for (let i = 1; i < skin.hull.length; i++)
      ctx.lineTo(skin.hull[i][0], skin.hull[i][1]);
    ctx.closePath();
    ctx.stroke();

    // Cabina opcional (acento dorado para contrastar con el trazo del skin)
    if (skin.cockpit) {
      const [cx, cy] = skin.cockpitOffset;
      const cr = skin.cockpitRadius;
      ctx.fillStyle = skin.boost;
      if (skin.cockpit === 'dot') {
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      } else if (skin.cockpit === 'square') {
        ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
      }
    }

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = skin.thrust;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y, color = '255,255,255') {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx    = Math.cos(angle) * speed;
    this.vy    = Math.sin(angle) * speed;
    this.life  = rand(0.4, 1.1);
    this.ttl   = this.life;
    this.dead  = false;
    this.color = color;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(${this.color},${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUp (velocidad x2) ───────────────────────────────────────────────────
class PowerUp {
  constructor(x, y) {
    this.x      = x;
    this.y      = y;
    this.radius = 9;
    this.ttl    = POWERUP_TTL;
    this.dead   = false;
    this.pulse  = 0;
  }

  update(dt) {
    this.ttl -= dt;
    this.pulse += dt;
    if (this.ttl <= 0) this.dead = true;
  }

  // Parpadeo durante los últimos 2 segundos de vida
  visible() {
    return this.ttl > 2 || Math.floor(this.ttl * 8) % 2 === 0;
  }

  draw() {
    if (!this.visible()) return;

    const r     = this.radius;
    const glow  = 0.5 + 0.5 * Math.sin(this.pulse * 6);           // pulso 0..1
    const scale = 1 + glow * 0.15;                                  // leve latido

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);

    // Halo dorado
    ctx.fillStyle = `rgba(255, 194, 75, ${(0.12 + glow * 0.12).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fill();

    // Rayo (icono)
    ctx.strokeStyle = '#ffc24b';
    ctx.fillStyle   = 'rgba(255, 194, 75, 0.25)';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(  3, -r);
    ctx.lineTo( -4,  1);
    ctx.lineTo(  0,  1);
    ctx.lineTo( -3,  r);
    ctx.lineTo(  5, -1);
    ctx.lineTo(  1, -1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

// ── PowerUp (escudo) ─────────────────────────────────────────────────────────
class ShieldPowerUp {
  constructor(x, y) {
    this.x      = x;
    this.y      = y;
    this.radius = 10;
    this.ttl    = POWERUP_TTL;
    this.dead   = false;
    this.pulse  = 0;
  }

  update(dt) {
    this.ttl -= dt;
    this.pulse += dt;
    if (this.ttl <= 0) this.dead = true;
  }

  visible() {
    return this.ttl > 2 || Math.floor(this.ttl * 8) % 2 === 0;
  }

  draw() {
    if (!this.visible()) return;

    const r     = this.radius;
    const glow  = 0.5 + 0.5 * Math.sin(this.pulse * 6);
    const scale = 1 + glow * 0.15;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);

    ctx.fillStyle = `rgba(90, 215, 255, ${(0.12 + glow * 0.12).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5ad7ff';
    ctx.fillStyle   = 'rgba(90, 215, 255, 0.25)';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    const s = r * 0.75;
    ctx.beginPath();
    ctx.moveTo( 0, -s);
    ctx.lineTo( s,  0);
    ctx.lineTo( 0,  s);
    ctx.lineTo(-s,  0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo( 0, -s * 0.55);
    ctx.lineTo( s * 0.55, -s * 0.15);
    ctx.lineTo( s * 0.20,  s * 0.35);
    ctx.lineTo(-s * 0.20,  s * 0.35);
    ctx.lineTo(-s * 0.55, -s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

// ── Hiperespacio ───────────────────────────────────────────────────────────────
const HYPERSPACE_COOLDOWN     = 4;     // segundos entre usos
const HYPERSPACE_INVULNERABLE = 1.2;   // invencibilidad post-teleporte
const HYPERSPACE_ARRIVAL_MARGIN = 18;  // margen mínimo desde el borde al aparecer

// ── High-score: entrada de iniciales ──────────────────────────────────────────
const NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups;
let enemyBullets, ufos;
let score, lives, level;
let state;       // 'help' | 'playing' | 'paused' | 'dead' | 'enterName' | 'gameover'
let deadTimer;
let ufoSpawnTimer;
let bestScore, bestName;
let nameChars, nameIndex;
let newRecord;

function loadBest() {
  bestScore = 0;
  bestName  = '---';
  try {
    const bs = parseInt(localStorage.getItem('asteroids.bestScore') || '0', 10);
    const bn = localStorage.getItem('asteroids.bestName');
    if (Number.isFinite(bs) && bs > 0) bestScore = bs;
    if (typeof bn === 'string' && bn.length > 0) bestName = bn.slice(0, 3);
  } catch (e) { /* localStorage puede no estar disponible */ }
}

function saveBest() {
  try {
    localStorage.setItem('asteroids.bestScore', String(bestScore));
    localStorage.setItem('asteroids.bestName',  bestName);
  } catch (e) { /* ignorar */ }
}

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function maybeSpawnStar() {
  if (Math.random() < STAR_CHANCE)
    asteroids.push(Asteroid.star());
}

function initGame() {
  ship          = new Ship();
  bullets       = [];
  asteroids     = [];
  particles     = [];
  powerups      = [];
  enemyBullets  = [];
  ufos          = [];
  score         = 0;
  lives         = 3;
  level         = 1;
  state         = 'help';
  newRecord     = false;
  ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);
  loadBest();
  makeStars();
  spawnAsteroids(4);
  maybeSpawnStar();
  music.stop();
}

function nextLevel() {
  level++;
  bullets       = [];
  particles     = [];
  powerups      = [];
  enemyBullets  = [];
  ufos          = [];
  ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);
  ship.reset();
  spawnAsteroids(3 + level);
  maybeSpawnStar();
}

function explode(x, y, count = 8, color) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  sfx.death();
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    music.stop();
    sfx.gameOver();
    if (score > bestScore) {
      bestScore = score;
      newRecord = true;
      nameChars = ['A', 'A', 'A'];
      nameIndex = 0;
      state     = 'enterName';
    } else {
      newRecord = false;
      state     = 'gameover';
    }
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

function cycleNameChar(delta) {
  const i   = NAME_CHARS.indexOf(nameChars[nameIndex]);
  const n   = NAME_CHARS.length;
  const nxt = ((i + delta) % n + n) % n;
  nameChars[nameIndex] = NAME_CHARS[nxt];
}

function confirmName() {
  bestName = nameChars.join('');
  saveBest();
  if (newRecord) sfx.newRecord();
  state = 'gameover';
}

function tryHyperspace() {
  if (ship.dead || ship.hyperspaceCd > 0) return false;
  ship.x  = rand(HYPERSPACE_ARRIVAL_MARGIN, W - HYPERSPACE_ARRIVAL_MARGIN);
  ship.y  = rand(HYPERSPACE_ARRIVAL_MARGIN, H - HYPERSPACE_ARRIVAL_MARGIN);
  ship.vx = 0;
  ship.vy = 0;
  ship.invincible   = Math.max(ship.invincible, HYPERSPACE_INVULNERABLE);
  ship.hyperspaceCd = HYPERSPACE_COOLDOWN;
  sfx.hyperspace();
  // Riesgo: si el destino coincide con un asteroide o un OVNI, la nave muere
  for (const a of asteroids) {
    if (!a.dead && dist(ship, a) < ship.radius + a.radius * 0.82) {
      explode(ship.x, ship.y, 10, '180,220,255');
      killShip();
      return true;
    }
  }
  for (const u of ufos) {
    if (!u.dead && dist(ship, u) < ship.radius + u.radius) {
      killShip();
      return true;
    }
  }
  // Destello de llegada
  explode(ship.x, ship.y, 12, '180,220,255');
  return true;
}

// ── updateSim: lógica de simulación (se llama con dt fijo por sub-step) ───────
function updateSim(dt) {
  // Mute funciona en cualquier estado
  if (pressed('KeyM')) {
    audio.enabled = !audio.enabled;
    if (!audio.enabled)      music.stop();
    else if (state === 'playing' && audio.ctx) music.start();
  }

  if (state === 'help') {
    if (pressed('Enter') || pressed('Space')) {
      state = 'playing';
      if (audio.enabled && audio.ctx) music.start();
    }
    return;
  }

  if (state === 'paused') {
    if (pressed('KeyP')) {
      state = 'playing';
      sfx.resume();
      if (audio.enabled && audio.ctx) music.start();
    }
    if (pressed('KeyH')) { state = 'help'; music.stop(); }
    return;
  }

  if ((state === 'playing' || state === 'dead') && pressed('KeyP')) {
    state = 'paused';
    sfx.pause();
    music.stop();
    return;
  }
  if ((state === 'playing' || state === 'dead') && pressed('KeyH')) {
    state = 'help';
    music.stop();
    return;
  }

  if (state === 'enterName') {
    if (pressed('ArrowUp')    || pressed('KeyQ')) cycleNameChar(+1);
    if (pressed('ArrowDown')  || pressed('KeyZ')) cycleNameChar(-1);
    if (pressed('ArrowRight') || pressed('KeyD')) nameIndex = (nameIndex + 1) % 3;
    if (pressed('ArrowLeft')  || pressed('KeyA')) nameIndex = (nameIndex + 2) % 3;
    if (pressed('Enter') || pressed('Space'))    confirmName();
    return;
  }

  if (state === 'gameover') {
    if (pressed('Space') || pressed('Enter')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    powerups.forEach(p => p.update(dt));
    powerups  = powerups.filter(p => !p.dead);
    ufos.forEach(u => u.update(dt));
    enemyBullets.forEach(b => b.update(dt));
    enemyBullets = enemyBullets.filter(b => !b.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerups.forEach(p => p.update(dt));
    powerups  = powerups.filter(p => !p.dead);
    ufos.forEach(u => u.update(dt));
    enemyBullets.forEach(b => b.update(dt));
    enemyBullets = enemyBullets.filter(b => !b.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); sfx.respawn(); }
    return;
  }

  // state === 'playing'
  if (pressed('KeyS')) cycleSkin();

  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
    sfx[ship.tripleShot > 0 ? 'shootTriple' : 'shoot']();
  }

  if (pressed('KeyZ') && ship.tripleShotCd <= 0 && !ship.dead) {
    ship.tripleShot   = TRIPLE_SHOT_DURATION;
    ship.tripleShotCd = TRIPLE_SHOT_COOLDOWN;
    sfx.tripleOn();
  }

  if ((pressed('ShiftLeft') || pressed('ShiftRight')) && !ship.dead) {
    tryHyperspace();
  }

  ufoSpawnTimer -= dt;
  if (ufoSpawnTimer <= 0 && ufos.length === 0) {
    ufos.push(new Ufo());
    ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  ufos.forEach(u => u.update(dt));
  enemyBullets.forEach(b => b.update(dt));
  particles.forEach(p => p.update(dt));
  updateStars(dt);

  bullets      = bullets.filter(b => !b.dead);
  enemyBullets = enemyBullets.filter(b => !b.dead);
  ufos         = ufos.filter(u => !u.dead);
  particles    = particles.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += (a.star ? STAR_POINTS : POINTS[a.size]) * (getSkin().scoreMultiplier || 1);
        sfx.hit(a.size);
        explode(a.x, a.y, a.size * 5);
        sfx.explode(a.size);
        newAsteroids.push(...a.split());
        const drop = Math.random();
        if (drop < POWERUP_CHANCE)
          powerups.push(new PowerUp(a.x, a.y));
        else if (drop < POWERUP_CHANCE + SHIELD_CHANCE)
          powerups.push(new ShieldPowerUp(a.x, a.y));
      }
    }
  }
  for (const a of asteroids)
    if (a.expired) { explode(a.x, a.y, 6); sfx.explode(2); }

  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Bala del jugador vs OVNI
  for (const b of bullets) {
    for (const u of ufos) {
      if (!u.dead && !b.dead && dist(b, u) < u.radius) {
        b.dead = true;
        u.dead = true;
        score += UFO_POINTS * (getSkin().scoreMultiplier || 1);
        explode(u.x, u.y, 12);
        sfx.ufoDie();
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  for (const u of ufos) {
    if (!u.dead && !ship.dead) {
      const eb = u.tryShoot(ship.x, ship.y);
      if (eb) { enemyBullets.push(eb); sfx.enemyShoot(); }
    }
  }

  powerups.forEach(p => p.update(dt));
  for (const p of powerups) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p instanceof ShieldPowerUp) {
        ship.shieldCharges = SHIELD_CHARGES;
        explode(p.x, p.y, 8, '90,215,255');
        sfx.shield();
      } else {
        ship.speedBoost = SPEED_BOOST_DURATION;
        explode(p.x, p.y, 6);
        sfx.powerup();
      }
    }
  }
  powerups = powerups.filter(p => !p.dead);

  if (ship.shieldCharges > 0 && !ship.dead) {
    const shieldR = ship.radius + 8;
    for (const eb of enemyBullets) {
      if (!eb.dead && dist(ship, eb) < shieldR + eb.radius) {
        eb.dead = true;
        ship.shieldCharges--;
        sfx.shieldBlock();
        explode(ship.x, ship.y, 8, '90,215,255');
        if (ship.shieldCharges === 0) explode(ship.x, ship.y, 14, '90,215,255');
      }
    }
    for (const a of asteroids) {
      if (!a.dead && dist(ship, a) < shieldR + a.radius * 0.82) {
        a.dead = true;
        ship.shieldCharges--;
        sfx.shieldBlock();
        explode(a.x, a.y, a.size * 5);
        if (ship.shieldCharges === 0) explode(ship.x, ship.y, 14, '90,215,255');
      }
    }
  }
  enemyBullets = enemyBullets.filter(b => !b.dead);
  asteroids    = asteroids.filter(a => !a.dead);

  if (!ship.dead) {
    for (const u of ufos) {
      if (!u.dead && dist(ship, u) < ship.radius + u.radius) {
        killShip();
        break;
      }
    }
  }

  if (ship.invincible <= 0 && ship.shieldCharges === 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  if (asteroids.length === 0) { nextLevel(); sfx.levelUp(); }
}

// ── updateVisuals: animaciones no simuladas ───────────────────────────────────
function updateVisuals(dt) {
  if (skinToast > 0) skinToast = Math.max(0, skinToast - dt);
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawShield() {
  if (ship.shieldCharges <= 0 || ship.dead) return;

  const baseR = ship.radius + 8;
  const r     = baseR + Math.sin(ship.shieldPulse * 6) * 2;
  const n     = ship.shieldCharges;

  ctx.save();
  ctx.strokeStyle = 'rgba(90, 215, 255, 0.75)';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';

  const gap      = 0.2;
  const arcWidth = (Math.PI * 2 - gap * n) / n;
  const start    = -Math.PI / 2 - arcWidth / 2;

  for (let i = 0; i < n; i++) {
    const a = start + i * (arcWidth + gap);
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, r, a, a + arcWidth);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(90, 215, 255, 0.18)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.arc(ship.x, ship.y, r + 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawHUD() {
  ctx.font      = '15px monospace';
  ctx.textAlign = 'left';

  ctx.fillStyle = '#fff';
  ctx.fillText(`SCORE  ${score}`, 14, 26);
  ctx.fillStyle = '#888';
  ctx.fillText(`RÉCORD  ${String(bestScore).padStart(5, '0')}  ${bestName}`, 14, 46);

  if (ship.speedBoost > 0) {
    ctx.fillStyle = '#ffc24b';
    ctx.fillText(`x2  ${ship.speedBoost.toFixed(1)}s`, 14, 70);
  }

  if (ship.tripleShot > 0) {
    ctx.fillStyle = '#7cff8a';
    ctx.fillText(`Z TRIPLE  ${ship.tripleShot.toFixed(1)}s`, 14, 90);
  } else if (ship.tripleShotCd > 0) {
    ctx.fillStyle = 'rgba(124, 255, 138, 0.55)';
    ctx.fillText(`Z RECARGA  ${ship.tripleShotCd.toFixed(1)}s`, 14, 90);
  }

  if (ship.shieldCharges > 0) {
    ctx.fillStyle = '#5ad7ff';
    ctx.fillText(`ESCUDO  x${ship.shieldCharges}`, 14, 110);
  }

  if (!ship.dead) {
    if (ship.hyperspaceCd > 0) {
      ctx.fillStyle = 'rgba(180,220,255,0.55)';
      ctx.fillText(`SHIFT RECARGA  ${ship.hyperspaceCd.toFixed(1)}s`, 14, 130);
    } else {
      ctx.fillStyle = '#b4dcff';
      ctx.fillText(`SHIFT HIPERESPACIO listo`, 14, 130);
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);
  ctx.fillStyle = '#888';
  ctx.fillText(`SKIN: ${getSkin().name}`, W / 2, 46);

  if (!audio.enabled) {
    ctx.fillStyle = '#666';
    ctx.fillText(`MUDO (M)`, W / 2, 66);
  }

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);
}

function drawOverlay(title, sub, sub2) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font      = '18px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
  if (sub2) ctx.fillText(sub2, W / 2, H / 2 + 46);
}

function drawHelp() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 40px monospace';
  ctx.fillText('ASTEROIDS', W / 2, 110);

  ctx.font      = '16px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const lines = [
    ['←  →',      'Rotar'],
    ['↑',          'Acelerar'],
    ['ESPACIO',    'Disparar'],
    ['SHIFT',      'Hiperespacio (riesgo)'],
    ['Z',          'Triple disparo'],
    ['S',          'Cambiar skin'],
    ['P',          'Pausa'],
    ['M',          'Silenciar'],
    ['H',          'Esta ayuda'],
  ];
  const cx = W / 2 - 110;
  for (let i = 0; i < lines.length; i++) {
    const y = 180 + i * 28;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#7cff8a';
    ctx.fillText(lines[i][0], cx, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(lines[i][1], cx + 18, y);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 20px monospace';
  ctx.fillText('ENTER  o  ESPACIO  PARA  EMPEZAR', W / 2, H - 80);

  ctx.font      = '14px monospace';
  ctx.fillStyle = '#888';
  ctx.fillText(`Récord actual: ${bestScore}  ${bestName}`, W / 2, H - 50);
}

function drawNameEntry() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc24b';
  ctx.font      = 'bold 36px monospace';
  ctx.fillText('¡NUEVO RÉCORD!', W / 2, H / 2 - 80);

  ctx.font      = '20px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(`Puntaje: ${score}`, W / 2, H / 2 - 40);

  // 3 caracteres grandes con el actual parpadeando
  ctx.font      = 'bold 64px monospace';
  const cellW = 60;
  const x0 = W / 2 - cellW;
  for (let i = 0; i < 3; i++) {
    const x = x0 + i * cellW;
    if (i === nameIndex && Math.floor(performance.now() / 250) % 2 === 0) {
      ctx.fillStyle = 'rgba(180,220,255,0.35)';
      ctx.fillRect(x - 22, H / 2 - 30, 44, 64);
    }
    ctx.fillStyle = i === nameIndex ? '#b4dcff' : '#fff';
    ctx.fillText(nameChars[i], x, H / 2 + 16);
  }

  ctx.font      = '15px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('↑ / ↓  Cambiar letra     ← / →  Mover cursor',     W / 2, H / 2 + 80);
  ctx.fillText('ENTER  Guardar',                                   W / 2, H / 2 + 102);
}

function drawPaused() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  drawOverlay('PAUSA', 'P  PARA  CONTINUAR', 'H  PARA  AYUDA');
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  drawStars();

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  ufos.forEach(u => u.draw());
  enemyBullets.forEach(b => b.draw());
  bullets.forEach(b => b.draw());
  powerups.forEach(p => p.draw());
  ship.draw();
  drawShield();

  drawHUD();

  if (skinToast > 0) {
    const alpha = Math.min(1, skinToast / 0.4);
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.font      = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(getSkin().name, W / 2, 160);
  }

  if (state === 'paused')    drawPaused();
  else if (state === 'help') drawHelp();
  else if (state === 'enterName') drawNameEntry();
  else if (state === 'gameover') {
    let sub = `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`;
    if (newRecord) sub = `¡RÉCORD! ${bestName}  ${score}   —   ESPACIO PARA REINICIAR`;
    drawOverlay('GAME OVER', sub);
  }
}

// ── Loop principal ────────────────────────────────────────────────────────────
const SIM_STEP = 1 / 120;   // paso fijo para colisiones estables
let lastTime  = null;
let _accum    = 0;

function loop(ts) {
  const frameDt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;

  const frozen = state === 'help' || state === 'paused' || state === 'enterName';
  if (frozen) {
    // Sin acumulación: 1 sola pasada para input; la escena no se mueve.
    _accum = 0;
    updateSim(frameDt);
  } else {
    _accum += frameDt;
    let steps = 0;
    while (_accum >= SIM_STEP && steps < 8) {
      updateSim(SIM_STEP);
      _accum -= SIM_STEP;
      steps++;
    }
    if (_accum >= SIM_STEP * 3) _accum = 0; // anti-spiral-of-death
  }

  updateVisuals(frameDt);
  draw();
  requestAnimationFrame(loop);
}

// Auto-pausa al perder el foco de la pestaña
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') {
    state = 'paused';
    sfx.pause();
    music.stop();
  }
});

initGame();
requestAnimationFrame(loop);
