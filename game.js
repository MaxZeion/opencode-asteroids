'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
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

function cycleSkin() { setSkin(currentSkinIndex + 1); }

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
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
    this.speedBoost    = 0;   // segundos restantes de propulsión x2
    this.tripleShot    = 0;   // segundos restantes con triple disparo activo
    this.tripleShotCd  = 0;   // segundos restantes de recarga antes de poder reactivar
    this.shieldCharges = 0;   // 0 = sin escudo; >0 = absorbe esa cantidad de impactos
    this.shieldPulse   = 0;   // para animación de la burbuja
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.speedBoost    > 0) this.speedBoost    -= dt;
    if (this.tripleShot    > 0) this.tripleShot    -= dt;
    if (this.tripleShotCd  > 0) this.tripleShotCd  -= dt;
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
    const NOSE = 21;
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

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups;
let enemyBullets, ufos;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let ufoSpawnTimer;

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
  state         = 'playing';
  ufoSpawnTimer = rand(UFO_SPAWN_MIN, UFO_SPAWN_MAX);
  spawnAsteroids(4);
  maybeSpawnStar();
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
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (skinToast > 0) skinToast = Math.max(0, skinToast - dt);
  if (pressed('KeyS')) cycleSkin();

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
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
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  // Activar triple shot (si el cooldown terminó y la nave está viva)
  if (pressed('KeyZ') && ship.tripleShotCd <= 0 && !ship.dead) {
    ship.tripleShot   = TRIPLE_SHOT_DURATION;
    ship.tripleShotCd = TRIPLE_SHOT_COOLDOWN;
  }

  // Spawn del OVNI
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
        score += a.star ? STAR_POINTS : POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
        const drop = Math.random();
        if (drop < POWERUP_CHANCE)
          powerups.push(new PowerUp(a.x, a.y));
        else if (drop < POWERUP_CHANCE + SHIELD_CHANCE)
          powerups.push(new ShieldPowerUp(a.x, a.y));
      }
    }
  }
  // Estrellas fugaces que expiraron por tiempo: destello al desaparecer
  for (const a of asteroids)
    if (a.expired) explode(a.x, a.y, 6);

  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Bala del jugador vs OVNI
  for (const b of bullets) {
    for (const u of ufos) {
      if (!u.dead && !b.dead && dist(b, u) < u.radius) {
        b.dead = true;
        u.dead = true;
        score += UFO_POINTS;
        explode(u.x, u.y, 12);
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  // OVNI dispara contra la nave
  for (const u of ufos) {
    if (!u.dead && !ship.dead) {
      const eb = u.tryShoot(ship.x, ship.y);
      if (eb) enemyBullets.push(eb);
    }
  }

  // Power-up: update + recolección
  powerups.forEach(p => p.update(dt));
  for (const p of powerups) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      if (p instanceof ShieldPowerUp) {
        ship.shieldCharges = SHIELD_CHARGES;
        explode(p.x, p.y, 8, '90,215,255');
      } else {
        ship.speedBoost = SPEED_BOOST_DURATION;
        explode(p.x, p.y, 6);
      }
    }
  }
  powerups = powerups.filter(p => !p.dead);

  // Escudo: bloquea proyectiles enemigos y asteroides
  if (ship.shieldCharges > 0 && !ship.dead) {
    const shieldR = ship.radius + 8;
    for (const eb of enemyBullets) {
      if (!eb.dead && dist(ship, eb) < shieldR + eb.radius) {
        eb.dead = true;
        ship.shieldCharges--;
        explode(ship.x, ship.y, 8, '90,215,255');
        if (ship.shieldCharges === 0) explode(ship.x, ship.y, 14, '90,215,255');
      }
    }
    for (const a of asteroids) {
      if (!a.dead && dist(ship, a) < shieldR + a.radius * 0.82) {
        a.dead = true;
        ship.shieldCharges--;
        explode(a.x, a.y, a.size * 5);
        if (ship.shieldCharges === 0) explode(ship.x, ship.y, 14, '90,215,255');
      }
    }
  }
  enemyBullets = enemyBullets.filter(b => !b.dead);
  asteroids    = asteroids.filter(a => !a.dead);

  // Nave vs OVNI (letal; sin protección del escudo)
  if (!ship.dead) {
    for (const u of ufos) {
      if (!u.dead && dist(ship, u) < ship.radius + u.radius) {
        killShip();
        break;
      }
    }
  }

  // Nave vs asteroide (cuando no hay escudo)
  if (ship.invincible <= 0 && ship.shieldCharges === 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
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
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  // Indicador de boost de velocidad activo
  if (ship.speedBoost > 0) {
    ctx.fillStyle = '#ffc24b';
    ctx.fillText(`⚡ x2  ${ship.speedBoost.toFixed(1)}s`, 14, 48);
  }

  // Indicador de triple shot: activo (verde fuerte) o en recarga (verde atenuado)
  if (ship.tripleShot > 0) {
    ctx.fillStyle = '#7cff8a';
    ctx.fillText(`Z — TRIPLE  ${ship.tripleShot.toFixed(1)}s`, 14, 70);
  } else if (ship.tripleShotCd > 0) {
    ctx.fillStyle = 'rgba(124, 255, 138, 0.55)';
    ctx.fillText(`Z — RECARGA  ${ship.tripleShotCd.toFixed(1)}s`, 14, 70);
  }

  // Indicador de escudo activo
  if (ship.shieldCharges > 0) {
    ctx.fillStyle = '#5ad7ff';
    ctx.fillText(`ESCUDO  x${ship.shieldCharges}`, 14, 92);
  }

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);
  ctx.fillStyle = '#888';
  ctx.fillText(`SKIN: ${getSkin().name}`, W / 2, 46);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  ufos.forEach(u => u.draw());
  enemyBullets.forEach(b => b.draw());
  bullets.forEach(b => b.draw());
  powerups.forEach(p => p.draw());
  ship.draw();
  drawShield();

  drawHUD();

  // Toast al cambiar de skin
  if (skinToast > 0) {
    const alpha = Math.min(1, skinToast / 0.4);
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.font      = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(getSkin().name, W / 2, 130);
  }

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
