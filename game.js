"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// HUD elements
const playerHealthValueEl = document.getElementById("player-health-value");
const weaponValueEl = document.getElementById("weapon-value");
const enemiesValueEl = document.getElementById("enemies-value");
const overlayEl = document.getElementById("message-overlay");
const messageTextEl = document.getElementById("message-text");
const restartButton = document.getElementById("restart-button");

const ROOM_WIDTH = 640;
const ROOM_HEIGHT = 480;
const ROOM_MARGIN_X = (canvas.width - ROOM_WIDTH) / 2;
const ROOM_MARGIN_Y = (canvas.height - ROOM_HEIGHT) / 2;

const PLAYER_SPEED = 2.4;
const PLAYER_SIZE = 24;
const PLAYER_MAX_HP = 10;
// Bounds for room/obstacle collision (match visible sprite: 48px wide, ~72px tall)
const PLAYER_BOUNDS_HALF_WIDTH = 24;
const PLAYER_BOUNDS_HALF_HEIGHT = 36;
const KNOCKBACK_DISTANCE_EACH = 60;   // 120px total separation
const KNOCKBACK_SPEED_PER_FRAME = 4;  // pixels per frame (slower push)

const ENEMY_SIZE = 24;
const ENEMY_MAX_HP = 10;
const ENEMY_ELITE_SIZE = 48;   // twice as big
const ENEMY_ELITE_HP = 20;     // twice as strong (HP)
const ENEMY_ELITE_DAMAGE = 2;  // deal 2 hearts on contact
const ENEMY_SPEED = 1.0;
const ROOM_DEMONS_SHOOT_FIREBALLS = 2; // room index where demons throw slow fireballs
const ENEMY_FIREBALL_SPEED = 1.2;
const ENEMY_FIREBALL_COOLDOWN = 90;   // frames between shots per demon
const ENEMY_FIREBALL_SIZE = 8;
const ENEMY_FIREBALL_DAMAGE = 1;

const FIREBALL_SPEED = 5;
const FIREBALL_SIZE = 10;
// Damage values & sword geometry
const FIREBALL_DAMAGE = 5; // each fireball hit
const SWORD_DAMAGE = 15;   // each sword hit (50% stronger than base)
const SWORD_RANGE = PLAYER_SIZE * 3; // sword length (50% longer: 3× player size)
const SWORD_ARC = Math.PI / 2;   // 180° total swing (±90° from facing)
const SWORD_SWING_DURATION = 15; // frames for full swing animation (20% slower than before)

const WEAPON_FIREBALL = "fireball";
const WEAPON_SWORD = "sword";

// --- HERO SPRITE CONFIG ---
// New hero sprite sheet is a 4x4 grid:
// Row 0: walk forward (toward player / down)
// Row 1: walk back (away / up)
// Row 2: walk left  (4th frame currently wrong, faces right)
// Row 3: walk right
// Col 1 is preferred idle; cols 0,2,3 are used for movement.
const HERO_SPRITE_COLS = 4;
const HERO_SPRITE_ROWS = 4;

const HERO_DIR_DOWN = 0;
const HERO_DIR_UP = 1;
const HERO_DIR_LEFT = 2;
const HERO_DIR_RIGHT = 3;

const heroImage = new Image();
heroImage.src = "hero.png";

let heroFrameWidth = 0;
let heroFrameHeight = 0;
let heroSpriteLoaded = false;

heroImage.onload = () => {
  heroFrameWidth = heroImage.width / HERO_SPRITE_COLS;
  heroFrameHeight = heroImage.height / HERO_SPRITE_ROWS;
  heroSpriteLoaded = true;
};

// Animation state for the hero sprite
const heroAnim = {
  dir: HERO_DIR_DOWN,
  moving: false,
  walkFrameIndex: 0, // index into per-direction walking sequence
  frameCounter: 0,
  frameInterval: 8, // frames between animation steps
};

// 2x4 grid of rooms: indices 0..7
// [0] [1] [2] [3]
// [4] [5] [6] [7]
const ROOMS = [
  { id: 0, neighbors: { right: 1, down: 4 } },
  { id: 1, neighbors: { left: 0, right: 2, down: 5 } },
  { id: 2, neighbors: { left: 1, right: 3, down: 6 } },
  { id: 3, neighbors: { left: 2, down: 7 } },
  { id: 4, neighbors: { up: 0, right: 5 } },
  { id: 5, neighbors: { up: 1, left: 4, right: 6 } },
  { id: 6, neighbors: { up: 2, left: 5, right: 7 } },
  { id: 7, neighbors: { up: 3, left: 6 } },
];

let keys = {};

class Entity {
  constructor(x, y, size, color) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.color = color;
  }

  get half() {
    return this.size / 2;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(
      this.x - this.half,
      this.y - this.half,
      this.size,
      this.size
    );
  }
}

class Player extends Entity {
  constructor(x, y) {
    super(x, y, PLAYER_SIZE, "#4caf50");
    this.hp = PLAYER_MAX_HP;
    this.boundsHalfW = PLAYER_BOUNDS_HALF_WIDTH;
    this.boundsHalfH = PLAYER_BOUNDS_HALF_HEIGHT;
    this.weapon = WEAPON_FIREBALL;
    this.facingAngle = 0; // radians
    this.currentRoom = 0;
    this.attackCooldown = 0;
    this.swordSwingTimer = 0; // counts down while sword is visually swinging
    this.knockbackRemaining = 0;
    this.knockbackNx = 0;
    this.knockbackNy = 0;
  }

  reset(x, y, roomId) {
    this.x = x;
    this.y = y;
    this.hp = PLAYER_MAX_HP;
    this.weapon = WEAPON_FIREBALL;
    this.facingAngle = 0;
    this.currentRoom = roomId;
    this.attackCooldown = 0;
    this.swordSwingTimer = 0;
    this.knockbackRemaining = 0;
    this.knockbackNx = 0;
    this.knockbackNy = 0;
  }
}

class Enemy extends Entity {
  constructor(x, y, roomId, isElite = false) {
    const size = isElite ? ENEMY_ELITE_SIZE : ENEMY_SIZE;
    const maxHp = isElite ? ENEMY_ELITE_HP : ENEMY_MAX_HP;
    super(x, y, size, isElite ? "#8b0000" : "#e53935");
    this.hp = maxHp;
    this.roomId = roomId;
    this.damage = isElite ? ENEMY_ELITE_DAMAGE : 1;
    this.hitFlashTimer = 0;
    this.knockbackRemaining = 0;
    this.knockbackNx = 0;
    this.knockbackNy = 0;
    this.fireballCooldown = 0; // used in room where demons shoot
  }

  draw() {
    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = "#ffffff";
      this.hitFlashTimer--;
    } else {
      ctx.fillStyle = this.color;
    }
    ctx.fillRect(
      this.x - this.half,
      this.y - this.half,
      this.size,
      this.size
    );
  }
}

class Projectile extends Entity {
  constructor(x, y, vx, vy, roomId) {
    super(x, y, FIREBALL_SIZE, "#ffca28");
    this.vx = vx;
    this.vy = vy;
    this.roomId = roomId;
    this.alive = true;
  }

  update(obstacles) {
    this.x += this.vx;
    this.y += this.vy;

    // Stop if outside room bounds
    if (
      this.x - this.half < ROOM_MARGIN_X ||
      this.x + this.half > ROOM_MARGIN_X + ROOM_WIDTH ||
      this.y - this.half < ROOM_MARGIN_Y ||
      this.y + this.half > ROOM_MARGIN_Y + ROOM_HEIGHT
    ) {
      this.alive = false;
      spawnExplosion(this.x, this.y);
      return;
    }

    // Collide with obstacles
    for (const ob of obstacles) {
      if (rectIntersect(this, ob)) {
        this.alive = false;
        spawnExplosion(this.x, this.y);
        return;
      }
    }
  }

  draw() {
    // Draw a meteor-style projectile: bright orange core, yellow edge, and a fading tail.

    // Tail direction is opposite velocity
    const speed = Math.hypot(this.vx, this.vy) || 1;
    const dirX = this.vx / speed;
    const dirY = this.vy / speed;

    const tailLength = this.size * 3;
    const tailStartX = this.x - dirX * this.half;
    const tailStartY = this.y - dirY * this.half;
    const tailEndX = tailStartX - dirX * tailLength;
    const tailEndY = tailStartY - dirY * tailLength;

    // Tail (fading line)
    const tailGradient = ctx.createLinearGradient(
      tailStartX,
      tailStartY,
      tailEndX,
      tailEndY
    );
    tailGradient.addColorStop(0, "rgba(255, 215, 64, 0.9)"); // bright near core
    tailGradient.addColorStop(1, "rgba(255, 152, 0, 0)");   // fade out

    ctx.strokeStyle = tailGradient;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tailStartX, tailStartY);
    ctx.lineTo(tailEndX, tailEndY);
    ctx.stroke();

    // Core with yellow edge and orange center
    const radial = ctx.createRadialGradient(
      this.x,
      this.y,
      this.half * 0.2,
      this.x,
      this.y,
      this.half
    );
    radial.addColorStop(0, "#ff9800"); // orange core
    radial.addColorStop(1, "#ffeb3b"); // yellow edge

    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.half, 0, Math.PI * 2);
    ctx.fill();
  }
}

function rectIntersect(a, b) {
  const aw = a.boundsHalfW !== undefined ? a.boundsHalfW : a.half;
  const ah = a.boundsHalfH !== undefined ? a.boundsHalfH : a.half;
  const bw = b.boundsHalfW !== undefined ? b.boundsHalfW : b.half;
  const bh = b.boundsHalfH !== undefined ? b.boundsHalfH : b.half;
  return !(
    a.x + aw <= b.x - bw ||
    a.x - aw >= b.x + bw ||
    a.y + ah <= b.y - bh ||
    a.y - ah >= b.y + bh
  );
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Obstacles per room: array of {x,y,size}
const roomObstacles = new Map();

function createObstacle(x, y, size) {
  return { x, y, size, get half() { return size / 2; } };
}

// Doorway zones (room-local 0..640, 0..480) to avoid placing blocks
const DOOR_LEFT = { x: 0, y: 200, w: 55, h: 80 };
const DOOR_RIGHT = { x: 585, y: 200, w: 55, h: 80 };
const DOOR_TOP = { x: 275, y: 0, w: 90, h: 55 };
const DOOR_BOTTOM = { x: 275, y: 425, w: 90, h: 55 };

function obstacleOverlapsDoorway(rx, ry, size) {
  const h = size / 2;
  const obs = { left: rx - h, right: rx + h, top: ry - h, bottom: ry + h };
  const doors = [DOOR_LEFT, DOOR_RIGHT, DOOR_TOP, DOOR_BOTTOM];
  for (const d of doors) {
    if (!(obs.right <= d.x || obs.left >= d.x + d.w || obs.bottom <= d.y || obs.top >= d.y + d.h))
      return true;
  }
  return false;
}

// Spawn zones (room-local): { x, y, r }. Enemies are kept well away from doors (min ~120px) so the player has room when entering.
const SPAWN_ZONES = new Map([
  [0, [{ x: 320, y: 240, r: 75 }, { x: 200, y: 140, r: 35 }, { x: 400, y: 160, r: 35 }, { x: 180, y: 300, r: 35 }, { x: 420, y: 300, r: 35 }]],
  [1, [{ x: 220, y: 180, r: 35 }, { x: 400, y: 160, r: 35 }, { x: 240, y: 300, r: 35 }, { x: 380, y: 280, r: 35 }]],
  [2, [{ x: 220, y: 180, r: 35 }, { x: 400, y: 200, r: 35 }, { x: 240, y: 300, r: 35 }, { x: 380, y: 300, r: 35 }]],
  [3, [{ x: 220, y: 180, r: 35 }, { x: 420, y: 220, r: 35 }, { x: 320, y: 160, r: 35 }, { x: 340, y: 280, r: 35 }]],
  [4, [{ x: 200, y: 160, r: 40 }, { x: 400, y: 180, r: 40 }, { x: 200, y: 300, r: 40 }, { x: 400, y: 300, r: 40 }]],
  [5, [{ x: 220, y: 180, r: 40 }, { x: 400, y: 180, r: 40 }, { x: 240, y: 300, r: 40 }, { x: 380, y: 280, r: 40 }]],
  [6, [{ x: 200, y: 180, r: 40 }, { x: 400, y: 200, r: 40 }, { x: 240, y: 300, r: 40 }, { x: 380, y: 300, r: 40 }]],
  [7, [{ x: 220, y: 200, r: 40 }, { x: 400, y: 220, r: 40 }, { x: 300, y: 160, r: 40 }, { x: 340, y: 280, r: 40 }]],
]);

function obstacleOverlapsSpawnZone(roomId, rx, ry, size) {
  const zones = SPAWN_ZONES.get(roomId);
  if (!zones) return false;
  const obsR = size / 2;
  for (const z of zones) {
    const dist = Math.hypot(rx - z.x, ry - z.y);
    if (dist < obsR + z.r) return true;
  }
  return false;
}

function addObstacleToRoom(roomId, roomLocalX, roomLocalY, size) {
  if (obstacleOverlapsDoorway(roomLocalX, roomLocalY, size)) return;
  if (obstacleOverlapsSpawnZone(roomId, roomLocalX, roomLocalY, size)) return;
  const list = roomObstacles.get(roomId) || [];
  list.push(createObstacle(ROOM_MARGIN_X + roomLocalX, ROOM_MARGIN_Y + roomLocalY, size));
  roomObstacles.set(roomId, list);
}

function setupRoomObstacles() {
  roomObstacles.clear();
  const add = (roomId, x, y, size) => addObstacleToRoom(roomId, x, y, size);

  // Room 0 – mix of 2, 3, 4, 5 blocks
  add(0, 120, 100, 28); add(0, 148, 100, 28); add(0, 176, 100, 28); add(0, 204, 100, 28); add(0, 232, 100, 28); // block of 5
  add(0, 480, 140, 32); add(0, 512, 140, 32); add(0, 544, 140, 32); // block of 3
  add(0, 180, 340, 26); add(0, 206, 340, 26); // block of 2
  add(0, 420, 320, 30); add(0, 450, 320, 30); add(0, 480, 320, 30); add(0, 510, 320, 30); // block of 4
  add(0, 320, 220, 28); add(0, 348, 220, 28); // block of 2

  // Room 1
  add(1, 100, 120, 30); add(1, 130, 120, 30); add(1, 160, 120, 30); // block of 3
  add(1, 520, 100, 26); add(1, 546, 100, 26); add(1, 572, 100, 26); add(1, 598, 100, 26); add(1, 624, 100, 26); // block of 5
  add(1, 200, 360, 32); add(1, 232, 360, 32); // block of 2
  add(1, 380, 180, 28); add(1, 408, 180, 28); add(1, 436, 180, 28); add(1, 464, 180, 28); // block of 4
  add(1, 280, 380, 26); add(1, 306, 380, 26); add(1, 332, 380, 26); // block of 3

  // Room 2
  add(2, 80, 80, 28); add(2, 108, 80, 28); add(2, 136, 80, 28); add(2, 164, 80, 28); // block of 4
  add(2, 540, 140, 30); add(2, 570, 140, 30); // block of 2
  add(2, 140, 380, 26); add(2, 166, 380, 26); add(2, 192, 380, 26); add(2, 218, 380, 26); add(2, 244, 380, 26); // block of 5
  add(2, 460, 340, 32); add(2, 492, 340, 32); add(2, 524, 340, 32); // block of 3
  add(2, 340, 260, 28); add(2, 368, 260, 28); // block of 2

  // Room 3
  add(3, 120, 200, 30); add(3, 150, 200, 30); add(3, 180, 200, 30); // block of 3
  add(3, 400, 80, 26); add(3, 426, 80, 26); add(3, 452, 80, 26); add(3, 478, 80, 26); // block of 4
  add(3, 200, 360, 28); add(3, 228, 360, 28); add(3, 256, 360, 28); add(3, 284, 360, 28); add(3, 312, 360, 28); // block of 5
  add(3, 520, 280, 32); add(3, 552, 280, 32); // block of 2
  add(3, 350, 140, 26); add(3, 376, 140, 26); // block of 2

  // Room 4 – more blocks
  add(4, 140, 100, 28); add(4, 168, 100, 28); add(4, 196, 100, 28); add(4, 224, 100, 28); // block of 4
  add(4, 480, 160, 30); add(4, 510, 160, 30); add(4, 540, 160, 30); // block of 3
  add(4, 100, 340, 26); add(4, 126, 340, 26); add(4, 152, 340, 26); add(4, 178, 340, 26); add(4, 204, 340, 26); // block of 5
  add(4, 420, 320, 32); add(4, 452, 320, 32); // block of 2
  add(4, 280, 220, 28); add(4, 308, 220, 28); add(4, 336, 220, 28); // block of 3

  // Room 5
  add(5, 80, 120, 30); add(5, 110, 120, 30); add(5, 140, 120, 30); add(5, 170, 120, 30); // block of 4
  add(5, 560, 100, 26); add(5, 586, 100, 26); add(5, 612, 100, 26); // block of 3
  add(5, 180, 360, 28); add(5, 208, 360, 28); add(5, 236, 360, 28); add(5, 264, 360, 28); add(5, 292, 360, 28); // block of 5
  add(5, 400, 180, 32); add(5, 432, 180, 32); // block of 2
  add(5, 320, 380, 26); add(5, 346, 380, 26); add(5, 372, 380, 26); // block of 3

  // Room 6
  add(6, 100, 80, 28); add(6, 128, 80, 28); add(6, 156, 80, 28); add(6, 184, 80, 28); add(6, 212, 80, 28); // block of 5
  add(6, 520, 140, 30); add(6, 550, 140, 30); add(6, 580, 140, 30); add(6, 610, 140, 30); // block of 4
  add(6, 140, 380, 26); add(6, 166, 380, 26); add(6, 192, 380, 26); // block of 3
  add(6, 440, 340, 32); add(6, 472, 340, 32); // block of 2
  add(6, 340, 260, 28); add(6, 368, 260, 28); add(6, 396, 260, 28); // block of 3

  // Room 7
  add(7, 120, 180, 30); add(7, 150, 180, 30); add(7, 180, 180, 30); add(7, 210, 180, 30); // block of 4
  add(7, 380, 100, 26); add(7, 406, 100, 26); add(7, 432, 100, 26); add(7, 458, 100, 26); add(7, 484, 100, 26); // block of 5
  add(7, 200, 360, 28); add(7, 228, 360, 28); add(7, 256, 360, 28); // block of 3
  add(7, 500, 300, 32); add(7, 532, 300, 32); add(7, 564, 300, 32); // block of 3
  add(7, 320, 140, 26); add(7, 346, 140, 26); // block of 2
}

let player = new Player(
  ROOM_MARGIN_X + ROOM_WIDTH / 2,
  ROOM_MARGIN_Y + ROOM_HEIGHT / 2
);

let enemies = [];
let projectiles = [];
let enemyProjectiles = []; // slow fireballs thrown by demons in one room
let explosions = []; // fireball impact effects
let deathScatterParticles = []; // enemy sword-death scatter pieces
let isGameOver = false;
let victory = false;
let hasStarted = false; // becomes true after first start

function setupEnemies() {
  enemies = [];

  // Room 0 – 4 enemies (spawn away from right/down doors so player has space when entering)
  enemies.push(new Enemy(ROOM_MARGIN_X + 200, ROOM_MARGIN_Y + 140, 0));
  enemies.push(new Enemy(ROOM_MARGIN_X + 400, ROOM_MARGIN_Y + 160, 0));
  enemies.push(new Enemy(ROOM_MARGIN_X + 180, ROOM_MARGIN_Y + 300, 0));
  enemies.push(new Enemy(ROOM_MARGIN_X + 420, ROOM_MARGIN_Y + 300, 0));

  // Room 1 – 4 enemies
  enemies.push(new Enemy(ROOM_MARGIN_X + 220, ROOM_MARGIN_Y + 180, 1));
  enemies.push(new Enemy(ROOM_MARGIN_X + 400, ROOM_MARGIN_Y + 160, 1));
  enemies.push(new Enemy(ROOM_MARGIN_X + 240, ROOM_MARGIN_Y + 300, 1));
  enemies.push(new Enemy(ROOM_MARGIN_X + 380, ROOM_MARGIN_Y + 280, 1));

  // Room 2 – 4 enemies (this room’s demons also throw slow fireballs)
  enemies.push(new Enemy(ROOM_MARGIN_X + 220, ROOM_MARGIN_Y + 180, 2));
  enemies.push(new Enemy(ROOM_MARGIN_X + 400, ROOM_MARGIN_Y + 200, 2));
  enemies.push(new Enemy(ROOM_MARGIN_X + 240, ROOM_MARGIN_Y + 300, 2));
  enemies.push(new Enemy(ROOM_MARGIN_X + 380, ROOM_MARGIN_Y + 300, 2));

  // Room 3 – 4 enemies
  enemies.push(new Enemy(ROOM_MARGIN_X + 220, ROOM_MARGIN_Y + 180, 3));
  enemies.push(new Enemy(ROOM_MARGIN_X + 420, ROOM_MARGIN_Y + 220, 3));
  enemies.push(new Enemy(ROOM_MARGIN_X + 320, ROOM_MARGIN_Y + 160, 3));
  enemies.push(new Enemy(ROOM_MARGIN_X + 340, ROOM_MARGIN_Y + 280, 3));

  // Rooms 4–7 – 4 elite demons each (twice as big, twice as strong)
  enemies.push(new Enemy(ROOM_MARGIN_X + 200, ROOM_MARGIN_Y + 160, 4, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 400, ROOM_MARGIN_Y + 180, 4, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 200, ROOM_MARGIN_Y + 300, 4, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 400, ROOM_MARGIN_Y + 300, 4, true));

  enemies.push(new Enemy(ROOM_MARGIN_X + 220, ROOM_MARGIN_Y + 180, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 400, ROOM_MARGIN_Y + 180, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 240, ROOM_MARGIN_Y + 300, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 380, ROOM_MARGIN_Y + 280, 5, true));

  enemies.push(new Enemy(ROOM_MARGIN_X + 200, ROOM_MARGIN_Y + 180, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 400, ROOM_MARGIN_Y + 200, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 240, ROOM_MARGIN_Y + 300, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 380, ROOM_MARGIN_Y + 300, 6, true));

  enemies.push(new Enemy(ROOM_MARGIN_X + 220, ROOM_MARGIN_Y + 200, 7, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 400, ROOM_MARGIN_Y + 220, 7, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 300, ROOM_MARGIN_Y + 160, 7, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 340, ROOM_MARGIN_Y + 280, 7, true));
}

// Room-local positions for "far side" of room (opposite the door the player entered). Four slots per entry door.
function getFarSideSlots(entryDoor) {
  const slots = {
    right: [{ lx: 120, ly: 140 }, { lx: 120, ly: 320 }, { lx: 220, ly: 180 }, { lx: 220, ly: 300 }],   // far = left half
    left:  [{ lx: 520, ly: 140 }, { lx: 520, ly: 320 }, { lx: 420, ly: 180 }, { lx: 420, ly: 300 }],   // far = right half
    bottom:[{ lx: 140, ly: 100 }, { lx: 340, ly: 100 }, { lx: 500, ly: 180 }, { lx: 180, ly: 200 }],   // far = top half
    top:   [{ lx: 140, ly: 380 }, { lx: 340, ly: 380 }, { lx: 500, ly: 300 }, { lx: 180, ly: 280 }],   // far = bottom half
  };
  return (slots[entryDoor] || slots.right).slice();
}

function repositionEnemiesToFarSide(roomId, entryDoor) {
  const roomEnemies = enemies.filter((e) => e.roomId === roomId && e.hp > 0);
  if (roomEnemies.length === 0) return;
  const slots = getFarSideSlots(entryDoor);
  // Shuffle slots so enemy positions vary
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  roomEnemies.forEach((e, i) => {
    const s = slots[i % slots.length];
    e.x = ROOM_MARGIN_X + s.lx;
    e.y = ROOM_MARGIN_Y + s.ly;
  });
}

function resetGame() {
  setupRoomObstacles();
  setupEnemies();
  const startX = ROOM_MARGIN_X + ROOM_WIDTH / 2;
  const startY = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
  player.reset(startX, startY, 0);
  // Room 0: place enemies on far side from right/bottom (where player typically heads first)
  repositionEnemiesToFarSide(0, "right");
  projectiles = [];
  enemyProjectiles = [];
  deathScatterParticles = [];
  isGameOver = false;
  victory = false;
  overlayEl.classList.add("hidden");
  updateHUD();
}

function spawnDeathScatter(x, y, roomId) {
  const colors = ["#e53935", "#b71c1c", "#8b0000", "#5d0000", "#2a1515"];
  const numPieces = 18;
  for (let i = 0; i < numPieces; i++) {
    const angle = (Math.PI * 2 * i) / numPieces + Math.random() * 0.8;
    const speed = 2 + Math.random() * 4;
    deathScatterParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      roomId,
    });
  }
}

function updateDeathScatter() {
  deathScatterParticles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // slight gravity
    p.alpha -= 0.022;
  });
  deathScatterParticles = deathScatterParticles.filter((p) => p.alpha > 0);
}

function drawDeathScatter() {
  deathScatterParticles.forEach((p) => {
    if (p.roomId !== player.currentRoom) return;
    const hex = p.color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha})`;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
}

function updateHUD() {
  playerHealthValueEl.textContent = player.hp.toString();
  weaponValueEl.textContent =
    player.weapon === WEAPON_FIREBALL ? "Fireball" : "Sword";
  const aliveEnemies = enemies.filter((e) => e.hp > 0).length;
  enemiesValueEl.textContent = aliveEnemies.toString();
}

function showStartScreen() {
  messageTextEl.innerHTML = `
    <div><strong>Press Spacebar to START</strong></div>
    <div style="margin-top: 12px;"><strong>How to play</strong></div>
    <div>To move, press WASD or ARROW keys.</div>
    <div>To attack, press SPACEBAR.</div>
    <div>To switch weapons, press R.</div>
  `;
  restartButton.textContent = "Start";
  overlayEl.classList.remove("hidden");
}

function spawnExplosion(x, y) {
  explosions.push({
    x,
    y,
    radius: 4,
    maxRadius: 22,
    alpha: 1.0,
  });
}

function updateExplosions() {
  explosions.forEach((e) => {
    e.radius += 1.8;
    e.alpha -= 0.08;
  });
  explosions = explosions.filter((e) => e.alpha > 0);
}

function drawExplosions() {
  explosions.forEach((e) => {
    const grad = ctx.createRadialGradient(
      e.x,
      e.y,
      0,
      e.x,
      e.y,
      e.radius
    );
    grad.addColorStop(0, `rgba(255, 171, 64, ${e.alpha})`);
    grad.addColorStop(1, `rgba(255, 87, 34, 0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;

  if (e.key === " " || e.code === "Space") {
    if (!hasStarted) {
      hasStarted = true;
      resetGame();
      overlayEl.classList.add("hidden");
      e.preventDefault();
      return;
    }
    if (!isGameOver) {
      attemptAttack();
    }
    e.preventDefault();
  }

  if (e.key.toLowerCase() === "r") {
    if (!isGameOver) {
      toggleWeapon();
    }
    e.preventDefault();
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

restartButton.addEventListener("click", () => {
  hasStarted = true;
  resetGame();
});

function toggleWeapon() {
  player.weapon =
    player.weapon === WEAPON_FIREBALL ? WEAPON_SWORD : WEAPON_FIREBALL;
  updateHUD();
}

function attemptAttack() {
  if (player.attackCooldown > 0) return;

  if (player.weapon === WEAPON_FIREBALL) {
    // Fire three projectiles in a small fan centered on facingAngle
    const baseAngle = player.facingAngle;
    const spread = Math.PI / 18; // ~10° between shots
    const angles = [baseAngle - spread, baseAngle, baseAngle + spread];

    angles.forEach((angle) => {
      const vx = Math.cos(angle) * FIREBALL_SPEED;
      const vy = Math.sin(angle) * FIREBALL_SPEED;
      const px = player.x + Math.cos(angle) * (player.half + FIREBALL_SIZE);
      const py = player.y + Math.sin(angle) * (player.half + FIREBALL_SIZE);
      const proj = new Projectile(px, py, vx, vy, player.currentRoom);
      projectiles.push(proj);
    });

    player.attackCooldown = 18;
  } else if (player.weapon === WEAPON_SWORD) {
    performSwordAttack();
    player.attackCooldown = 16;
    player.swordSwingTimer = SWORD_SWING_DURATION;
  }
}

function performSwordAttack() {
  const angle = player.facingAngle;

  enemies.forEach((enemy) => {
    if (enemy.roomId !== player.currentRoom || enemy.hp <= 0) return;

    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > player.half + SWORD_RANGE + enemy.half) return;

    const enemyAngle = Math.atan2(dy, dx);
    let diff = enemyAngle - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    if (Math.abs(diff) <= SWORD_ARC) {
      enemy.hp -= SWORD_DAMAGE;
      enemy.hitFlashTimer = 6;
      if (enemy.hp <= 0) {
        spawnDeathScatter(enemy.x, enemy.y, enemy.roomId);
      }
    }
  });
}

function updatePlayerMovement() {
  // Apply knockback first (slower, over multiple frames)
  if (player.knockbackRemaining > 0) {
    const move = Math.min(KNOCKBACK_SPEED_PER_FRAME, player.knockbackRemaining);
    player.x += player.knockbackNx * move;
    player.y += player.knockbackNy * move;
    player.knockbackRemaining -= move;
    player.x = clamp(
      player.x,
      ROOM_MARGIN_X + player.boundsHalfW,
      ROOM_MARGIN_X + ROOM_WIDTH - player.boundsHalfW
    );
    player.y = clamp(
      player.y,
      ROOM_MARGIN_Y + player.boundsHalfH,
      ROOM_MARGIN_Y + ROOM_HEIGHT - player.boundsHalfH
    );
    return;
  }

  let moveX = 0;
  let moveY = 0;

  if (keys["arrowup"]) moveY -= 1;
  if (keys["arrowdown"]) moveY += 1;
  if (keys["arrowleft"]) moveX -= 1;
  if (keys["arrowright"]) moveX += 1;

  if (moveX !== 0 || moveY !== 0) {
    const len = Math.hypot(moveX, moveY);
    moveX /= len;
    moveY /= len;
    player.facingAngle = Math.atan2(moveY, moveX);
  }

  // Update hero animation direction & moving flag based on movement input
  if (moveX !== 0 || moveY !== 0) {
    heroAnim.moving = true;
    // Decide primary direction: horizontal vs vertical
    if (Math.abs(moveX) > Math.abs(moveY)) {
      heroAnim.dir = moveX > 0 ? HERO_DIR_RIGHT : HERO_DIR_LEFT;
    } else {
      heroAnim.dir = moveY > 0 ? HERO_DIR_DOWN : HERO_DIR_UP;
    }
  } else {
    heroAnim.moving = false;
  }

  const speed = PLAYER_SPEED;
  const obstacles = roomObstacles.get(player.currentRoom) || [];

  // Move X with collision
  let newX = player.x + moveX * speed;
  newX = clamp(
    newX,
    ROOM_MARGIN_X + player.boundsHalfW,
    ROOM_MARGIN_X + ROOM_WIDTH - player.boundsHalfW
  );
  const oldX = player.x;
  player.x = newX;
  for (const ob of obstacles) {
    if (rectIntersect(player, ob)) {
      player.x = oldX;
      break;
    }
  }

  // Move Y with collision
  let newY = player.y + moveY * speed;
  newY = clamp(
    newY,
    ROOM_MARGIN_Y + player.boundsHalfH,
    ROOM_MARGIN_Y + ROOM_HEIGHT - player.boundsHalfH
  );
  const oldY = player.y;
  player.y = newY;
  for (const ob of obstacles) {
    if (rectIntersect(player, ob)) {
      player.y = oldY;
      break;
    }
  }

  handleRoomTransitions();

  // Enforce borders: player must stay inside the current room
  player.x = clamp(
    player.x,
    ROOM_MARGIN_X + player.boundsHalfW,
    ROOM_MARGIN_X + ROOM_WIDTH - player.boundsHalfW
  );
  player.y = clamp(
    player.y,
    ROOM_MARGIN_Y + player.boundsHalfH,
    ROOM_MARGIN_Y + ROOM_HEIGHT - player.boundsHalfH
  );
}

function handleRoomTransitions() {
  const room = ROOMS[player.currentRoom];

  const leftDoorY = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
  const rightDoorY = leftDoorY;
  const topDoorX = ROOM_MARGIN_X + ROOM_WIDTH / 2;
  const bottomDoorX = topDoorX;

  const doorThickness = 60; // vertical extent for side doors, horizontal for top/bottom

  // Left door (exit current room left -> enter new room through its right door)
  if (
    room.neighbors.left !== undefined &&
    player.x - player.boundsHalfW <= ROOM_MARGIN_X + 4 &&
    Math.abs(player.y - leftDoorY) <= doorThickness / 2
  ) {
    player.currentRoom = room.neighbors.left;
    player.x = ROOM_MARGIN_X + ROOM_WIDTH - player.boundsHalfW - 10;
    player.y = leftDoorY;
    repositionEnemiesToFarSide(player.currentRoom, "right");
  }

  // Right door (enter new room through its left door)
  if (
    room.neighbors.right !== undefined &&
    player.x + player.boundsHalfW >= ROOM_MARGIN_X + ROOM_WIDTH - 4 &&
    Math.abs(player.y - rightDoorY) <= doorThickness / 2
  ) {
    player.currentRoom = room.neighbors.right;
    player.x = ROOM_MARGIN_X + player.boundsHalfW + 10;
    player.y = rightDoorY;
    repositionEnemiesToFarSide(player.currentRoom, "left");
  }

  // Top door (enter new room through its bottom door)
  if (
    room.neighbors.up !== undefined &&
    player.y - player.boundsHalfH <= ROOM_MARGIN_Y + 4 &&
    Math.abs(player.x - topDoorX) <= doorThickness / 2
  ) {
    player.currentRoom = room.neighbors.up;
    player.y = ROOM_MARGIN_Y + ROOM_HEIGHT - player.boundsHalfH - 10;
    player.x = topDoorX;
    repositionEnemiesToFarSide(player.currentRoom, "bottom");
  }

  // Bottom door (enter new room through its top door)
  if (
    room.neighbors.down !== undefined &&
    player.y + player.boundsHalfH >= ROOM_MARGIN_Y + ROOM_HEIGHT - 4 &&
    Math.abs(player.x - bottomDoorX) <= doorThickness / 2
  ) {
    player.currentRoom = room.neighbors.down;
    player.y = ROOM_MARGIN_Y + player.boundsHalfH + 10;
    player.x = bottomDoorX;
    repositionEnemiesToFarSide(player.currentRoom, "top");
  }
}

function updateEnemies() {
  enemies.forEach((enemy) => {
    if (enemy.hp <= 0 || enemy.roomId !== player.currentRoom) return;

    // Apply knockback (slower, over multiple frames)
    if (enemy.knockbackRemaining > 0) {
      const move = Math.min(KNOCKBACK_SPEED_PER_FRAME, enemy.knockbackRemaining);
      enemy.x += enemy.knockbackNx * move;
      enemy.y += enemy.knockbackNy * move;
      enemy.knockbackRemaining -= move;
      enemy.x = clamp(
        enemy.x,
        ROOM_MARGIN_X + enemy.half,
        ROOM_MARGIN_X + ROOM_WIDTH - enemy.half
      );
      enemy.y = clamp(
        enemy.y,
        ROOM_MARGIN_Y + enemy.half,
        ROOM_MARGIN_Y + ROOM_HEIGHT - enemy.half
      );
      return;
    }

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      const vx = (dx / dist) * ENEMY_SPEED;
      const vy = (dy / dist) * ENEMY_SPEED;
      const obstacles = roomObstacles.get(enemy.roomId) || [];

      const oldX = enemy.x;
      enemy.x += vx;
      for (const ob of obstacles) {
        if (rectIntersect(enemy, ob)) {
          enemy.x = oldX;
          break;
        }
      }

      const oldY = enemy.y;
      enemy.y += vy;
      for (const ob of obstacles) {
        if (rectIntersect(enemy, ob)) {
          enemy.y = oldY;
          break;
        }
      }
    }

    // In the “fireball room”, demons periodically shoot a slow fireball at the player
    if (
      enemy.roomId === ROOM_DEMONS_SHOOT_FIREBALLS &&
      enemy.roomId === player.currentRoom &&
      enemy.fireballCooldown <= 0
    ) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const vx = (dx / dist) * ENEMY_FIREBALL_SPEED;
      const vy = (dy / dist) * ENEMY_FIREBALL_SPEED;
      const startX = enemy.x + (dx / dist) * (enemy.half + ENEMY_FIREBALL_SIZE);
      const startY = enemy.y + (dy / dist) * (enemy.half + ENEMY_FIREBALL_SIZE);
      enemyProjectiles.push({
        x: startX,
        y: startY,
        vx,
        vy,
        roomId: enemy.roomId,
        size: ENEMY_FIREBALL_SIZE,
        alive: true,
        get half() { return this.size / 2; },
      });
      enemy.fireballCooldown = ENEMY_FIREBALL_COOLDOWN;
    }
    if (enemy.fireballCooldown > 0) enemy.fireballCooldown--;

    // Damage player on contact and start knockback (applied over frames)
    if (rectIntersect(enemy, player)) {
      player.hp = Math.max(0, player.hp - enemy.damage);

      let kdx = player.x - enemy.x;
      let kdy = player.y - enemy.y;
      let kdist = Math.hypot(kdx, kdy);
      if (kdist === 0) {
        kdx = 1;
        kdy = 0;
        kdist = 1;
      }
      const nx = kdx / kdist;
      const ny = kdy / kdist;

      player.knockbackRemaining = KNOCKBACK_DISTANCE_EACH;
      player.knockbackNx = nx;
      player.knockbackNy = ny;

      enemy.knockbackRemaining = KNOCKBACK_DISTANCE_EACH;
      enemy.knockbackNx = -nx;
      enemy.knockbackNy = -ny;

      if (player.hp <= 0) {
        isGameOver = true;
        victory = false;
        showEndMessage();
      }
    }
  });
}

function updateProjectiles() {
  const obstacles = roomObstacles.get(player.currentRoom) || [];
  projectiles.forEach((p) => {
    if (!p.alive) return;
    if (p.roomId !== player.currentRoom) return;
    p.update(obstacles);

    // Hit enemies
    enemies.forEach((enemy) => {
      if (!p.alive) return;
      if (enemy.roomId !== p.roomId || enemy.hp <= 0) return;
      if (rectIntersect(p, enemy)) {
        enemy.hp -= FIREBALL_DAMAGE;
        enemy.hitFlashTimer = 6;
        p.alive = false;
        spawnExplosion(p.x, p.y);
      }
    });
  });

  projectiles = projectiles.filter((p) => p.alive);
}

function updateEnemyProjectiles() {
  const obstacles = roomObstacles.get(player.currentRoom) || [];
  enemyProjectiles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;

    if (
      p.x - p.half < ROOM_MARGIN_X ||
      p.x + p.half > ROOM_MARGIN_X + ROOM_WIDTH ||
      p.y - p.half < ROOM_MARGIN_Y ||
      p.y + p.half > ROOM_MARGIN_Y + ROOM_HEIGHT
    ) {
      p.alive = false;
      return;
    }
    for (const ob of obstacles) {
      if (rectIntersect(p, ob)) {
        p.alive = false;
        return;
      }
    }
    if (rectIntersect(p, player) && player.currentRoom === p.roomId) {
      player.hp = Math.max(0, player.hp - ENEMY_FIREBALL_DAMAGE);
      p.alive = false;
      if (player.hp <= 0) {
        isGameOver = true;
        victory = false;
        showEndMessage();
      }
    }
  });
  enemyProjectiles = enemyProjectiles.filter((p) => p.alive);
}

function checkWinCondition() {
  const stillAlive = enemies.some((e) => e.hp > 0);
  if (!stillAlive) {
    isGameOver = true;
    victory = true;
    showEndMessage();
  }
}

function showEndMessage() {
  messageTextEl.textContent = victory
    ? "You defeated all the demons!"
    : "You lose";
  restartButton.textContent = "Restart";
  overlayEl.classList.remove("hidden");
}

function drawRoomBackground() {
  // Room bounds
  ctx.fillStyle = "#1b1b26";
  ctx.fillRect(ROOM_MARGIN_X, ROOM_MARGIN_Y, ROOM_WIDTH, ROOM_HEIGHT);

  // Border
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 4;
  ctx.strokeRect(ROOM_MARGIN_X, ROOM_MARGIN_Y, ROOM_WIDTH, ROOM_HEIGHT);

  // Doors (2 per room, to neighbors)
  const room = ROOMS[player.currentRoom];
  ctx.strokeStyle = "#cfd8dc";
  ctx.lineWidth = 6;

  const midX = ROOM_MARGIN_X + ROOM_WIDTH / 2;
  const midY = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
  const doorHalf = 30;

  // Left door
  if (room.neighbors.left !== undefined) {
    ctx.beginPath();
    ctx.moveTo(ROOM_MARGIN_X, midY - doorHalf);
    ctx.lineTo(ROOM_MARGIN_X, midY + doorHalf);
    ctx.stroke();
  }
  // Right door
  if (room.neighbors.right !== undefined) {
    ctx.beginPath();
    ctx.moveTo(ROOM_MARGIN_X + ROOM_WIDTH, midY - doorHalf);
    ctx.lineTo(ROOM_MARGIN_X + ROOM_WIDTH, midY + doorHalf);
    ctx.stroke();
  }
  // Top door
  if (room.neighbors.up !== undefined) {
    ctx.beginPath();
    ctx.moveTo(midX - doorHalf, ROOM_MARGIN_Y);
    ctx.lineTo(midX + doorHalf, ROOM_MARGIN_Y);
    ctx.stroke();
  }
  // Bottom door
  if (room.neighbors.down !== undefined) {
    ctx.beginPath();
    ctx.moveTo(midX - doorHalf, ROOM_MARGIN_Y + ROOM_HEIGHT);
    ctx.lineTo(midX + doorHalf, ROOM_MARGIN_Y + ROOM_HEIGHT);
    ctx.stroke();
  }
}

function drawObstacles() {
  const obstacles = roomObstacles.get(player.currentRoom) || [];
  ctx.fillStyle = "#607d8b";
  obstacles.forEach((ob) => {
    ctx.fillRect(ob.x - ob.half, ob.y - ob.half, ob.size, ob.size);
  });
}

function drawPlayer() {
  // Draw hero sprite if loaded, otherwise fallback to simple square
  if (heroSpriteLoaded) {
    // Determine sprite row based on direction
    let row = HERO_DIR_DOWN;
    switch (heroAnim.dir) {
      case HERO_DIR_UP:
        row = HERO_DIR_UP;
        break;
      case HERO_DIR_LEFT:
        row = HERO_DIR_LEFT;
        break;
      case HERO_DIR_RIGHT:
        row = HERO_DIR_RIGHT;
        break;
      case HERO_DIR_DOWN:
      default:
        row = HERO_DIR_DOWN;
        break;
    }

    // Choose column: idle uses column 1; walking uses a small sequence.
    let col = 1; // idle
    if (heroAnim.moving) {
      // For most directions, use columns [0,2,3,2] to create a walk cycle.
      // For left, avoid the 4th frame which faces right; use [0,2,0,2].
      const seq =
        row === HERO_DIR_LEFT ? [0, 2, 0, 2] : [0, 2, 3, 2];
      col = seq[heroAnim.walkFrameIndex % seq.length];
    }

    const sx = col * heroFrameWidth;
    const sy = row * heroFrameHeight;

    // Draw the sprite scaled relative to PLAYER_SIZE so it doesn't fill the screen.
    // Target on-screen width is about twice PLAYER_SIZE; height follows the frame aspect ratio.
    const targetWidth = PLAYER_SIZE * 2;
    const scale = targetWidth / heroFrameWidth;
    const targetHeight = heroFrameHeight * scale;

    ctx.drawImage(
      heroImage,
      sx,
      sy,
      heroFrameWidth,
      heroFrameHeight,
      player.x - targetWidth / 2,
      player.y - targetHeight / 2,
      targetWidth,
      targetHeight
    );
  } else {
    // Fallback: original square representation
    player.draw();
  }

  // sword (visual) when swinging: tapered blade (broad base, narrow tip) sweeping 180° in front of player
  if (player.weapon === WEAPON_SWORD && player.swordSwingTimer > 0) {
    const t = 1 - player.swordSwingTimer / SWORD_SWING_DURATION; // 0 → 1 over swing
    const startAngle = player.facingAngle - SWORD_ARC; // start on one side
    const endAngle = player.facingAngle + SWORD_ARC;   // end on the other side
    const swingAngle = startAngle + (endAngle - startAngle) * t;

    const bladeLength = SWORD_RANGE;
    const baseHalfThick = 10;  // broader base near player
    const tipHalfThick = 2;    // tapers to narrow point

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(swingAngle);

    const startOffset = player.half;
    const tipX = startOffset + bladeLength;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.moveTo(startOffset, -baseHalfThick);   // base left
    ctx.lineTo(startOffset, baseHalfThick);    // base right
    ctx.lineTo(tipX, tipHalfThick);            // tip right (narrower)
    ctx.lineTo(tipX, -tipHalfThick);            // tip left
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

function drawEnemies() {
  enemies.forEach((enemy) => {
    if (enemy.roomId !== player.currentRoom || enemy.hp <= 0) return;
    enemy.draw();
  });
}

function drawEnemyProjectiles() {
  enemyProjectiles.forEach((p) => {
    if (p.roomId !== player.currentRoom || !p.alive) return;
    ctx.fillStyle = "#b71c1c";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.half, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawProjectiles() {
  projectiles.forEach((p) => {
    if (p.roomId !== player.currentRoom && p.alive) return;
    p.draw();
  });
}

function drawUIHints() {
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    "Move: Arrow keys | Attack: Space | Switch weapon: R",
    ROOM_MARGIN_X + 12,
    ROOM_MARGIN_Y + ROOM_HEIGHT - 12
  );
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!isGameOver && hasStarted) {
    if (player.attackCooldown > 0) player.attackCooldown--;
    if (player.swordSwingTimer > 0) player.swordSwingTimer--;
    // Update hero walk animation
    if (heroAnim.moving) {
      heroAnim.frameCounter++;
      if (heroAnim.frameCounter >= heroAnim.frameInterval) {
        heroAnim.frameCounter = 0;
        heroAnim.walkFrameIndex =
          (heroAnim.walkFrameIndex + 1) % 4; // sequence length used in drawPlayer
      }
    } else {
      heroAnim.frameCounter = 0;
      heroAnim.walkFrameIndex = 0;
    }
    updatePlayerMovement();
    updateEnemies();
    updateProjectiles();
    updateEnemyProjectiles();
    updateExplosions();
    updateDeathScatter();
    checkWinCondition();
  }

  drawRoomBackground();
  drawObstacles();
  drawEnemies();
  drawDeathScatter();
  drawEnemyProjectiles();
  drawProjectiles();
  drawExplosions();
  drawPlayer();
  drawUIHints();

  updateHUD();

  requestAnimationFrame(gameLoop);
}

// Initialize
showStartScreen();
requestAnimationFrame(gameLoop);

