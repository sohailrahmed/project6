"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// HUD elements
const playerHealthValueEl = document.getElementById("player-health-value");
const weaponValueEl = document.getElementById("weapon-value");
const enemiesValueEl = document.getElementById("enemies-value");
const coinsValueEl = document.getElementById("coins-value");
const overlayEl = document.getElementById("message-overlay");
const messageTextEl = document.getElementById("message-text");
const restartButton = document.getElementById("restart-button");

const ROOM_WIDTH = 640;
const ROOM_HEIGHT = 480;
const ROOM_MARGIN_X = (canvas.width - ROOM_WIDTH) / 2;
const ROOM_MARGIN_Y = (canvas.height - ROOM_HEIGHT) / 2;
const ROOM_TRANSITION_SPEED = 0.018; // progress per frame; ~1.1 sec for full slide

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
const ENEMY_ELITE_DAMAGE = 1;  // 1 heart on contact (same as normal)
const ENEMY_SPEED = 1.0;
const SMALL_ENEMY_SPEED = ENEMY_SPEED * 2.5; // fast movers for small enemies
const ROOM_DEMONS_SHOOT_FIREBALLS = 2; // room index where demons throw slow fireballs
const ENEMY_FIREBALL_SPEED = 1.2;
const ENEMY_FIREBALL_COOLDOWN = 90;   // frames between shots per demon
const ENEMY_FIREBALL_SIZE = 8;
const ENEMY_FIREBALL_DAMAGE = 1;

const BOSS_ROOM = 7;  // room furthest from spawn; only enterable when all other enemies dead; exactly 1 enemy (the boss)
const BOSS_SIZE = ENEMY_ELITE_SIZE;   // half of previous size (same as elite)
const BOSS_HP = 50;
const BOSS_DAMAGE = 1;  // 1 heart on contact
const BOSS_SPEED = ENEMY_SPEED * 1.5;     // bounces faster than normal demons
const BOSS_FIREBALL_COOLDOWN = 100;        // frames between shots

const FIREBALL_SPEED = 5;
const FIREBALL_SIZE = 10;
// Damage values & sword geometry
const FIREBALL_DAMAGE = 5; // each fireball hit
const BOSS_FIREBALL_DAMAGE = 1;  // 1 heart when boss fireball hits player
const BOSS_FIREBALL_SPEED = FIREBALL_SPEED * 0.5; // boss fireball moves half as fast as hero fireball
const BOSS_FIREBALL_SIZE = FIREBALL_SIZE * 2;     // large boss fireball
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
    this.contactDamageCooldown = 0;  // frames until next contact can deal 1 heart (prevents multi-enemy stack from one-shotting)
    this.coins = 0;
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
    this.contactDamageCooldown = 0;
    this.coins = 0;
  }
}

class Enemy extends Entity {
  constructor(x, y, roomId, isElite = false) {
    const size = isElite ? ENEMY_ELITE_SIZE : ENEMY_SIZE;
    const maxHp = isElite ? ENEMY_ELITE_HP : ENEMY_MAX_HP;
    super(x, y, size, isElite ? "#8b0000" : "#e53935");
    this.spawnX = x;
    this.spawnY = y;
    this.hp = maxHp;
    this.isElite = isElite;
    this.roomId = roomId;
    this.damage = isElite ? ENEMY_ELITE_DAMAGE : 1;
    this.hitFlashTimer = 0;
    this.knockbackRemaining = 0;
    this.knockbackNx = 0;
    this.knockbackNy = 0;
    this.fireballCooldown = 0; // used in room where demons shoot
    this.dropsHearts = false;  // two enemies per room set in setupEnemies
    this.dropsCoins = false;   // two enemies per room set in setupEnemies
    // Small (non-elite) enemies move fast in straight lines and bounce
    if (!isElite) {
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * SMALL_ENEMY_SPEED;
      this.vy = Math.sin(angle) * SMALL_ENEMY_SPEED;
    }
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

class Boss extends Entity {
  constructor(x, y, roomId) {
    super(x, y, BOSS_SIZE, "#2a0000");
    this.hp = BOSS_HP;
    this.spawnX = x;
    this.spawnY = y;
    this.roomId = roomId;
    this.damage = BOSS_DAMAGE;
    this.isBoss = true;
    this.hitFlashTimer = 0;
    this.knockbackRemaining = 0;
    this.knockbackNx = 0;
    this.knockbackNy = 0;
    this.fireballCooldown = 0;
    this.speed = BOSS_SPEED;
    // Bounce movement: start with a random direction
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
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

// Push player out of one obstacle along the minimum penetration axis. Returns true if overlap was resolved.
function resolvePlayerObstacle(player, ob) {
  const pl = player.x - player.boundsHalfW, pr = player.x + player.boundsHalfW;
  const pt = player.y - player.boundsHalfH, pb = player.y + player.boundsHalfH;
  const ol = ob.x - ob.half, or_ = ob.x + ob.half, ot = ob.y - ob.half, ob_ = ob.y + ob.half;
  if (pr <= ol || pl >= or_ || pb <= ot || pt >= ob_) return false;
  const overlapLeft = pr - ol;
  const overlapRight = or_ - pl;
  const overlapTop = pb - ot;
  const overlapBottom = ob_ - pt;
  const min = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
  if (min === overlapLeft) player.x -= overlapLeft;
  else if (min === overlapRight) player.x += overlapRight;
  else if (min === overlapTop) player.y -= overlapTop;
  else player.y += overlapBottom;
  return true;
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

// Spawn zones (room-local): { x, y, r }. Radii 50 so obstacles never overlap enemy spawns or far-side slots.
const SPAWN_ZONE_R = 50;
// All far-side slot positions (used when repositioning); obstacles must not be placed in these. 5 per entry × 4 = 20.
const FAR_SIDE_SLOTS_ALL = [
  { x: 100, y: 120 }, { x: 100, y: 240 }, { x: 100, y: 360 }, { x: 200, y: 180 }, { x: 200, y: 300 },
  { x: 540, y: 120 }, { x: 540, y: 240 }, { x: 540, y: 360 }, { x: 440, y: 180 }, { x: 440, y: 300 },
  { x: 120, y: 80 }, { x: 280, y: 80 }, { x: 440, y: 80 }, { x: 200, y: 160 }, { x: 400, y: 160 },
  { x: 120, y: 400 }, { x: 280, y: 400 }, { x: 440, y: 400 }, { x: 200, y: 320 }, { x: 400, y: 320 },
].map((p) => ({ ...p, r: SPAWN_ZONE_R }));

const SPAWN_ZONES = new Map([
  [0, [{ x: 320, y: 240, r: 75 }, { x: 200, y: 140, r: SPAWN_ZONE_R }, { x: 400, y: 160, r: SPAWN_ZONE_R }, { x: 180, y: 300, r: SPAWN_ZONE_R }, { x: 420, y: 300, r: SPAWN_ZONE_R }, ...FAR_SIDE_SLOTS_ALL]],
  [1, [{ x: 220, y: 180, r: SPAWN_ZONE_R }, { x: 400, y: 160, r: SPAWN_ZONE_R }, { x: 240, y: 300, r: SPAWN_ZONE_R }, { x: 380, y: 280, r: SPAWN_ZONE_R }, { x: 300, y: 220, r: SPAWN_ZONE_R }, ...FAR_SIDE_SLOTS_ALL]],
  [2, [{ x: 220, y: 180, r: SPAWN_ZONE_R }, { x: 400, y: 200, r: SPAWN_ZONE_R }, { x: 240, y: 300, r: SPAWN_ZONE_R }, { x: 380, y: 300, r: SPAWN_ZONE_R }, { x: 320, y: 240, r: SPAWN_ZONE_R }, ...FAR_SIDE_SLOTS_ALL]],
  [3, [{ x: 220, y: 180, r: SPAWN_ZONE_R }, { x: 420, y: 220, r: SPAWN_ZONE_R }, { x: 320, y: 160, r: SPAWN_ZONE_R }, { x: 340, y: 280, r: SPAWN_ZONE_R }, { x: 260, y: 240, r: SPAWN_ZONE_R }, ...FAR_SIDE_SLOTS_ALL]],
  [4, [{ x: 200, y: 160, r: SPAWN_ZONE_R }, { x: 400, y: 180, r: SPAWN_ZONE_R }, { x: 200, y: 300, r: SPAWN_ZONE_R }, { x: 400, y: 300, r: SPAWN_ZONE_R }, { x: 280, y: 220, r: SPAWN_ZONE_R }, ...FAR_SIDE_SLOTS_ALL]],
  [5, [{ x: 220, y: 180, r: SPAWN_ZONE_R }, { x: 400, y: 180, r: SPAWN_ZONE_R }, { x: 240, y: 300, r: SPAWN_ZONE_R }, { x: 380, y: 280, r: SPAWN_ZONE_R }, { x: 300, y: 240, r: SPAWN_ZONE_R }, ...FAR_SIDE_SLOTS_ALL]],
  [6, [{ x: 200, y: 180, r: SPAWN_ZONE_R }, { x: 400, y: 200, r: SPAWN_ZONE_R }, { x: 240, y: 300, r: SPAWN_ZONE_R }, { x: 380, y: 300, r: SPAWN_ZONE_R }, { x: 280, y: 240, r: SPAWN_ZONE_R }, ...FAR_SIDE_SLOTS_ALL]],
  [7, [{ x: 320, y: 240, r: SPAWN_ZONE_R }]], // boss room: only center spawn zone (no blocks)
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

function positionOverlapsObstacle(roomId, worldX, worldY, halfSize) {
  const obstacles = roomObstacles.get(roomId) || [];
  const r = halfSize;
  for (const ob of obstacles) {
    if (rectIntersect({ x: worldX, y: worldY, boundsHalfW: r, boundsHalfH: r }, ob)) return true;
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

  // Room 0 – clusters of blocks
  add(0, 120, 100, 28); add(0, 148, 100, 28); add(0, 176, 100, 28); add(0, 204, 100, 28); add(0, 232, 100, 28); // block of 5
  add(0, 480, 140, 32); add(0, 512, 140, 32); add(0, 544, 140, 32); // block of 3
  add(0, 180, 340, 26); add(0, 206, 340, 26); add(0, 232, 340, 26); add(0, 258, 340, 26); // block of 4
  add(0, 420, 320, 30); add(0, 450, 320, 30); add(0, 480, 320, 30); add(0, 510, 320, 30); add(0, 540, 320, 30); // block of 5
  add(0, 320, 220, 28); add(0, 348, 220, 28); add(0, 376, 220, 28); // block of 3
  add(0, 80, 260, 26); add(0, 106, 260, 26); add(0, 132, 260, 26); add(0, 158, 260, 26); // cluster left
  add(0, 560, 260, 28); add(0, 588, 260, 28); add(0, 616, 260, 28); // cluster right
  add(0, 260, 80, 26); add(0, 286, 80, 26); add(0, 312, 80, 26); add(0, 338, 80, 26); add(0, 364, 80, 26); // cluster top
  add(0, 55, 55, 24); add(0, 79, 55, 24); add(0, 103, 55, 24); // corner cluster
  add(0, 537, 55, 24); add(0, 561, 55, 24); add(0, 585, 55, 24); // corner cluster

  // Room 1
  add(1, 100, 120, 30); add(1, 130, 120, 30); add(1, 160, 120, 30); add(1, 190, 120, 30); // block of 4
  add(1, 520, 100, 26); add(1, 546, 100, 26); add(1, 572, 100, 26); add(1, 598, 100, 26); add(1, 624, 100, 26); // block of 5
  add(1, 200, 360, 32); add(1, 232, 360, 32); add(1, 264, 360, 32); add(1, 296, 360, 32); // block of 4
  add(1, 380, 180, 28); add(1, 408, 180, 28); add(1, 436, 180, 28); add(1, 464, 180, 28); add(1, 492, 180, 28); // block of 5
  add(1, 280, 380, 26); add(1, 306, 380, 26); add(1, 332, 380, 26); add(1, 358, 380, 26); // block of 4
  add(1, 60, 260, 28); add(1, 88, 260, 28); add(1, 116, 260, 28); add(1, 144, 260, 28); // cluster left
  add(1, 260, 60, 26); add(1, 286, 60, 26); add(1, 312, 60, 26); add(1, 338, 60, 26); // cluster top
  add(1, 55, 420, 24); add(1, 79, 420, 24); add(1, 103, 420, 24); add(1, 127, 420, 24); // corner
  add(1, 537, 420, 24); add(1, 561, 420, 24); add(1, 585, 420, 24); // corner

  // Room 2
  add(2, 80, 80, 28); add(2, 108, 80, 28); add(2, 136, 80, 28); add(2, 164, 80, 28); add(2, 192, 80, 28); // block of 5
  add(2, 540, 140, 30); add(2, 570, 140, 30); add(2, 600, 140, 30); add(2, 618, 140, 30); // block of 4
  add(2, 140, 380, 26); add(2, 166, 380, 26); add(2, 192, 380, 26); add(2, 218, 380, 26); add(2, 244, 380, 26); add(2, 270, 380, 26); // block of 6
  add(2, 460, 340, 32); add(2, 492, 340, 32); add(2, 524, 340, 32); add(2, 556, 340, 32); // block of 4
  add(2, 340, 260, 28); add(2, 368, 260, 28); add(2, 396, 260, 28); add(2, 424, 260, 28); // block of 4
  add(2, 80, 260, 26); add(2, 106, 260, 26); add(2, 132, 260, 26); add(2, 158, 260, 26); // cluster left
  add(2, 580, 260, 28); add(2, 608, 260, 28); add(2, 622, 260, 28); // cluster right
  add(2, 55, 55, 24); add(2, 79, 55, 24); add(2, 103, 55, 24); add(2, 127, 55, 24); // corner
  add(2, 55, 425, 24); add(2, 79, 425, 24); add(2, 103, 425, 24); // corner

  // Room 3
  add(3, 120, 200, 30); add(3, 150, 200, 30); add(3, 180, 200, 30); add(3, 210, 200, 30); add(3, 240, 200, 30); // block of 5
  add(3, 400, 80, 26); add(3, 426, 80, 26); add(3, 452, 80, 26); add(3, 478, 80, 26); add(3, 504, 80, 26); add(3, 530, 80, 26); // block of 6
  add(3, 200, 360, 28); add(3, 228, 360, 28); add(3, 256, 360, 28); add(3, 284, 360, 28); add(3, 312, 360, 28); add(3, 340, 360, 28); // block of 6
  add(3, 520, 280, 32); add(3, 552, 280, 32); add(3, 584, 280, 32); add(3, 616, 280, 32); // block of 4
  add(3, 350, 140, 26); add(3, 376, 140, 26); add(3, 402, 140, 26); add(3, 428, 140, 26); // block of 4
  add(3, 60, 280, 28); add(3, 88, 280, 28); add(3, 116, 280, 28); add(3, 144, 280, 28); // cluster left
  add(3, 280, 400, 26); add(3, 306, 400, 26); add(3, 332, 400, 26); add(3, 358, 400, 26); // cluster bottom
  add(3, 55, 55, 24); add(3, 79, 55, 24); add(3, 103, 55, 24); // corner
  add(3, 537, 425, 24); add(3, 561, 425, 24); add(3, 585, 425, 24); // corner

  // Room 4 – more blocks
  add(4, 140, 100, 28); add(4, 168, 100, 28); add(4, 196, 100, 28); add(4, 224, 100, 28); add(4, 252, 100, 28); add(4, 280, 100, 28); // block of 6
  add(4, 480, 160, 30); add(4, 510, 160, 30); add(4, 540, 160, 30); add(4, 570, 160, 30); add(4, 600, 160, 30); // block of 5
  add(4, 100, 340, 26); add(4, 126, 340, 26); add(4, 152, 340, 26); add(4, 178, 340, 26); add(4, 204, 340, 26); add(4, 230, 340, 26); // block of 6
  add(4, 420, 320, 32); add(4, 452, 320, 32); add(4, 484, 320, 32); add(4, 516, 320, 32); // block of 4
  add(4, 280, 220, 28); add(4, 308, 220, 28); add(4, 336, 220, 28); add(4, 364, 220, 28); add(4, 392, 220, 28); // block of 5
  add(4, 80, 200, 26); add(4, 106, 200, 26); add(4, 132, 200, 26); add(4, 158, 200, 26); // cluster left
  add(4, 560, 280, 28); add(4, 588, 280, 28); add(4, 616, 280, 28); // cluster right
  add(4, 55, 55, 24); add(4, 79, 55, 24); add(4, 103, 55, 24); add(4, 127, 55, 24); // corner
  add(4, 55, 425, 24); add(4, 79, 425, 24); add(4, 103, 425, 24); // corner

  // Room 5
  add(5, 80, 120, 30); add(5, 110, 120, 30); add(5, 140, 120, 30); add(5, 170, 120, 30); add(5, 200, 120, 30); add(5, 230, 120, 30); // block of 6
  add(5, 560, 100, 26); add(5, 586, 100, 26); add(5, 612, 100, 26); add(5, 638, 100, 26); // block of 4
  add(5, 180, 360, 28); add(5, 208, 360, 28); add(5, 236, 360, 28); add(5, 264, 360, 28); add(5, 292, 360, 28); add(5, 320, 360, 28); // block of 6
  add(5, 400, 180, 32); add(5, 432, 180, 32); add(5, 464, 180, 32); add(5, 496, 180, 32); // block of 4
  add(5, 320, 380, 26); add(5, 346, 380, 26); add(5, 372, 380, 26); add(5, 398, 380, 26); add(5, 424, 380, 26); // block of 5
  add(5, 60, 260, 28); add(5, 88, 260, 28); add(5, 116, 260, 28); add(5, 144, 260, 28); // cluster left
  add(5, 260, 60, 26); add(5, 286, 60, 26); add(5, 312, 60, 26); add(5, 338, 60, 26); add(5, 364, 60, 26); // cluster top
  add(5, 55, 420, 24); add(5, 79, 420, 24); add(5, 103, 420, 24); // corner
  add(5, 537, 55, 24); add(5, 561, 55, 24); add(5, 585, 55, 24); add(5, 609, 55, 24); // corner

  // Room 6
  add(6, 100, 80, 28); add(6, 128, 80, 28); add(6, 156, 80, 28); add(6, 184, 80, 28); add(6, 212, 80, 28); add(6, 240, 80, 28); // block of 6
  add(6, 520, 140, 30); add(6, 550, 140, 30); add(6, 580, 140, 30); add(6, 610, 140, 30); // block of 4
  add(6, 140, 380, 26); add(6, 166, 380, 26); add(6, 192, 380, 26); add(6, 218, 380, 26); add(6, 244, 380, 26); add(6, 270, 380, 26); // block of 6
  add(6, 440, 340, 32); add(6, 472, 340, 32); add(6, 504, 340, 32); add(6, 536, 340, 32); add(6, 568, 340, 32); // block of 5
  add(6, 340, 260, 28); add(6, 368, 260, 28); add(6, 396, 260, 28); add(6, 424, 260, 28); add(6, 452, 260, 28); // block of 5
  add(6, 80, 200, 26); add(6, 106, 200, 26); add(6, 132, 200, 26); add(6, 158, 200, 26); add(6, 184, 200, 26); // cluster left
  add(6, 580, 300, 28); add(6, 608, 300, 28); add(6, 636, 300, 28); // cluster right
  add(6, 260, 60, 26); add(6, 286, 60, 26); add(6, 312, 60, 26); add(6, 338, 60, 26); // cluster top
  add(6, 55, 55, 24); add(6, 79, 55, 24); add(6, 103, 55, 24); // corner
  add(6, 537, 425, 24); add(6, 561, 425, 24); add(6, 585, 425, 24); // corner

  // Room 7 = BOSS_ROOM: no blocks
}

let player = new Player(
  ROOM_MARGIN_X + 90,
  ROOM_MARGIN_Y + ROOM_HEIGHT / 2
);

let enemies = [];
let projectiles = [];
let enemyProjectiles = []; // slow fireballs thrown by demons in one room
let explosions = []; // fireball impact effects
let deathScatterParticles = []; // enemy sword-death scatter pieces
let heartPickups = []; // { x, y, roomId } — red hearts from dead enemies, +1 HP when collected
let coinPickups = [];  // { x, y, roomId } — golden coins from dead enemies
let isGameOver = false;

// Room transition: slide effect when entering a new room
let roomTransition = {
  active: false,
  phase: 1,       // 1 = sliding out current room, 2 = sliding in new room
  progress: 0,
  direction: null, // 'left' | 'right' | 'up' | 'down'
  toRoom: null,
};
let cameraOffsetX = 0;
let cameraOffsetY = 0;
let victory = false;
let hasStarted = false; // becomes true after first start

function setupEnemies() {
  enemies = [];

  // Room 0 – 5 enemies
  // Player now starts on the left side of room 0, so enemies are placed in fixed positions
  // spread across the center and right side to avoid surrounding the spawn.
  enemies.push(new Enemy(ROOM_MARGIN_X + 360, ROOM_MARGIN_Y + 140, 0));
  enemies.push(new Enemy(ROOM_MARGIN_X + 480, ROOM_MARGIN_Y + 160, 0));
  enemies.push(new Enemy(ROOM_MARGIN_X + 360, ROOM_MARGIN_Y + 320, 0));
  enemies.push(new Enemy(ROOM_MARGIN_X + 480, ROOM_MARGIN_Y + 320, 0));
  enemies.push(new Enemy(ROOM_MARGIN_X + 420, ROOM_MARGIN_Y + 230, 0));

  // Room 1 – 5 enemies
  enemies.push(new Enemy(ROOM_MARGIN_X + 220, ROOM_MARGIN_Y + 180, 1));
  enemies.push(new Enemy(ROOM_MARGIN_X + 400, ROOM_MARGIN_Y + 160, 1));
  enemies.push(new Enemy(ROOM_MARGIN_X + 240, ROOM_MARGIN_Y + 300, 1));
  enemies.push(new Enemy(ROOM_MARGIN_X + 380, ROOM_MARGIN_Y + 280, 1));
  enemies.push(new Enemy(ROOM_MARGIN_X + 300, ROOM_MARGIN_Y + 220, 1));
  enemies.push(new Enemy(ROOM_MARGIN_X + 340, ROOM_MARGIN_Y + 140, 1));

  // Room 2 – 5 enemies (this room’s demons also throw slow fireballs)
  enemies.push(new Enemy(ROOM_MARGIN_X + 220, ROOM_MARGIN_Y + 180, 2));
  enemies.push(new Enemy(ROOM_MARGIN_X + 400, ROOM_MARGIN_Y + 200, 2));
  enemies.push(new Enemy(ROOM_MARGIN_X + 240, ROOM_MARGIN_Y + 300, 2));
  enemies.push(new Enemy(ROOM_MARGIN_X + 380, ROOM_MARGIN_Y + 300, 2));
  enemies.push(new Enemy(ROOM_MARGIN_X + 320, ROOM_MARGIN_Y + 240, 2));
  enemies.push(new Enemy(ROOM_MARGIN_X + 280, ROOM_MARGIN_Y + 140, 2));

  // Room 3 – 5 enemies
  enemies.push(new Enemy(ROOM_MARGIN_X + 220, ROOM_MARGIN_Y + 180, 3));
  enemies.push(new Enemy(ROOM_MARGIN_X + 420, ROOM_MARGIN_Y + 220, 3));
  enemies.push(new Enemy(ROOM_MARGIN_X + 320, ROOM_MARGIN_Y + 160, 3));
  enemies.push(new Enemy(ROOM_MARGIN_X + 340, ROOM_MARGIN_Y + 280, 3));
  enemies.push(new Enemy(ROOM_MARGIN_X + 260, ROOM_MARGIN_Y + 240, 3));
  enemies.push(new Enemy(ROOM_MARGIN_X + 380, ROOM_MARGIN_Y + 200, 3));

  // Rooms 4–6 – 5 elite demons each (twice as big, twice as strong)
  // Place elite demons away from door centers so they don't immediately shove the player on entry.
  // Room 4 elites – clustered toward corners and mid-sides
  enemies.push(new Enemy(ROOM_MARGIN_X + 160, ROOM_MARGIN_Y + 120, 4, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 520, ROOM_MARGIN_Y + 120, 4, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 160, ROOM_MARGIN_Y + 360, 4, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 520, ROOM_MARGIN_Y + 360, 4, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 340, ROOM_MARGIN_Y + 260, 4, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 420, ROOM_MARGIN_Y + 220, 4, true));

  // Room 5 elites – scattered in a ring around the room
  enemies.push(new Enemy(ROOM_MARGIN_X + 160, ROOM_MARGIN_Y + 140, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 520, ROOM_MARGIN_Y + 140, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 160, ROOM_MARGIN_Y + 340, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 520, ROOM_MARGIN_Y + 340, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 320, ROOM_MARGIN_Y + 120, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 320, ROOM_MARGIN_Y + 360, 5, true));

  // Room 6 elites – similar scattering, with none sitting directly on door lines
  enemies.push(new Enemy(ROOM_MARGIN_X + 160, ROOM_MARGIN_Y + 140, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 520, ROOM_MARGIN_Y + 140, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 160, ROOM_MARGIN_Y + 340, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 520, ROOM_MARGIN_Y + 340, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 320, ROOM_MARGIN_Y + 200, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 420, ROOM_MARGIN_Y + 280, 6, true));

  // Room 7: BOSS only (no regular enemies), center of room, no blocks in this room
  enemies.push(new Boss(ROOM_MARGIN_X + ROOM_WIDTH / 2, ROOM_MARGIN_Y + ROOM_HEIGHT / 2, BOSS_ROOM));

  // Two enemies per room (0–6) drop hearts; two (different) drop golden coins
  for (let roomId = 0; roomId <= 6; roomId++) {
    const inRoom = enemies.filter((e) => e.roomId === roomId && !e.isBoss);
    if (inRoom[0]) inRoom[0].dropsHearts = true;
    if (inRoom[1]) inRoom[1].dropsHearts = true;
    if (inRoom[2]) inRoom[2].dropsCoins = true;
    if (inRoom[3]) inRoom[3].dropsCoins = true;
  }
}

// Room-local positions for "far side" of room (opposite the door the player entered). Five slots per entry for 4–6 enemies.
function getFarSideSlots(entryDoor) {
  const slots = {
    right: [{ lx: 100, ly: 120 }, { lx: 100, ly: 240 }, { lx: 100, ly: 360 }, { lx: 200, ly: 180 }, { lx: 200, ly: 300 }],
    left:  [{ lx: 540, ly: 120 }, { lx: 540, ly: 240 }, { lx: 540, ly: 360 }, { lx: 440, ly: 180 }, { lx: 440, ly: 300 }],
    bottom:[{ lx: 120, ly: 80 }, { lx: 280, ly: 80 }, { lx: 440, ly: 80 }, { lx: 200, ly: 160 }, { lx: 400, ly: 160 }],
    top:   [{ lx: 120, ly: 400 }, { lx: 280, ly: 400 }, { lx: 440, ly: 400 }, { lx: 200, ly: 320 }, { lx: 400, ly: 320 }],
  };
  return (slots[entryDoor] || slots.right).slice();
}

function repositionEnemiesToFarSide(roomId, entryDoor) {
  const roomEnemies = enemies.filter((e) => e.roomId === roomId && e.hp > 0);
  if (roomEnemies.length === 0) return;
  const slots = getFarSideSlots(entryDoor);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const used = new Set();
  roomEnemies.forEach((e, idx) => {
    let wx = 0, wy = 0;
    let found = false;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const key = `${s.lx},${s.ly}`;
      wx = ROOM_MARGIN_X + s.lx;
      wy = ROOM_MARGIN_Y + s.ly;
      const slotFree = !used.has(key) && !positionOverlapsObstacle(roomId, wx, wy, e.half);
      if (slotFree) {
        used.add(key);
        found = true;
        break;
      }
      if (!positionOverlapsObstacle(roomId, wx, wy, e.half)) {
        used.add(key);
        found = true;
        break;
      }
      for (let attempt = 0; attempt < 12; attempt++) {
        const offX = (Math.random() - 0.5) * 100;
        const offY = (Math.random() - 0.5) * 100;
        const nx = wx + offX, ny = wy + offY;
        const inRoom = nx >= ROOM_MARGIN_X + e.half && nx <= ROOM_MARGIN_X + ROOM_WIDTH - e.half &&
          ny >= ROOM_MARGIN_Y + e.half && ny <= ROOM_MARGIN_Y + ROOM_HEIGHT - e.half;
        if (inRoom && !positionOverlapsObstacle(roomId, nx, ny, e.half)) {
          wx = nx; wy = ny;
          found = true;
          break;
        }
      }
      if (found) break;
    }
    // If no slot worked, spread in a grid so we never stack all on one spot
    if (!found) {
      const cols = 3;
      const row = Math.floor(idx / cols), col = idx % cols;
      wx = ROOM_MARGIN_X + 120 + col * 180 + (e.half * 2);
      wy = ROOM_MARGIN_Y + 120 + row * 120 + (e.half * 2);
      wx = Math.min(wx, ROOM_MARGIN_X + ROOM_WIDTH - e.half - 10);
      wy = Math.min(wy, ROOM_MARGIN_Y + ROOM_HEIGHT - e.half - 10);
    }
    e.x = wx;
    e.y = wy;
  });
}

function resetGame() {
  setupRoomObstacles();
  setupEnemies();
  const startX = ROOM_MARGIN_X + 90;
  const startY = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
  player.reset(startX, startY, 0);
  // Enemies keep their initial positions from setupEnemies (no repositioning) so 5 stay visible per room
  projectiles = [];
  enemyProjectiles = [];
  deathScatterParticles = [];
  heartPickups = [];
  coinPickups = [];
  isGameOver = false;
  victory = false;
  overlayEl.classList.add("hidden");
  updateHUD();
}

const HEART_PICKUP_R = 14; // touch radius for collecting a heart
const COIN_PICKUP_R = 12; // touch radius for collecting a coin

function spawnHeartPickups(x, y, roomId, count) {
  if (count <= 0) return;
  const spacing = 22;
  const startX = x - ((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    heartPickups.push({
      x: startX + i * spacing,
      y,
      roomId,
    });
  }
}

function spawnCoinPickups(x, y, roomId, count) {
  if (count <= 0) return;
  const spacing = 20;
  const startX = x - ((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    coinPickups.push({
      x: startX + i * spacing,
      y,
      roomId,
    });
  }
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
  if (coinsValueEl) coinsValueEl.textContent = player.coins.toString();
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

function spawnBigExplosion(x, y) {
  explosions.push({
    x,
    y,
    radius: 10,
    maxRadius: 48,
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
        if (!enemy.isBoss && enemy.dropsHearts) {
          const count = enemy.size === ENEMY_ELITE_SIZE ? 2 : 1;
          spawnHeartPickups(enemy.x, enemy.y, enemy.roomId, count);
        }
        if (!enemy.isBoss && enemy.dropsCoins) {
          const count = enemy.size === ENEMY_ELITE_SIZE ? 2 : 1;
          spawnCoinPickups(enemy.x, enemy.y, enemy.roomId, count);
        }
      }
    }
  });
}

function updatePlayerMovement() {
  if (roomTransition.active) return; // no movement during room slide
  // Apply knockback first (slower, over multiple frames). Never allow ending inside a block.
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
    // Resolve any overlap with obstacles so the player never ends up inside a block
    const obstacles = roomObstacles.get(player.currentRoom) || [];
    for (let i = 0; i < 10; i++) {
      let resolved = false;
      for (const ob of obstacles) {
        if (rectIntersect(player, ob)) {
          resolvePlayerObstacle(player, ob);
          resolved = true;
        }
      }
      if (!resolved) break;
    }
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

function allNonBossEnemiesDead() {
  return enemies.every((e) => e.roomId === BOSS_ROOM || e.hp <= 0);
}

function startRoomTransition(toRoomId, direction) {
  roomTransition.active = true;
  roomTransition.phase = 1;
  roomTransition.progress = 0;
  roomTransition.direction = direction;
  roomTransition.toRoom = toRoomId;
  // Snap player to door center for clean slide
  const midX = ROOM_MARGIN_X + ROOM_WIDTH / 2;
  const midY = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
  if (direction === "left") {
    player.x = ROOM_MARGIN_X + player.boundsHalfW + 2;
    player.y = midY;
  } else if (direction === "right") {
    player.x = ROOM_MARGIN_X + ROOM_WIDTH - player.boundsHalfW - 2;
    player.y = midY;
  } else if (direction === "up") {
    player.x = midX;
    player.y = ROOM_MARGIN_Y + player.boundsHalfH + 2;
  } else {
    player.x = midX;
    player.y = ROOM_MARGIN_Y + ROOM_HEIGHT - player.boundsHalfH - 2;
  }
}

function updateRoomTransition() {
  if (!roomTransition.active) {
    cameraOffsetX = 0;
    cameraOffsetY = 0;
    return;
  }
  const t = roomTransition;
  t.progress += ROOM_TRANSITION_SPEED;

  if (t.phase === 1) {
    if (t.progress >= 1) {
      t.progress = 0;
      t.phase = 2;
      player.currentRoom = t.toRoom;
      // Reset remaining enemies in this room back to their original spawn points
      enemies.forEach((e) => {
        if (e.roomId === t.toRoom && e.hp > 0 && e.spawnX !== undefined) {
          e.x = e.spawnX;
          e.y = e.spawnY;
        }
      });
      const midX = ROOM_MARGIN_X + ROOM_WIDTH / 2;
      const midY = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
      if (t.direction === "left") {
        player.x = ROOM_MARGIN_X + ROOM_WIDTH - player.boundsHalfW - 10;
        player.y = midY;
      } else if (t.direction === "right") {
        player.x = ROOM_MARGIN_X + player.boundsHalfW + 10;
        player.y = midY;
      } else if (t.direction === "up") {
        player.x = midX;
        player.y = ROOM_MARGIN_Y + ROOM_HEIGHT - player.boundsHalfH - 10;
      } else {
        player.x = midX;
        player.y = ROOM_MARGIN_Y + player.boundsHalfH + 10;
      }
    }
  } else {
    if (t.progress >= 1) {
      t.active = false;
    }
  }

  // Compute camera offset: old room shifts opposite to player; new room slides into place
  const d = t.direction;
  if (t.phase === 1) {
    // Phase 1: current room slides away in the opposite direction the player is moving
    if (d === "left") {
      cameraOffsetX = t.progress * ROOM_WIDTH;
      cameraOffsetY = 0;
    } else if (d === "right") {
      cameraOffsetX = -t.progress * ROOM_WIDTH;
      cameraOffsetY = 0;
    } else if (d === "up") {
      cameraOffsetX = 0;
      cameraOffsetY = t.progress * ROOM_HEIGHT;
    } else {
      cameraOffsetX = 0;
      cameraOffsetY = -t.progress * ROOM_HEIGHT;
    }
  } else {
    if (d === "left") {
      cameraOffsetX = -(1 - t.progress) * ROOM_WIDTH;
      cameraOffsetY = 0;
    } else if (d === "right") {
      cameraOffsetX = (1 - t.progress) * ROOM_WIDTH;
      cameraOffsetY = 0;
    } else if (d === "up") {
      cameraOffsetX = 0;
      cameraOffsetY = -(1 - t.progress) * ROOM_HEIGHT;
    } else {
      cameraOffsetX = 0;
      cameraOffsetY = (1 - t.progress) * ROOM_HEIGHT;
    }
  }
}

function handleRoomTransitions() {
  if (roomTransition.active) return;

  const room = ROOMS[player.currentRoom];
  const leftDoorY = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
  const rightDoorY = leftDoorY;
  const topDoorX = ROOM_MARGIN_X + ROOM_WIDTH / 2;
  const bottomDoorX = topDoorX;
  const doorThickness = 60;

  const canEnterBossRoom = (newRoomId) => newRoomId !== BOSS_ROOM || allNonBossEnemiesDead();

  if (
    room.neighbors.left !== undefined &&
    canEnterBossRoom(room.neighbors.left) &&
    player.x - player.boundsHalfW <= ROOM_MARGIN_X + 4 &&
    Math.abs(player.y - leftDoorY) <= doorThickness / 2
  ) {
    startRoomTransition(room.neighbors.left, "left");
    return;
  }
  if (
    room.neighbors.right !== undefined &&
    canEnterBossRoom(room.neighbors.right) &&
    player.x + player.boundsHalfW >= ROOM_MARGIN_X + ROOM_WIDTH - 4 &&
    Math.abs(player.y - rightDoorY) <= doorThickness / 2
  ) {
    startRoomTransition(room.neighbors.right, "right");
    return;
  }
  if (
    room.neighbors.up !== undefined &&
    canEnterBossRoom(room.neighbors.up) &&
    player.y - player.boundsHalfH <= ROOM_MARGIN_Y + 4 &&
    Math.abs(player.x - topDoorX) <= doorThickness / 2
  ) {
    startRoomTransition(room.neighbors.up, "up");
    return;
  }
  if (
    room.neighbors.down !== undefined &&
    canEnterBossRoom(room.neighbors.down) &&
    player.y + player.boundsHalfH >= ROOM_MARGIN_Y + ROOM_HEIGHT - 4 &&
    Math.abs(player.x - bottomDoorX) <= doorThickness / 2
  ) {
    startRoomTransition(room.neighbors.down, "down");
  }
}

function moveEnemyWithCollision(enemy, moveX, moveY, obstacles) {
  if (moveX === 0 && moveY === 0) return;
  // Move X with collision
  if (moveX !== 0) {
    const oldX = enemy.x;
    enemy.x += moveX;
    for (const ob of obstacles) {
      if (rectIntersect(enemy, ob)) {
        enemy.x = oldX;
        break;
      }
    }
  }
  // Move Y with collision
  if (moveY !== 0) {
    const oldY = enemy.y;
    enemy.y += moveY;
    for (const ob of obstacles) {
      if (rectIntersect(enemy, ob)) {
        enemy.y = oldY;
        break;
      }
    }
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

    const obstacles = roomObstacles.get(enemy.roomId) || [];

    if (enemy.isBoss) {
      // Boss: bounce around inside the boss room instead of chasing directly
      const half = enemy.half;
      // Predict next position
      let nextX = enemy.x + enemy.vx;
      let nextY = enemy.y + enemy.vy;

      // Bounce on room walls (boss room has no obstacles)
      if (
        nextX - half < ROOM_MARGIN_X ||
        nextX + half > ROOM_MARGIN_X + ROOM_WIDTH
      ) {
        enemy.vx = -enemy.vx;
        nextX = enemy.x + enemy.vx;
      }
      if (
        nextY - half < ROOM_MARGIN_Y ||
        nextY + half > ROOM_MARGIN_Y + ROOM_HEIGHT
      ) {
        enemy.vy = -enemy.vy;
        nextY = enemy.y + enemy.vy;
      }

      enemy.x = nextX;
      enemy.y = nextY;
    } else if (enemy.isElite) {
      // Elite demons: keep wobble movement that tends toward the player
      const speed = enemy.speed !== undefined ? enemy.speed : ENEMY_SPEED;
      const subStep = speed / 3;
      for (let i = 0; i < 3; i++) {
        let dirX = 0;
        let dirY = 0;
        if (i === 0) {
          // First step: random direction
          const angle = Math.random() * Math.PI * 2;
          dirX = Math.cos(angle);
          dirY = Math.sin(angle);
        } else {
          // Next two steps: move toward the player
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const dist = Math.hypot(dx, dy);
          if (dist <= 4) break;
          dirX = dx / dist;
          dirY = dy / dist;
        }
        moveEnemyWithCollision(enemy, dirX * subStep, dirY * subStep, obstacles);
      }
    } else {
      // Small enemies: fast straight-line movers that bounce off walls, obstacles, and other enemies
      if (enemy.vx === undefined || enemy.vy === undefined) {
        const angle = Math.random() * Math.PI * 2;
        enemy.vx = Math.cos(angle) * SMALL_ENEMY_SPEED;
        enemy.vy = Math.sin(angle) * SMALL_ENEMY_SPEED;
      }
      const half = enemy.half;
      let nextX = enemy.x + enemy.vx;
      let nextY = enemy.y + enemy.vy;

      const tryCollide = (nx, ny) => {
        // Check room bounds
        if (
          nx - half < ROOM_MARGIN_X ||
          nx + half > ROOM_MARGIN_X + ROOM_WIDTH ||
          ny - half < ROOM_MARGIN_Y ||
          ny + half > ROOM_MARGIN_Y + ROOM_HEIGHT
        ) {
          return true;
        }
        // Check obstacles
        const temp = { x: nx, y: ny, half };
        for (const ob of obstacles) {
          if (rectIntersect(temp, ob)) return true;
        }
        // Check other enemies
        for (const other of enemies) {
          if (other === enemy || other.hp <= 0 || other.roomId !== enemy.roomId)
            continue;
          if (rectIntersect(temp, other)) return true;
        }
        return false;
      };

      // If we would collide, pick a new random direction
      if (tryCollide(nextX, nextY)) {
        let found = false;
        for (let attempt = 0; attempt < 10; attempt++) {
          const angle = Math.random() * Math.PI * 2;
          const vx = Math.cos(angle) * SMALL_ENEMY_SPEED;
          const vy = Math.sin(angle) * SMALL_ENEMY_SPEED;
          const candX = enemy.x + vx;
          const candY = enemy.y + vy;
          if (!tryCollide(candX, candY)) {
            enemy.vx = vx;
            enemy.vy = vy;
            nextX = candX;
            nextY = candY;
            found = true;
            break;
          }
        }
        if (!found) {
          // Nowhere safe to go this frame
          return;
        }
      }

      enemy.x = nextX;
      enemy.y = nextY;
    }

    // Boss: shoot a single large, slow fireball toward the player
    if (enemy.isBoss && enemy.fireballCooldown <= 0) {
      const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const vx = Math.cos(angle) * BOSS_FIREBALL_SPEED;
      const vy = Math.sin(angle) * BOSS_FIREBALL_SPEED;
      const startX = enemy.x + Math.cos(angle) * (enemy.half + BOSS_FIREBALL_SIZE);
      const startY = enemy.y + Math.sin(angle) * (enemy.half + BOSS_FIREBALL_SIZE);
      enemyProjectiles.push({
        x: startX,
        y: startY,
        vx,
        vy,
        roomId: enemy.roomId,
        size: BOSS_FIREBALL_SIZE,
        damage: BOSS_FIREBALL_DAMAGE,
        isBoss: true,
        alive: true,
        get half() { return this.size / 2; },
      });
      enemy.fireballCooldown = BOSS_FIREBALL_COOLDOWN;
    }
    // In the “fireball room”, demons periodically shoot a slow fireball at the player
    else if (
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
        damage: ENEMY_FIREBALL_DAMAGE,
        alive: true,
        get half() { return this.size / 2; },
      });
      enemy.fireballCooldown = ENEMY_FIREBALL_COOLDOWN;
    }
    if (enemy.fireballCooldown > 0) enemy.fireballCooldown--;

    // Damage player on contact and start knockback. Always 1 heart per contact; cooldown prevents stacked enemies from multi-hit.
    if (rectIntersect(enemy, player)) {
      if (player.contactDamageCooldown <= 0) {
        player.hp = Math.max(0, player.hp - 1);
        player.contactDamageCooldown = 45;  // ~0.75 sec before next contact can damage
      }

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
        if (enemy.hp <= 0) {
          spawnDeathScatter(enemy.x, enemy.y, enemy.roomId);
          if (!enemy.isBoss && enemy.dropsHearts) {
            const count = enemy.size === ENEMY_ELITE_SIZE ? 2 : 1;
            spawnHeartPickups(enemy.x, enemy.y, enemy.roomId, count);
          }
          if (!enemy.isBoss && enemy.dropsCoins) {
            const count = enemy.size === ENEMY_ELITE_SIZE ? 2 : 1;
            spawnCoinPickups(enemy.x, enemy.y, enemy.roomId, count);
          }
        }
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
      if (p.isBoss) spawnBigExplosion(p.x, p.y);
      p.alive = false;
      return;
    }
    for (const ob of obstacles) {
      if (rectIntersect(p, ob)) {
        if (p.isBoss) spawnBigExplosion(p.x, p.y);
        p.alive = false;
        return;
      }
    }
    if (rectIntersect(p, player) && player.currentRoom === p.roomId) {
      player.hp = Math.max(0, player.hp - 1);  // always 1 heart per enemy fireball hit
      if (p.isBoss) spawnBigExplosion(p.x, p.y);
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

function updateHeartPickups() {
  heartPickups = heartPickups.filter((h) => {
    if (h.roomId !== player.currentRoom) return true;
    const dx = player.x - h.x, dy = player.y - h.y;
    if (Math.hypot(dx, dy) < player.boundsHalfW + HEART_PICKUP_R) {
      player.hp = Math.min(PLAYER_MAX_HP, player.hp + 1);
      updateHUD();
      return false; // remove heart
    }
    return true;
  });
}

function updateCoinPickups() {
  coinPickups = coinPickups.filter((c) => {
    if (c.roomId !== player.currentRoom) return true;
    const dx = player.x - c.x, dy = player.y - c.y;
    if (Math.hypot(dx, dy) < player.boundsHalfW + COIN_PICKUP_R) {
      player.coins += 1;
      updateHUD();
      return false; // remove coin
    }
    return true;
  });
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
    ? "You defeated all the demons and the Boss!"
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

function drawHeartPickups() {
  heartPickups.forEach((h) => {
    if (h.roomId !== player.currentRoom) return;
    ctx.fillStyle = "#c62828";
    ctx.beginPath();
    ctx.arc(h.x, h.y, HEART_PICKUP_R - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8b0000";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawCoinPickups() {
  coinPickups.forEach((c) => {
    if (c.roomId !== player.currentRoom) return;
    const r = COIN_PICKUP_R - 2;
    const grad = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, 0, c.x, c.y, r);
    grad.addColorStop(0, "#ffd54f");
    grad.addColorStop(0.6, "#ffc107");
    grad.addColorStop(1, "#ff8f00");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f57f17";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawEnemyProjectiles() {
  enemyProjectiles.forEach((p) => {
    if (p.roomId !== player.currentRoom || !p.alive) return;
    if (p.isBoss) {
      // Large meteor-style boss fireball: orange core, yellow edge, long tail
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const dirX = p.vx / speed;
      const dirY = p.vy / speed;

      const tailLength = p.size * 3;
      const tailStartX = p.x - dirX * p.half;
      const tailStartY = p.y - dirY * p.half;
      const tailEndX = tailStartX - dirX * tailLength;
      const tailEndY = tailStartY - dirY * tailLength;

      const tailGradient = ctx.createLinearGradient(
        tailStartX,
        tailStartY,
        tailEndX,
        tailEndY
      );
      tailGradient.addColorStop(0, "rgba(255, 215, 64, 0.9)");
      tailGradient.addColorStop(1, "rgba(255, 152, 0, 0)");

      ctx.strokeStyle = tailGradient;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(tailStartX, tailStartY);
      ctx.lineTo(tailEndX, tailEndY);
      ctx.stroke();

      const radial = ctx.createRadialGradient(
        p.x,
        p.y,
        p.half * 0.2,
        p.x,
        p.y,
        p.half
      );
      radial.addColorStop(0, "#ff9800"); // orange core
      radial.addColorStop(1, "#ffeb3b"); // yellow edge

      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.half, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#b71c1c";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.half, 0, Math.PI * 2);
      ctx.fill();
    }
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
    if (player.contactDamageCooldown > 0) player.contactDamageCooldown--;
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
    updateHeartPickups();
    updateCoinPickups();
    updateExplosions();
    updateDeathScatter();
    checkWinCondition();
    updateRoomTransition();
  }

  ctx.save();
  ctx.translate(cameraOffsetX, cameraOffsetY);
  drawRoomBackground();
  drawObstacles();
  drawEnemies();
  drawHeartPickups();
  drawCoinPickups();
  drawDeathScatter();
  drawEnemyProjectiles();
  drawProjectiles();
  drawExplosions();
  drawPlayer();
  drawUIHints();
  ctx.restore();

  updateHUD();

  requestAnimationFrame(gameLoop);
}

// Initialize
showStartScreen();
requestAnimationFrame(gameLoop);

