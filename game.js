"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// HUD elements
const playerHeartsEl = document.getElementById("player-hearts");
const stripSlotsEl = document.getElementById("strip-slots");
const enemiesValueEl = document.getElementById("enemies-value");
const playerCoinsEl = document.getElementById("player-coins");
const overlayEl = document.getElementById("message-overlay");
const messageTextEl = document.getElementById("message-text");
const restartButton = document.getElementById("restart-button");
const gameMusicEl = document.getElementById("game-music");
const swordSwingEl = document.getElementById("sword-swing");
const fireballWhooshEl = document.getElementById("fireball-whoosh");
const coinCollectEl = document.getElementById("coin-collect");
const itemEquipEl = document.getElementById("item-equip");
const heartPickupEl = document.getElementById("heart-pickup");
const bossChamberEl = document.getElementById("boss-chamber");
const secretDoorOpenEl = document.getElementById("secret-door-open");
const trapDoorOpenEl = document.getElementById("trapdoor-open");
const characterSelectClickEl = document.getElementById("character-select-click");
const ROOM_WIDTH = 640;
const ROOM_HEIGHT = 480;
const MINIMAP_PANEL_WIDTH = 140;
const ROOM_MARGIN_X = MINIMAP_PANEL_WIDTH + (canvas.width - MINIMAP_PANEL_WIDTH - ROOM_WIDTH) / 2;
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
const ENEMY_FIREBALL_COOLDOWN = 90;   // frames between shots per demon (unused in fireball room)
const DEMON_FIREBALL_COOLDOWN = 60 * 5; // 5 seconds between single fireball per demon in room 2
const ENEMY_FIREBALL_SIZE = 8;
const ENEMY_FIREBALL_DAMAGE = 1;

const BOSS_ROOM = 7;  // room furthest from spawn; only enterable when all other enemies dead; exactly 1 enemy (the boss)
const BOSS_SIZE = ENEMY_ELITE_SIZE * 2;   // twice as big as elite
const BOSS_HP = 50;
const BOSS_DAMAGE = 2;  // 2 hearts on contact
const BOSS_SPEED = ENEMY_SPEED * 0.75;    // half as fast as previous (was 1.5x)
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
// All hero sprite sheets (hero.png, amira, faaris, radiyya) use the same 4×4 layout:
//   Row 0 (top):    4 frames — character walking TOWARDS the player (down on screen)
//   Row 1:          4 frames — character moving AWAY from the player (up on screen)
//   Row 2:          4 frames — character walking LEFT
//   Row 3:          4 frames — character walking RIGHT
// Col 1 is preferred idle; cols 0,2,3 are used for walk cycle.
const HERO_SPRITE_COLS = 4;
const HERO_SPRITE_ROWS = 4;

const HERO_DIR_DOWN = 0;   // towards player (row 0)
const HERO_DIR_UP = 1;     // away from player (row 1)
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

// Amira hero sprite sheet — same 4×4 layout (row 0=towards player, 1=away, 2=left, 3=right)
const amiraHeroImage = new Image();
amiraHeroImage.src = "amira hero sprite sheet.png";
let amiraHeroLoaded = false;
let amiraHeroFrameWidth = 0;
let amiraHeroFrameHeight = 0;
amiraHeroImage.onload = () => {
  amiraHeroFrameWidth = amiraHeroImage.width / HERO_SPRITE_COLS;
  amiraHeroFrameHeight = amiraHeroImage.height / HERO_SPRITE_ROWS;
  amiraHeroLoaded = true;
};

// Faaris hero sprite sheet — same 4×4 layout (row 0=towards player, 1=away, 2=left, 3=right)
const faarisHeroImage = new Image();
faarisHeroImage.src = "faaris hero sprite sheet.png";
let faarisHeroLoaded = false;
let faarisHeroFrameWidth = 0;
let faarisHeroFrameHeight = 0;
faarisHeroImage.onload = () => {
  faarisHeroFrameWidth = faarisHeroImage.width / HERO_SPRITE_COLS;
  faarisHeroFrameHeight = faarisHeroImage.height / HERO_SPRITE_ROWS;
  faarisHeroLoaded = true;
};

// Radiyya hero sprite sheet — same 4×4 layout (row 0=towards player, 1=away, 2=left, 3=right)
const radiyyaHeroImage = new Image();
radiyyaHeroImage.src = "radiyya hero sprite sheet.png";
let radiyyaHeroLoaded = false;
let radiyyaHeroFrameWidth = 0;
let radiyyaHeroFrameHeight = 0;
radiyyaHeroImage.onload = () => {
  radiyyaHeroFrameWidth = radiyyaHeroImage.width / HERO_SPRITE_COLS;
  radiyyaHeroFrameHeight = radiyyaHeroImage.height / HERO_SPRITE_ROWS;
  radiyyaHeroLoaded = true;
};

// Which hero sheet to draw: 'hero' | 'amira' | 'faaris' | 'radiyya'
let currentHeroSheet = "hero";

// Character select at start: 0 = Faaris, 1 = Amira, 2 = Radiyya
let characterSelectActive = true;
let selectedCharacterIndex = 0;
const CHARACTER_OPTIONS = [
  { id: "faaris", name: "FAARIS" },
  { id: "amira", name: "AMIRA" },
  { id: "radiyya", name: "RADIYYA" },
];

const shopkeeperImage = new Image();
shopkeeperImage.src = "shopkeeper.png";
let shopkeeperLoaded = false;
const SHOPKEEPER_SPRITE_COLS = 4;
const SHOPKEEPER_SPRITE_ROWS = 4;
let shopkeeperFrameWidth = 0;
let shopkeeperFrameHeight = 0;
shopkeeperImage.onload = () => {
  shopkeeperFrameWidth = shopkeeperImage.width / SHOPKEEPER_SPRITE_COLS;
  shopkeeperFrameHeight = shopkeeperImage.height / SHOPKEEPER_SPRITE_ROWS;
  shopkeeperLoaded = true;
};

// Goblin enemy sprite sheet (4 cols × 4 rows):
// Row 0: walking towards player (down), Row 1: away (up), Row 2: left, Row 3: right
const goblinImage = new Image();
goblinImage.onerror = function () {
  this.onerror = null;
  this.src = "goblin1.jpg";
};
goblinImage.src = "goblin1.png";
let goblinLoaded = false;
const GOBLIN_SPRITE_COLS = 4;
const GOBLIN_SPRITE_ROWS = 4;
let goblinFrameWidth = 0;
let goblinFrameHeight = 0;
goblinImage.onload = () => {
  goblinFrameWidth = goblinImage.width / GOBLIN_SPRITE_COLS;
  goblinFrameHeight = goblinImage.height / GOBLIN_SPRITE_ROWS;
  goblinLoaded = true;
};

// Goblin2: small demons only, 4×4 same layout; draw at half cell size
const goblin2Image = new Image();
goblin2Image.onerror = function () {
  this.onerror = null;
  this.src = "goblin2.jpg";
};
goblin2Image.src = "goblin2.png";
let goblin2Loaded = false;
let goblin2FrameWidth = 0;
let goblin2FrameHeight = 0;
goblin2Image.onload = () => {
  goblin2FrameWidth = goblin2Image.width / 4;
  goblin2FrameHeight = goblin2Image.height / 4;
  goblin2Loaded = true;
};

const goblin3Image = new Image();
goblin3Image.onerror = function () {
  this.onerror = null;
  this.src = "goblin3.jpg";
};
goblin3Image.src = "goblin3.png";
let goblin3Loaded = false;
let goblin3FrameWidth = 0;
let goblin3FrameHeight = 0;
goblin3Image.onload = () => {
  goblin3FrameWidth = goblin3Image.width / 4;
  goblin3FrameHeight = goblin3Image.height / 4;
  goblin3Loaded = true;
};

// Goblin3 spritesheet (4×4): row 0 = walking towards player (down), row 1 = away (up), row 2 = left, row 3 = right.
// angle = atan2(vy, vx) = movement direction in screen space.
function goblin3AngleToRow(angle) {
  if (angle >= -Math.PI / 4 && angle < Math.PI / 4) return 3;   // right
  if (angle >= Math.PI / 4 && angle < (3 * Math.PI) / 4) return 0;  // down (towards player)
  if (angle >= (3 * Math.PI) / 4 || angle < (-3 * Math.PI) / 4) return 2;  // left
  return 1;  // up (away from player)
}

function goblinFacingAngleToRow(angle) {
  if (angle >= -Math.PI / 4 && angle < Math.PI / 4) return 3;
  if (angle >= Math.PI / 4 && angle < (3 * Math.PI) / 4) return 0;
  if (angle >= (3 * Math.PI) / 4 || angle < (-3 * Math.PI) / 4) return 2;
  return 1;
}

// Animation state for the hero sprite
const heroAnim = {
  dir: HERO_DIR_DOWN,
  moving: false,
  walkFrameIndex: 0, // index into per-direction walking sequence
  frameCounter: 0,
  frameInterval: 8, // frames between animation steps
};

// Room layout: row0 [9][8], row1 [0][1][2][3], row2 [4][5][6][7]. Room 7 = boss.
const ROOMS = [
  { id: 0, neighbors: { up: 8, right: 1, down: 4 } },
  { id: 1, neighbors: { left: 0, right: 2, down: 5 } },
  { id: 2, neighbors: { left: 1, right: 3, down: 6 } },
  { id: 3, neighbors: { left: 2, down: 7 } },
  { id: 4, neighbors: { up: 0, right: 5 } },
  { id: 5, neighbors: { up: 1, left: 4, right: 6 } },
  { id: 6, neighbors: { up: 2, left: 5, right: 7 } },
  { id: 7, neighbors: { up: 3, left: 6 } },
  { id: 8, neighbors: { left: 9, down: 0 } },
  { id: 9, neighbors: { right: 8 } },
  { id: 10, neighbors: { up: 9 } }, // hidden room (not on minimap); exit via top
  { id: 11, neighbors: { up: 2 } }, // secret room 2 (under room 2 floor); exit via top
];
const HIDDEN_ROOM = 10;
const SECRET_ROOM_2 = 11;
// Secret room shop: three items in the middle of room 10
const SHOP_CENTER_X = ROOM_MARGIN_X + ROOM_WIDTH / 2;
const SHOP_CENTER_Y = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
const SHOP_ITEM_SPACING = 90;
const SHOP_ITEM_R = 36; // interaction / draw radius per item
const SHOP_ITEMS = [
  { id: "shield", name: "Wooden Shield", price: 4, offsetX: -SHOP_ITEM_SPACING, offsetY: 0 },
  { id: "key", name: "Key", price: 6, offsetX: 0, offsetY: 0 },
  { id: "potion", name: "Healing Potion", price: 3, offsetX: SHOP_ITEM_SPACING, offsetY: 0 },
];
let shopSold = { shield: false, key: false, potion: false };

const SHOPKEEPER_SPEED = 1.2;
const SHOPKEEPER_SIZE = 48;
const SHOPKEEPER_WAYPOINT_R = 18;
const SHOPKEEPER_SQUARE = [
  { x: ROOM_MARGIN_X + 100, y: ROOM_MARGIN_Y + 90 },
  { x: ROOM_MARGIN_X + ROOM_WIDTH - 100, y: ROOM_MARGIN_Y + 90 },
  { x: ROOM_MARGIN_X + ROOM_WIDTH - 100, y: ROOM_MARGIN_Y + ROOM_HEIGHT - 90 },
  { x: ROOM_MARGIN_X + 100, y: ROOM_MARGIN_Y + ROOM_HEIGHT - 90 },
];
const SHOPKEEPER_REST = {
  x: ROOM_MARGIN_X + ROOM_WIDTH / 2,
  y: ROOM_MARGIN_Y + ROOM_HEIGHT * 0.65,
};
const COUNTER_TOP = SHOP_CENTER_Y - 10;
const COUNTER_BOTTOM = SHOP_CENTER_Y + 14;
const SHOPKEEPER_HALF = 24;
const SHOPKEEPER_COUNTER_Y_MIN = COUNTER_BOTTOM + SHOPKEEPER_HALF;
let shopkeeper = {
  x: ROOM_MARGIN_X + 100,
  y: ROOM_MARGIN_Y + 90,
  state: "square",
  waypointIndex: 0,
  facingAngle: 0,
  walkFrameIndex: 0,
  walkFrameCounter: 0,
};

const SHOPKEEPER_CAPTION_PHRASES = [
  "Finding everything alright there?",
  "Can I help you with anything?",
  "Feel free to look.",
  "Yes, that's an excellent item and it's on sale.",
];
const SHOPKEEPER_NO_WEAPON_PHRASES = [
  "There's no need for that.",
  "That's not necessary beta.",
];
let shopkeeperCaptionText = "";
let shopkeeperCaptionUntil = 0;
let shopkeeperCaptionIndex = 0;
let shopkeeperCaptionNextAt = 0;
let gameFrameCount = 0;
const SHOPKEEPER_CAPTION_INTERVAL = 300;
const SHOPKEEPER_CAPTION_DURATION = 180;

const ROOM9_CAVERN_DOOR_CX = ROOM_MARGIN_X + ROOM_WIDTH / 2;
const ROOM9_CAVERN_DOOR_CY = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
const ROOM9_CAVERN_DOOR_W = 100;
const ROOM9_CAVERN_DOOR_H = 140;
const ROOM9_DOOR_OPEN_DIST = 90;
const ROOM9_DOOR_SWING_FRAMES = 40;
const CAVERN_DESCEND_FRAMES = 90;
const CAVERN_FADE_FRAMES = 35;

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
    this.currentRoom = 9;
    this.attackCooldown = 0;
    this.swordSwingTimer = 0; // counts down while sword is visually swinging
    this.knockbackRemaining = 0;
    this.knockbackNx = 0;
    this.knockbackNy = 0;
    this.contactDamageCooldown = 0;  // frames until next contact can deal 1 heart (prevents multi-enemy stack from one-shotting)
    this.coins = 3;
    this.hasShield = false;
    this.shieldHp = 0;       // 1 = blocks one hit, then shield is gone
    this.hasBossKey = false;
    this.inventory = [];     // items from hidden room: 'key', 'potion'
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
    this.coins = 3;
    this.hasShield = false;
    this.shieldHp = 0;
    this.hasBossKey = false;
    this.inventory = [];
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
    // Elite: staggered movement – 2 steps random, then 3 steps toward hero (repeat)
    if (isElite) {
      this.eliteStepPhase = "random";
      this.eliteStepsLeft = 2;
      this.eliteRandomAngle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(this.eliteRandomAngle);
      this.vy = Math.sin(this.eliteRandomAngle);
    }
    // Small (non-elite) enemies move fast in straight lines and bounce
    if (!isElite) {
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * SMALL_ENEMY_SPEED;
      this.vy = Math.sin(angle) * SMALL_ENEMY_SPEED;
    }
  }

  draw() {
    if (this.isElite) {
      if (goblinLoaded && goblinFrameWidth > 0) {
        const angle = this.vx !== 0 || this.vy !== 0
          ? Math.atan2(this.vy, this.vx)
          : Math.PI / 2;
        const row = goblinFacingAngleToRow(angle);
        const col = Math.floor((gameFrameCount + this.x + this.y) / 8) % GOBLIN_SPRITE_COLS;
        const sx = col * goblinFrameWidth;
        const sy = row * goblinFrameHeight;
        const targetW = this.size;
        const scale = targetW / goblinFrameWidth;
        const targetH = goblinFrameHeight * scale;
        if (this.hitFlashTimer > 0) {
          ctx.globalAlpha = 0.5;
          this.hitFlashTimer--;
        }
        ctx.drawImage(
          goblinImage,
          sx, sy, goblinFrameWidth, goblinFrameHeight,
          this.x - targetW / 2, this.y - targetH / 2, targetW, targetH
        );
        ctx.globalAlpha = 1;
      } else {
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
    } else {
      if (goblin2Loaded && goblin2FrameWidth > 0) {
        const angle = this.vx !== 0 || this.vy !== 0
          ? Math.atan2(this.vy, this.vx)
          : Math.PI / 2;
        const row = goblinFacingAngleToRow(angle);
        const col = Math.floor((gameFrameCount + this.x + this.y) / 8) % 4;
        const sx = col * goblin2FrameWidth;
        const sy = row * goblin2FrameHeight;
        const targetW = PLAYER_SIZE * 2;
        const scale = targetW / goblin2FrameWidth;
        const targetH = goblin2FrameHeight * scale;
        if (this.hitFlashTimer > 0) {
          ctx.globalAlpha = 0.5;
          this.hitFlashTimer--;
        }
        ctx.drawImage(
          goblin2Image,
          sx, sy, goblin2FrameWidth, goblin2FrameHeight,
          this.x - targetW / 2, this.y - targetH / 2, targetW, targetH
        );
        ctx.globalAlpha = 1;
      } else {
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
    if (goblin3Loaded && goblin3FrameWidth > 0) {
      const angle = this.vx !== 0 || this.vy !== 0
        ? Math.atan2(this.vy, this.vx)
        : Math.PI / 2;
      const row = goblin3AngleToRow(angle);
      const col = Math.floor((gameFrameCount + this.x + this.y) / 8) % 4;
      const sx = col * goblin3FrameWidth;
      const sy = row * goblin3FrameHeight;
      const targetW = this.size;
      const scale = targetW / goblin3FrameWidth;
      const targetH = goblin3FrameHeight * scale;
      if (this.hitFlashTimer > 0) {
        ctx.globalAlpha = 0.5;
        this.hitFlashTimer--;
      }
      ctx.drawImage(
        goblin3Image,
        sx, sy, goblin3FrameWidth, goblin3FrameHeight,
        this.x - targetW / 2, this.y - targetH / 2, targetW, targetH
      );
      ctx.globalAlpha = 1;
    } else {
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
  [8, [{ x: 320, y: 240, r: SPAWN_ZONE_R }, { x: 200, y: 140, r: SPAWN_ZONE_R }, { x: 420, y: 160, r: SPAWN_ZONE_R }, { x: 220, y: 320, r: SPAWN_ZONE_R }, { x: 400, y: 300, r: SPAWN_ZONE_R }, ...FAR_SIDE_SLOTS_ALL]],
  [9, [{ x: 320, y: 240, r: SPAWN_ZONE_R }, { x: 200, y: 140, r: SPAWN_ZONE_R }, { x: 420, y: 160, r: SPAWN_ZONE_R }, { x: 220, y: 320, r: SPAWN_ZONE_R }, { x: 400, y: 300, r: SPAWN_ZONE_R }, ...FAR_SIDE_SLOTS_ALL]],
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

  // Room 0 – clusters of blocks (kept clear of doorway zones: top 275–365 y<55, right x>585, bottom 275–365 y>425)
  add(0, 120, 100, 28); add(0, 148, 100, 28); add(0, 176, 100, 28); add(0, 204, 100, 28); add(0, 232, 100, 28); // block of 5
  add(0, 480, 140, 32); add(0, 512, 140, 32); add(0, 544, 140, 32); // block of 3
  add(0, 180, 340, 26); add(0, 206, 340, 26); add(0, 232, 340, 26); add(0, 258, 340, 26); // block of 4
  add(0, 420, 320, 30); add(0, 450, 320, 30); add(0, 480, 320, 30); add(0, 510, 320, 30); add(0, 540, 320, 30); // block of 5
  add(0, 320, 220, 28); add(0, 348, 220, 28); add(0, 376, 220, 28); // block of 3
  add(0, 80, 260, 26); add(0, 106, 260, 26); add(0, 132, 260, 26); add(0, 158, 260, 26); // cluster left
  add(0, 510, 260, 28); add(0, 538, 260, 28); add(0, 566, 260, 28); // cluster right (moved left of door x=585)
  add(0, 260, 98, 26); add(0, 286, 98, 26); add(0, 312, 98, 26); add(0, 338, 98, 26); add(0, 364, 98, 26); // cluster top (moved below door y<55)
  add(0, 55, 55, 24); add(0, 79, 55, 24); add(0, 103, 55, 24); // corner cluster
  add(0, 518, 70, 24); add(0, 542, 70, 24); add(0, 566, 70, 24); // corner cluster (below top door, left of right door)

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

  // Room 2 – question mark in center (dot is trigger only, drawn separately)
  add(2, 80, 80, 28); add(2, 108, 80, 28); add(2, 136, 80, 28); add(2, 164, 80, 28); add(2, 192, 80, 28); // block of 5
  add(2, 540, 140, 30); add(2, 570, 140, 30); add(2, 600, 140, 30); add(2, 618, 140, 30); // block of 4
  add(2, 140, 380, 26); add(2, 166, 380, 26); add(2, 192, 380, 26); add(2, 218, 380, 26); add(2, 244, 380, 26); add(2, 270, 380, 26); // block of 6
  add(2, 460, 340, 32); add(2, 492, 340, 32); add(2, 524, 340, 32); add(2, 556, 340, 32); // block of 4
  add(2, 80, 260, 26); add(2, 106, 260, 26); add(2, 132, 260, 26); add(2, 158, 260, 26); // cluster left
  add(2, 580, 260, 28); add(2, 608, 260, 28); add(2, 622, 260, 28); // cluster right
  add(2, 55, 55, 24); add(2, 79, 55, 24); add(2, 103, 55, 24); add(2, 127, 55, 24); // corner
  add(2, 55, 425, 24); add(2, 79, 425, 24); add(2, 103, 425, 24); // corner
  // Question mark (middle): add directly so spawn-zone check doesn't reject; dot drawn separately as trigger
  (function () {
    const r2 = roomObstacles.get(2) || [];
    const q = (rx, ry, sz) => r2.push(createObstacle(ROOM_MARGIN_X + rx, ROOM_MARGIN_Y + ry, sz));
    q(296, 168, 24); q(320, 168, 24);
    q(272, 192, 24); q(344, 192, 24);
    q(272, 216, 24); q(344, 216, 24);
    q(296, 240, 24); q(296, 264, 24); q(272, 288, 24);
    roomObstacles.set(2, r2);
  })();

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

  // Room 8 – above room 0
  add(8, 120, 100, 28); add(8, 148, 100, 28); add(8, 176, 100, 28); add(8, 204, 100, 28);
  add(8, 480, 120, 30); add(8, 510, 120, 30); add(8, 540, 120, 30);
  add(8, 200, 360, 26); add(8, 226, 360, 26); add(8, 252, 360, 26); add(8, 278, 360, 26);
  add(8, 400, 320, 28); add(8, 428, 320, 28); add(8, 456, 320, 28); add(8, 484, 320, 28);
  add(8, 320, 220, 28); add(8, 348, 220, 28); add(8, 376, 220, 28);
  add(8, 80, 260, 26); add(8, 106, 260, 26); add(8, 132, 260, 26);
  add(8, 560, 260, 28); add(8, 588, 260, 28);
  add(8, 55, 55, 24); add(8, 79, 55, 24); add(8, 537, 55, 24); add(8, 561, 55, 24);

  // Room 9 – left of room 8
  add(9, 120, 100, 28); add(9, 148, 100, 28); add(9, 176, 100, 28);
  add(9, 480, 140, 30); add(9, 510, 140, 30); add(9, 540, 140, 30);
  add(9, 180, 340, 26); add(9, 206, 340, 26); add(9, 232, 340, 26);
  add(9, 420, 320, 30); add(9, 450, 320, 30); add(9, 480, 320, 30);
  add(9, 300, 200, 28); add(9, 328, 200, 28); add(9, 356, 200, 28);
  add(9, 80, 260, 26); add(9, 106, 260, 26); add(9, 560, 260, 28);
  add(9, 55, 55, 24); add(9, 79, 55, 24); add(9, 537, 425, 24); add(9, 561, 425, 24);

  // Room 10 – hidden room (no blocks); shopkeeper walks square then faces hero at center

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
let sealedDoorCaption = false; // true when player is at a sealed (boss) door
let bossTypedSequence = "";   // type "boss" to warp to boss chamber
// Room 9 cavern door: closed -> swinging -> open; then descending sequence to hidden room
let room9DoorState = "closed"; // 'closed' | 'swinging' | 'open'
let room9DoorSwingProgress = 0;
let cavernSequence = "none"; // 'none' | 'descending' | 'fadeout' | 'appearing' | 'ascending'
let cavernProgress = 0;
let cavernBlackAlpha = 0;
// Room 2 secret: push inside ? opens large trap door; stairs lead to secret room 2
let room2TrapDoorState = "closed"; // 'closed' | 'opening' | 'open'
let room2TrapDoorProgress = 0;
let room2SecretSequence = "none";  // 'none' | 'descending' | 'ascending'
let room2SecretProgress = 0;
let room2QuestionShiftActive = false;
let room2QuestionShiftProgress = 0;
let room2QuestionShiftDx = 0;
let room2QuestionShiftDy = 0;
const ROOM2_INSIDE_LEFT = 282;     // inside of ? trigger (room-local)
const ROOM2_INSIDE_TOP = 182;
const ROOM2_INSIDE_W = 52;
const ROOM2_INSIDE_H = 100;
const ROOM2_DOT_X = 296;
const ROOM2_DOT_Y = 312;
const ROOM2_QUESTION_CENTER_X = 308;
const ROOM2_QUESTION_CENTER_Y = 228;
const ROOM2_QUESTION_SHIFT_PIXELS = 100;
const ROOM2_QUESTION_SHIFT_FRAMES = 30;
const ROOM2_DOORWAY_LEFT = 522;
const ROOM2_DOORWAY_TOP = 52;
const ROOM2_DOORWAY_W = 88;
const ROOM2_DOORWAY_H = 48;
const ROOM2_TRAPDOOR_OPEN_FRAMES = 45;
const ROOM2_DESCEND_FRAMES = 90;
const ROOM2_STAIRS_STEP_W = 70;
const ROOM2_STAIRS_STEP_H = 10;
const ROOM2_STAIRS_NUM = 12;
let victory = false;
let hasStarted = false; // becomes true after first start
let selectedStripIndex = 0; // 0=fireball, 1=sword, 2+=inventory; R=cycle, Spacebar=select/use

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

  // Room 5 elites – kept well away from all three doors (top, left, right)
  enemies.push(new Enemy(ROOM_MARGIN_X + 260, ROOM_MARGIN_Y + 200, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 380, ROOM_MARGIN_Y + 200, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 260, ROOM_MARGIN_Y + 280, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 380, ROOM_MARGIN_Y + 280, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 320, ROOM_MARGIN_Y + 220, 5, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 320, ROOM_MARGIN_Y + 260, 5, true));

  // Room 6 elites – similar scattering, with none sitting directly on door lines
  enemies.push(new Enemy(ROOM_MARGIN_X + 160, ROOM_MARGIN_Y + 140, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 520, ROOM_MARGIN_Y + 140, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 160, ROOM_MARGIN_Y + 340, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 520, ROOM_MARGIN_Y + 340, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 320, ROOM_MARGIN_Y + 200, 6, true));
  enemies.push(new Enemy(ROOM_MARGIN_X + 420, ROOM_MARGIN_Y + 280, 6, true));

  // Room 8 and 9: no enemies (player starts in 9)

  // Room 7: BOSS only (no regular enemies), center of room, no blocks in this room
  enemies.push(new Boss(ROOM_MARGIN_X + ROOM_WIDTH / 2, ROOM_MARGIN_Y + ROOM_HEIGHT / 2, BOSS_ROOM));

  // Two enemies per room (0–6; skip 7 boss, 8 and 9 have no enemies) drop hearts; two (different) drop golden coins
  for (const roomId of [0, 1, 2, 3, 4, 5, 6]) {
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
  player.reset(startX, startY, 9);
  // Enemies keep their initial positions from setupEnemies (no repositioning) so 5 stay visible per room
  projectiles = [];
  enemyProjectiles = [];
  deathScatterParticles = [];
  heartPickups = [];
  coinPickups = [];
  isGameOver = false;
  victory = false;
  room9DoorState = "closed";
  room9DoorSwingProgress = 0;
  cavernSequence = "none";
  cavernProgress = 0;
  cavernBlackAlpha = 0;
  room2TrapDoorState = "closed";
  room2TrapDoorProgress = 0;
  room2SecretSequence = "none";
  room2SecretProgress = 0;
  shopSold = { shield: false, key: false, potion: false };
  selectedStripIndex = 0;
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
  const n = Math.max(0, Math.ceil(player.hp));  // fractional HP when shield halves damage
  playerHeartsEl.innerHTML = n ? "<span class=\"heart\" aria-hidden=\"true\">♥</span>".repeat(n) : "";
  playerHeartsEl.setAttribute("aria-label", `Health: ${player.hp} hearts`);
  const aliveEnemies = enemies.filter((e) => e.hp > 0).length;
  enemiesValueEl.textContent = aliveEnemies.toString();
  const c = Math.max(0, player.coins);
  playerCoinsEl.innerHTML = c ? "<span class=\"coin\" aria-hidden=\"true\">●</span>".repeat(c) : "";
  playerCoinsEl.setAttribute("aria-label", `Coins: ${c}`);

  // Strip: weapons + inventory (R cycle, Spacebar select/use)
  if (stripSlotsEl) {
    const inv = player.inventory || [];
    const totalSlots = 2 + inv.length;
    if (totalSlots > 0) {
      if (selectedStripIndex >= totalSlots) selectedStripIndex = totalSlots - 1;
      if (selectedStripIndex < 0) selectedStripIndex = 0;
    }
    const slots = [
      { type: "fireball", name: "Fireball", icon: "\uD83D\uDD25" },
      { type: "sword", name: "Sword", icon: "\u2694\uFE0F" },
      ...inv.map((item, i) => ({
        type: item,
        name: item === "key" ? "Key" : "Potion",
        icon: item === "key" ? "\uD83D\uDD11" : "\uD83E\uDDEA",
        invIndex: i,
      })),
    ];
    stripSlotsEl.innerHTML = slots
      .map(
        (s, i) =>
          `<div class="strip-slot${i === selectedStripIndex ? " selected" : ""}" data-slot-index="${i}" data-type="${s.type}"${s.invIndex !== undefined ? ` data-inv-index="${s.invIndex}"` : ""} title="R to cycle, Spacebar to select">` +
          `<span class="strip-slot-icon" aria-hidden="true">${s.icon}</span>` +
          `<span class="strip-slot-name">${s.name}</span></div>`
      )
      .join("");
  }
}

const startHintEl = document.getElementById("start-hint");

function showStartScreen() {
  messageTextEl.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>How to play</strong></div>
    <div>To move, press WASD or ARROW keys.</div>
    <div>R to cycle weapons & inventory. SPACEBAR to select/use.</div>
  `;
  restartButton.textContent = "Start";
  startHintEl.textContent = "Press SPACEBAR to START";
  overlayEl.classList.remove("hidden");
}

function showCharacterSelectScreen() {
  overlayEl.classList.add("hidden");
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

  if (characterSelectActive) {
    if (e.key === "ArrowLeft" || e.key === "Left") {
      selectedCharacterIndex = (selectedCharacterIndex - 1 + CHARACTER_OPTIONS.length) % CHARACTER_OPTIONS.length;
      if (characterSelectClickEl) {
        characterSelectClickEl.currentTime = 0;
        characterSelectClickEl.play().catch(() => {});
      }
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "Right") {
      selectedCharacterIndex = (selectedCharacterIndex + 1) % CHARACTER_OPTIONS.length;
      if (characterSelectClickEl) {
        characterSelectClickEl.currentTime = 0;
        characterSelectClickEl.play().catch(() => {});
      }
      e.preventDefault();
      return;
    }
    if ((e.key === " " || e.code === "Space") && !e.repeat) {
      currentHeroSheet = CHARACTER_OPTIONS[selectedCharacterIndex].id;
      characterSelectActive = false;
      showStartScreen();
      e.preventDefault();
      return;
    }
  }

  if (e.key === " " || e.code === "Space") {
    if (e.repeat) {
      e.preventDefault();
      return;
    }
    if (!hasStarted) {
      hasStarted = true;
      resetGame();
      overlayEl.classList.add("hidden");
      if (gameMusicEl) {
        gameMusicEl.volume = 0.5;
        gameMusicEl.play().catch(() => {});
      }
      e.preventDefault();
      return;
    }
    if (!isGameOver) {
      const inv = player.inventory || [];
      const totalSlots = 2 + inv.length;
      if (totalSlots > 0 && selectedStripIndex >= 0 && selectedStripIndex < totalSlots) {
        if (selectedStripIndex === 0) {
          player.weapon = WEAPON_FIREBALL;
          attemptAttack();
        } else if (selectedStripIndex === 1) {
          player.weapon = WEAPON_SWORD;
          attemptAttack();
        } else {
          const invIndex = selectedStripIndex - 2;
          const item = inv[invIndex];
          if (item === "potion") {
            player.inventory.splice(invIndex, 1);
            const curHp = Number(player.hp);
            player.hp = Math.min(PLAYER_MAX_HP, (isNaN(curHp) ? 0 : curHp) + 5);
            if (selectedStripIndex >= 2 + player.inventory.length) selectedStripIndex = Math.max(0, 2 + player.inventory.length - 1);
            updateHUD();
            e.preventDefault();
            return;
          }
          // key: nothing
        }
        updateHUD();
      } else {
        attemptAttack();
      }
    }
    e.preventDefault();
  }

  if (e.key.toLowerCase() === "r") {
    if (!isGameOver) {
      const totalSlots = 2 + (player.inventory || []).length;
      if (totalSlots > 0) {
        selectedStripIndex = (selectedStripIndex + 1) % totalSlots;
        if (selectedStripIndex === 0) player.weapon = WEAPON_FIREBALL;
        else if (selectedStripIndex === 1) player.weapon = WEAPON_SWORD;
        updateHUD();
      }
    }
    e.preventDefault();
  }

  if (e.key.toLowerCase() === "e") {
    if (!isGameOver && hasStarted && player.currentRoom === HIDDEN_ROOM) {
      tryPurchaseInSecretRoom();
    }
    e.preventDefault();
  }

  if (!e.repeat && hasStarted && !isGameOver) {
    const key = e.key.toLowerCase();
    const next = "boss"[bossTypedSequence.length];
    if (key === next) {
      bossTypedSequence += key;
      if (bossTypedSequence === "boss") {
        player.currentRoom = BOSS_ROOM;
        player.x = ROOM_MARGIN_X + ROOM_WIDTH / 2;
        player.y = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
        bossTypedSequence = "";
        if (bossChamberEl) {
          bossChamberEl.currentTime = 0;
          bossChamberEl.play().catch(() => {});
        }
      }
    } else {
      bossTypedSequence = "";
    }
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove", (e) => {
  if (!characterSelectActive) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const panel = characterSelectPanelAt(x, y);
  if (panel >= 0 && panel !== selectedCharacterIndex) {
    selectedCharacterIndex = panel;
    if (characterSelectClickEl) {
      characterSelectClickEl.currentTime = 0;
      characterSelectClickEl.play().catch(() => {});
    }
  }
});

canvas.addEventListener("click", (e) => {
  if (!characterSelectActive) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const panel = characterSelectPanelAt(x, y);
  if (panel >= 0) {
    currentHeroSheet = CHARACTER_OPTIONS[panel].id;
    characterSelectActive = false;
    showStartScreen();
  }
});

restartButton.addEventListener("click", () => {
  if (characterSelectActive) {
    currentHeroSheet = CHARACTER_OPTIONS[selectedCharacterIndex].id;
    characterSelectActive = false;
    showStartScreen();
    return;
  }
  hasStarted = true;
  resetGame();
  overlayEl.classList.add("hidden");
  if (gameMusicEl) {
    gameMusicEl.volume = 0.5;
    gameMusicEl.play().catch(() => {});
  }
});

function toggleWeapon() {
  player.weapon =
    player.weapon === WEAPON_FIREBALL ? WEAPON_SWORD : WEAPON_FIREBALL;
  updateHUD();
}

function attemptAttack() {
  if (player.attackCooldown > 0) return;

  if (player.currentRoom === HIDDEN_ROOM) {
    shopkeeperCaptionText =
      SHOPKEEPER_NO_WEAPON_PHRASES[
        Math.floor(Math.random() * SHOPKEEPER_NO_WEAPON_PHRASES.length)
      ];
    shopkeeperCaptionUntil = gameFrameCount + SHOPKEEPER_CAPTION_DURATION;
  }

  if (player.weapon === WEAPON_FIREBALL) {
    if (fireballWhooshEl) {
      fireballWhooshEl.currentTime = 0;
      fireballWhooshEl.play().catch(() => {});
    }
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
    if (swordSwingEl) {
      swordSwingEl.currentTime = 0;
      swordSwingEl.play().catch(() => {});
    }
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
  if (cavernSequence !== "none") return; // no movement during cavern descent/appear
  if (room2SecretSequence !== "none") return; // no movement during room 2 secret stairs
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

  if (keys["arrowup"] || keys["w"]) moveY -= 1;
  if (keys["arrowdown"] || keys["s"]) moveY += 1;
  if (keys["arrowleft"] || keys["a"]) moveX -= 1;
  if (keys["arrowright"] || keys["d"]) moveX += 1;

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
      if (t.toRoom === BOSS_ROOM && bossChamberEl) {
        bossChamberEl.currentTime = 0;
        bossChamberEl.play().catch(() => {});
      }
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

function updateCavernDoorAndSequence() {
  const cx = ROOM9_CAVERN_DOOR_CX;
  const cy = ROOM9_CAVERN_DOOR_CY;
  const halfW = ROOM9_CAVERN_DOOR_W / 2;
  const halfH = ROOM9_CAVERN_DOOR_H / 2;

  if (player.currentRoom === 9) {
    const dist = Math.hypot(player.x - cx, player.y - cy);
    if (room9DoorState === "closed" && dist < ROOM9_DOOR_OPEN_DIST) {
      room9DoorState = "swinging";
      room9DoorSwingProgress = 0;
    }
    if (room9DoorState === "swinging") {
      room9DoorSwingProgress++;
      if (room9DoorSwingProgress >= ROOM9_DOOR_SWING_FRAMES) {
        room9DoorState = "open";
      }
    }
    if (room9DoorState === "open" && cavernSequence === "none") {
      const inDoor =
        player.x >= cx - halfW &&
        player.x <= cx + halfW &&
        player.y >= cy - halfH &&
        player.y <= cy + halfH;
      if (inDoor) {
        cavernSequence = "descending";
        cavernProgress = 0;
        player.x = cx;
        if (secretDoorOpenEl) {
          secretDoorOpenEl.currentTime = 0;
          secretDoorOpenEl.play().catch(() => {});
        }
      }
    }
  }

  if (cavernSequence === "descending") {
    cavernProgress++;
    player.y += 2.2;
    if (cavernProgress >= CAVERN_DESCEND_FRAMES) {
      cavernSequence = "fadeout";
      cavernProgress = 0;
    }
  } else if (cavernSequence === "fadeout") {
    cavernProgress++;
    cavernBlackAlpha = Math.min(1, cavernProgress / CAVERN_FADE_FRAMES);
      if (cavernProgress >= CAVERN_FADE_FRAMES) {
      player.currentRoom = HIDDEN_ROOM;
      player.x = ROOM_MARGIN_X + ROOM_WIDTH / 2;
      player.y = ROOM_MARGIN_Y + 80;
      cavernSequence = "appearing";
      cavernProgress = 0;
      shopkeeper.x = SHOPKEEPER_SQUARE[0].x;
      shopkeeper.y = SHOPKEEPER_SQUARE[0].y;
      shopkeeper.state = "square";
      shopkeeper.waypointIndex = 0;
      shopkeeper.walkFrameIndex = 0;
      shopkeeper.walkFrameCounter = 0;
      shopkeeperCaptionText = "";
      shopkeeperCaptionUntil = 0;
      shopkeeperCaptionIndex = 0;
      shopkeeperCaptionNextAt = 0;
    }
  } else if (cavernSequence === "appearing") {
    cavernProgress++;
    cavernBlackAlpha = Math.max(0, 1 - cavernProgress / CAVERN_FADE_FRAMES);
    if (cavernProgress >= CAVERN_FADE_FRAMES) {
      cavernSequence = "none";
      cavernBlackAlpha = 0;
    }
  } else if (cavernSequence === "ascending") {
    cavernProgress++;
    player.y -= 2.2;
    if (cavernProgress >= CAVERN_DESCEND_FRAMES) {
      cavernSequence = "none";
      player.x = ROOM9_CAVERN_DOOR_CX + ROOM9_CAVERN_DOOR_W / 2 + 28;
      player.y = ROOM9_CAVERN_DOOR_CY;
    }
  }
}

function updateRoom2TrapDoorAndSequence() {
  if (room2QuestionShiftActive) {
    room2QuestionShiftProgress++;
    if (room2QuestionShiftProgress >= ROOM2_QUESTION_SHIFT_FRAMES) {
      room2QuestionShiftActive = false;
      room2TrapDoorState = "opening";
      room2TrapDoorProgress = 0;
    }
  }
  if (room2TrapDoorState === "opening") {
    room2TrapDoorProgress++;
    if (room2TrapDoorProgress >= ROOM2_TRAPDOOR_OPEN_FRAMES) {
      room2TrapDoorState = "open";
    }
  }
  if (room2SecretSequence === "descending") {
    room2SecretProgress++;
    player.y += 2.2;
    if (room2SecretProgress >= ROOM2_DESCEND_FRAMES) {
      room2SecretSequence = "none";
      player.currentRoom = SECRET_ROOM_2;
      player.x = ROOM_MARGIN_X + ROOM_WIDTH / 2;
      player.y = ROOM_MARGIN_Y + 80;
    }
  } else if (room2SecretSequence === "ascending") {
    room2SecretProgress++;
    player.y -= 2.2;
    if (room2SecretProgress >= ROOM2_DESCEND_FRAMES) {
      room2SecretSequence = "none";
      player.x = ROOM_MARGIN_X + ROOM2_DOORWAY_LEFT + ROOM2_DOORWAY_W / 2;
      player.y = ROOM_MARGIN_Y + ROOM2_DOORWAY_TOP - 24;
    }
  }
}

function handleRoomTransitions() {
  if (roomTransition.active) return;

  sealedDoorCaption = false;

  if (player.currentRoom === 2) {
    const prx = player.x - ROOM_MARGIN_X;
    const pry = player.y - ROOM_MARGIN_Y;
    if (room2TrapDoorState === "closed" && !room2QuestionShiftActive) {
      if (
        prx >= ROOM2_INSIDE_LEFT && prx <= ROOM2_INSIDE_LEFT + ROOM2_INSIDE_W &&
        pry >= ROOM2_INSIDE_TOP && pry <= ROOM2_INSIDE_TOP + ROOM2_INSIDE_H
      ) {
        const dx = ROOM2_QUESTION_CENTER_X - prx;
        const dy = ROOM2_QUESTION_CENTER_Y - pry;
        const dist = Math.hypot(dx, dy) || 1;
        room2QuestionShiftActive = true;
        room2QuestionShiftProgress = 0;
        room2QuestionShiftDx = dx / dist;
        room2QuestionShiftDy = dy / dist;
        if (trapDoorOpenEl) {
          trapDoorOpenEl.currentTime = 0;
          trapDoorOpenEl.play().catch(() => {});
        }
      }
    } else if (room2TrapDoorState === "open" && room2SecretSequence === "none") {
      const dl = ROOM_MARGIN_X + ROOM2_DOORWAY_LEFT;
      const dt = ROOM_MARGIN_Y + ROOM2_DOORWAY_TOP;
      if (
        player.x >= dl && player.x <= dl + ROOM2_DOORWAY_W &&
        player.y >= dt && player.y <= dt + ROOM2_DOORWAY_H
      ) {
        room2SecretSequence = "descending";
        room2SecretProgress = 0;
        player.x = ROOM_MARGIN_X + ROOM2_DOORWAY_LEFT + ROOM2_DOORWAY_W / 2;
        player.y = ROOM_MARGIN_Y + ROOM2_DOORWAY_TOP + ROOM2_DOORWAY_H / 2;
        if (secretDoorOpenEl) {
          secretDoorOpenEl.currentTime = 0;
          secretDoorOpenEl.play().catch(() => {});
        }
        return;
      }
    }
  }

  const room = ROOMS[player.currentRoom];
  const leftDoorY = ROOM_MARGIN_Y + ROOM_HEIGHT / 2;
  const rightDoorY = leftDoorY;
  const topDoorX = ROOM_MARGIN_X + ROOM_WIDTH / 2;
  const bottomDoorX = topDoorX;
  const doorThickness = 60;

  const canEnterBossRoom = (newRoomId) =>
    newRoomId !== BOSS_ROOM || allNonBossEnemiesDead() || player.hasBossKey;

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
    if (player.currentRoom === HIDDEN_ROOM && room.neighbors.up === 9) {
      cavernSequence = "ascending";
      cavernProgress = 0;
      player.currentRoom = 9;
      player.x = ROOM9_CAVERN_DOOR_CX;
      const stepsBottomY = ROOM9_CAVERN_DOOR_CY + ROOM9_CAVERN_DOOR_H / 2 + 12 * 14;
      player.y = stepsBottomY;
      if (secretDoorOpenEl) {
        secretDoorOpenEl.currentTime = 0;
        secretDoorOpenEl.play().catch(() => {});
      }
    } else if (player.currentRoom === SECRET_ROOM_2 && room.neighbors.up === 2) {
      room2SecretSequence = "ascending";
      room2SecretProgress = 0;
      player.currentRoom = 2;
      player.x = ROOM_MARGIN_X + ROOM2_DOORWAY_LEFT + ROOM2_DOORWAY_W / 2;
      const stairsBottomY = ROOM_MARGIN_Y + ROOM2_DOORWAY_TOP + ROOM2_DOORWAY_H + ROOM2_STAIRS_NUM * (ROOM2_STAIRS_STEP_H + 4);
      player.y = stairsBottomY;
      if (secretDoorOpenEl) {
        secretDoorOpenEl.currentTime = 0;
        secretDoorOpenEl.play().catch(() => {});
      }
    } else {
      startRoomTransition(room.neighbors.up, "up");
    }
    return;
  }
  if (
    room.neighbors.down !== undefined &&
    canEnterBossRoom(room.neighbors.down) &&
    player.y + player.boundsHalfH >= ROOM_MARGIN_Y + ROOM_HEIGHT - 4 &&
    Math.abs(player.x - bottomDoorX) <= doorThickness / 2
  ) {
    startRoomTransition(room.neighbors.down, "down");
    return;
  }

  // Check if player is at a sealed door (boss room not yet open)
  const atLeft = room.neighbors.left === BOSS_ROOM && player.x - player.boundsHalfW <= ROOM_MARGIN_X + 4 && Math.abs(player.y - leftDoorY) <= doorThickness / 2;
  const atRight = room.neighbors.right === BOSS_ROOM && player.x + player.boundsHalfW >= ROOM_MARGIN_X + ROOM_WIDTH - 4 && Math.abs(player.y - rightDoorY) <= doorThickness / 2;
  const atTop = room.neighbors.up === BOSS_ROOM && player.y - player.boundsHalfH <= ROOM_MARGIN_Y + 4 && Math.abs(player.x - topDoorX) <= doorThickness / 2;
  const atBottom = room.neighbors.down === BOSS_ROOM && player.y + player.boundsHalfH >= ROOM_MARGIN_Y + ROOM_HEIGHT - 4 && Math.abs(player.x - bottomDoorX) <= doorThickness / 2;
  if ((atLeft || atRight || atTop || atBottom) && !allNonBossEnemiesDead() && !player.hasBossKey) {
    sealedDoorCaption = true;
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
      // Boss: move toward the hero (same room only; boss room has no obstacles)
      const half = enemy.half;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const vx = (dx / dist) * BOSS_SPEED;
      const vy = (dy / dist) * BOSS_SPEED;
      let nextX = enemy.x + vx;
      let nextY = enemy.y + vy;
      enemy.vx = vx;
      enemy.vy = vy;
      nextX = clamp(
        nextX,
        ROOM_MARGIN_X + half,
        ROOM_MARGIN_X + ROOM_WIDTH - half
      );
      nextY = clamp(
        nextY,
        ROOM_MARGIN_Y + half,
        ROOM_MARGIN_Y + ROOM_HEIGHT - half
      );
      enemy.x = nextX;
      enemy.y = nextY;
    } else if (enemy.roomId === 6 && enemy.isElite) {
      // Room 6 demons: walk in current direction until wall/obstacle/other demon, then turn 90°
      const speed = enemy.speed !== undefined ? enemy.speed : ENEMY_SPEED;
      const half = enemy.half;

      if (enemy.vx === undefined || enemy.vy === undefined) {
        const angle = Math.random() * Math.PI * 2;
        enemy.vx = Math.cos(angle);
        enemy.vy = Math.sin(angle);
      }

      const dx = enemy.vx * speed;
      const dy = enemy.vy * speed;
      let nextX = clamp(
        enemy.x + dx,
        ROOM_MARGIN_X + half,
        ROOM_MARGIN_X + ROOM_WIDTH - half
      );
      let nextY = clamp(
        enemy.y + dy,
        ROOM_MARGIN_Y + half,
        ROOM_MARGIN_Y + ROOM_HEIGHT - half
      );

      const hitWall =
        nextX !== enemy.x + dx || nextY !== enemy.y + dy;

      let hitObstacle = false;
      const temp = { x: nextX, y: nextY, half };
      for (const ob of obstacles) {
        if (rectIntersect(temp, ob)) {
          hitObstacle = true;
          break;
        }
      }

      let hitOther = false;
      for (const other of enemies) {
        if (other === enemy || other.hp <= 0 || other.roomId !== 6) continue;
        if (rectIntersect(temp, other)) {
          hitOther = true;
          break;
        }
      }

      if (hitWall || hitObstacle || hitOther) {
        const sign = Math.random() < 0.5 ? 1 : -1;
        const oldVx = enemy.vx;
        const oldVy = enemy.vy;
        enemy.vx = -sign * oldVy;
        enemy.vy = sign * oldVx;
      } else {
        enemy.x = nextX;
        enemy.y = nextY;
      }
    } else if (enemy.isElite) {
      // Elite: 2 steps in a random direction, then 3 steps toward hero; repeat
      const speed = enemy.speed !== undefined ? enemy.speed : ENEMY_SPEED;
      const subStep = speed / 3;

      if (enemy.eliteStepsLeft <= 0) {
        if (enemy.eliteStepPhase === "random") {
          enemy.eliteStepPhase = "towards";
          enemy.eliteStepsLeft = 3;
        } else {
          enemy.eliteStepPhase = "random";
          enemy.eliteStepsLeft = 2;
          enemy.eliteRandomAngle = Math.random() * Math.PI * 2;
        }
      }

      let dirX = 0;
      let dirY = 0;
      if (enemy.eliteStepPhase === "random") {
        dirX = Math.cos(enemy.eliteRandomAngle);
        dirY = Math.sin(enemy.eliteRandomAngle);
      } else {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 4) {
          dirX = dx / dist;
          dirY = dy / dist;
        }
      }

      enemy.vx = dirX;
      enemy.vy = dirY;

      for (let i = 0; i < 3; i++) {
        moveEnemyWithCollision(enemy, dirX * subStep, dirY * subStep, obstacles);
      }
      enemy.eliteStepsLeft--;
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
        isDemonFireball: true,
        alive: true,
        get half() { return this.size / 2; },
      });
      enemy.fireballCooldown = DEMON_FIREBALL_COOLDOWN;
    }
    if (enemy.fireballCooldown > 0) enemy.fireballCooldown--;

    // Damage player on contact and start knockback. Shield halves damage.
    if (rectIntersect(enemy, player)) {
      if (player.contactDamageCooldown <= 0) {
        const damage = player.hasShield ? 0.5 : 1;
        player.hp = Math.max(0, player.hp - damage);
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
      if (p.isBoss || p.isDemonFireball) spawnBigExplosion(p.x, p.y);
      p.alive = false;
      return;
    }
    for (const ob of obstacles) {
      if (rectIntersect(p, ob)) {
        if (p.isBoss || p.isDemonFireball) spawnBigExplosion(p.x, p.y);
        p.alive = false;
        return;
      }
    }
    if (rectIntersect(p, player) && player.currentRoom === p.roomId) {
      const damage = player.hasShield ? 0.5 : 1;
      player.hp = Math.max(0, player.hp - damage);
      if (p.isBoss || p.isDemonFireball) spawnBigExplosion(p.x, p.y);
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
      player.hp += 1;
      if (heartPickupEl) {
        heartPickupEl.currentTime = 0;
        heartPickupEl.play().catch(() => {});
      }
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
      if (coinCollectEl) {
        coinCollectEl.currentTime = 0;
        coinCollectEl.play().catch(() => {});
      }
      updateHUD();
      return false; // remove coin
    }
    return true;
  });
}

function checkWinCondition() {
  const boss = enemies.find((e) => e.isBoss);
  if (boss && boss.hp <= 0) {
    isGameOver = true;
    victory = true;
    showEndMessage();
    return;
  }
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
  startHintEl.textContent = "";
  overlayEl.classList.remove("hidden");
  if (gameMusicEl) gameMusicEl.pause();
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

function drawRoom2Stairs() {
  const cx = ROOM_MARGIN_X + ROOM2_DOORWAY_LEFT + ROOM2_DOORWAY_W / 2;
  const startY = ROOM_MARGIN_Y + ROOM2_DOORWAY_TOP + ROOM2_DOORWAY_H;
  ctx.fillStyle = "#3d3d4a";
  for (let i = 0; i < ROOM2_STAIRS_NUM; i++) {
    const y = startY + i * (ROOM2_STAIRS_STEP_H + 4);
    const x = cx - ROOM2_STAIRS_STEP_W / 2 + (i % 2) * 8;
    ctx.fillRect(x, y, ROOM2_STAIRS_STEP_W, ROOM2_STAIRS_STEP_H);
  }
}

function drawRoom2SecretElements() {
  if (player.currentRoom !== 2) return;
  const dotSize = 24;
  const dotHalf = dotSize / 2;
  let dotOffsetX = 0;
  let dotOffsetY = 0;
  if (room2QuestionShiftActive) {
    const t = room2QuestionShiftProgress / ROOM2_QUESTION_SHIFT_FRAMES;
    dotOffsetX = ROOM2_QUESTION_SHIFT_PIXELS * t * room2QuestionShiftDx;
    dotOffsetY = ROOM2_QUESTION_SHIFT_PIXELS * t * room2QuestionShiftDy;
  } else if (room2TrapDoorState !== "closed") {
    dotOffsetX = ROOM2_QUESTION_SHIFT_PIXELS * room2QuestionShiftDx;
    dotOffsetY = ROOM2_QUESTION_SHIFT_PIXELS * room2QuestionShiftDy;
  }
  ctx.fillStyle = "#607d8b";
  ctx.fillRect(
    ROOM_MARGIN_X + ROOM2_DOT_X - dotHalf + dotOffsetX,
    ROOM_MARGIN_Y + ROOM2_DOT_Y - dotHalf + dotOffsetY,
    dotSize,
    dotSize
  );

  if (room2TrapDoorState === "closed") {
    // Trap door is hidden until hero pushes the question mark and shift completes
  } else {
    const dl = ROOM_MARGIN_X + ROOM2_DOORWAY_LEFT;
    const dt = ROOM_MARGIN_Y + ROOM2_DOORWAY_TOP;
    const dw = ROOM2_DOORWAY_W;
    const dh = ROOM2_DOORWAY_H;
    ctx.fillStyle = "#0d0d12";
    ctx.fillRect(dl, dt, dw, dh);
    ctx.strokeStyle = "#3d3d4a";
    ctx.lineWidth = 2;
    ctx.strokeRect(dl, dt, dw, dh);
    if (room2TrapDoorState === "opening") {
      const t = room2TrapDoorProgress / ROOM2_TRAPDOOR_OPEN_FRAMES;
      const doorY = dt + dh * (1 - t);
      ctx.fillStyle = "#2a2520";
      ctx.fillRect(dl, doorY, dw, dh);
      ctx.strokeStyle = "#3d3d4a";
      ctx.strokeRect(dl, doorY, dw, dh);
    }
  }

  if (room2SecretSequence === "descending" || room2SecretSequence === "ascending") {
    drawRoom2Stairs();
  }
}

function drawRoom9CavernDoor() {
  const cx = ROOM9_CAVERN_DOOR_CX;
  const cy = ROOM9_CAVERN_DOOR_CY;
  const w = ROOM9_CAVERN_DOOR_W;
  const h = ROOM9_CAVERN_DOOR_H;
  const left = cx - w / 2;
  const top = cy - h / 2;

  // Dark brown arch / frame (cavern mouth)
  ctx.fillStyle = "#2a2018";
  ctx.beginPath();
  ctx.moveTo(left, top + h);
  ctx.lineTo(left, top + 25);
  ctx.quadraticCurveTo(left, top, left + w / 2, top);
  ctx.quadraticCurveTo(left + w, top, left + w, top + 25);
  ctx.lineTo(left + w, top + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 4;
  ctx.stroke();

  // Brown door panel slides open to the right
  const slideT = room9DoorState === "swinging"
    ? room9DoorSwingProgress / ROOM9_DOOR_SWING_FRAMES
    : room9DoorState === "open"
      ? 1
      : 0;
  const panelW = w - 8;
  const slideX = slideT * panelW;

  if (slideT < 1) {
    ctx.fillStyle = "#6d4c41";
    ctx.fillRect(left + slideX, top + 20, panelW, h - 25);
    ctx.strokeStyle = "#5d4037";
    ctx.lineWidth = 2;
    ctx.strokeRect(left + slideX, top + 20, panelW, h - 25);
  }
}

function drawCavernSteps() {
  const cx = ROOM9_CAVERN_DOOR_CX;
  const cy = ROOM9_CAVERN_DOOR_CY;
  const stepW = 90;
  const stepH = 10;
  const numSteps = 12;
  const startY = cy + ROOM9_CAVERN_DOOR_H / 2;
  ctx.fillStyle = "#3d3d4a";
  for (let i = 0; i < numSteps; i++) {
    const y = startY + i * (stepH + 4);
    const x = cx - stepW / 2 + (i % 2) * 8;
    ctx.fillRect(x, y, stepW, stepH);
  }
}

function tryPurchaseInSecretRoom() {
  SHOP_ITEMS.forEach((item) => {
    if (shopSold[item.id]) return;
    const ix = SHOP_CENTER_X + item.offsetX;
    const iy = SHOP_CENTER_Y + item.offsetY;
    const dist = Math.hypot(player.x - ix, player.y - iy);
    if (dist > SHOP_ITEM_R) return;
    if (player.coins < item.price) return;

    player.coins -= item.price;
    shopSold[item.id] = true;

    if (item.id === "shield") {
      player.hasShield = true;
      player.shieldHp = 1;
      // Shield is equipped, not in inventory; drawn in front of player
    } else if (item.id === "key") {
      player.hasBossKey = true;
      player.inventory.push("key");
    } else if (item.id === "potion") {
      player.inventory.push("potion");
      // Use from inventory to add 5 health
    }
    if (itemEquipEl) {
      itemEquipEl.currentTime = 0;
      itemEquipEl.play().catch(() => {});
    }
    updateHUD();
  });
}

function getShopkeeperFollowTarget() {
  const margin = 50;
  const targetX = player.x - 40;
  let targetY = Math.min(
    player.y + 60,
    ROOM_MARGIN_Y + ROOM_HEIGHT - margin
  );
  targetY = Math.max(SHOPKEEPER_COUNTER_Y_MIN, targetY);
  return { x: targetX, y: targetY };
}

function updateShopkeeper() {
  if (player.currentRoom !== HIDDEN_ROOM) return;

  if (shopkeeper.state === "following" && gameFrameCount >= shopkeeperCaptionNextAt) {
    shopkeeperCaptionText = SHOPKEEPER_CAPTION_PHRASES[shopkeeperCaptionIndex];
    shopkeeperCaptionIndex = (shopkeeperCaptionIndex + 1) % 4;
    shopkeeperCaptionUntil = gameFrameCount + SHOPKEEPER_CAPTION_DURATION;
    shopkeeperCaptionNextAt = gameFrameCount + SHOPKEEPER_CAPTION_INTERVAL;
  }

  let target;
  if (shopkeeper.state === "square") {
    target = SHOPKEEPER_SQUARE[shopkeeper.waypointIndex];
  } else if (shopkeeper.state === "to_rest") {
    target = SHOPKEEPER_REST;
  } else if (shopkeeper.state === "following") {
    target = getShopkeeperFollowTarget();
  } else {
    target = null;
  }

  if (target) {
    const dx = target.x - shopkeeper.x;
    const dy = target.y - shopkeeper.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= SHOPKEEPER_WAYPOINT_R) {
      if (shopkeeper.state === "square") {
        if (shopkeeper.waypointIndex === 3) {
          shopkeeper.state = "to_rest";
        } else {
          shopkeeper.waypointIndex++;
        }
      } else if (shopkeeper.state === "to_rest") {
        shopkeeper.state = "following";
        shopkeeperCaptionNextAt = gameFrameCount + SHOPKEEPER_CAPTION_INTERVAL;
      }
    } else {
      const move = Math.min(SHOPKEEPER_SPEED, dist);
      shopkeeper.x += (dx / dist) * move;
      shopkeeper.y += (dy / dist) * move;
      shopkeeper.facingAngle = Math.atan2(dy, dx);
      if (shopkeeper.state === "to_rest" || shopkeeper.state === "following") {
        shopkeeper.y = Math.max(
          SHOPKEEPER_COUNTER_Y_MIN,
          Math.min(shopkeeper.y, ROOM_MARGIN_Y + ROOM_HEIGHT - 40)
        );
      }
      shopkeeper.walkFrameCounter++;
      if (shopkeeper.walkFrameCounter >= 10) {
        shopkeeper.walkFrameCounter = 0;
        shopkeeper.walkFrameIndex = (shopkeeper.walkFrameIndex + 1) % 4;
      }
    }
  }
  if (shopkeeper.state === "following") {
    shopkeeper.facingAngle = Math.atan2(
      player.y - shopkeeper.y,
      player.x - shopkeeper.x
    );
  }
}

function shopkeeperFacingAngleToRow(angle) {
  if (angle >= -Math.PI / 4 && angle < Math.PI / 4) return 3;
  if (angle >= Math.PI / 4 && angle < (3 * Math.PI) / 4) return 0;
  if (angle >= (3 * Math.PI) / 4 || angle < (-3 * Math.PI) / 4) return 2;
  return 1;
}

function drawShopkeeper() {
  if (player.currentRoom !== HIDDEN_ROOM || !shopkeeperLoaded) return;
  const row = shopkeeperFacingAngleToRow(shopkeeper.facingAngle);
  const moving =
    shopkeeper.state === "square" ||
    shopkeeper.state === "to_rest" ||
    shopkeeper.state === "following";
  const col = moving ? [0, 2, 3, 2][shopkeeper.walkFrameIndex % 4] : 1;
  const sx = col * shopkeeperFrameWidth;
  const sy = row * shopkeeperFrameHeight;
  const w = SHOPKEEPER_SIZE;
  const scale = w / shopkeeperFrameWidth;
  const h = shopkeeperFrameHeight * scale;
  ctx.drawImage(
    shopkeeperImage,
    sx,
    sy,
    shopkeeperFrameWidth,
    shopkeeperFrameHeight,
    shopkeeper.x - w / 2,
    shopkeeper.y - h / 2,
    w,
    h
  );
}

function drawShopkeeperCaption() {
  if (player.currentRoom !== HIDDEN_ROOM) return;
  if (gameFrameCount >= shopkeeperCaptionUntil || !shopkeeperCaptionText) return;
  const line = shopkeeperCaptionText;
  const lineHeight = 18;
  const padding = 12;
  const maxW = ctx.measureText(line).width;
  const bubbleW = Math.max(maxW + padding * 2, 120);
  const bubbleH = lineHeight + padding * 2;
  const bx = SHOP_CENTER_X;
  const by = ROOM_MARGIN_Y + 52;
  const r = 8;
  ctx.fillStyle = "rgba(30,30,40,0.95)";
  ctx.strokeStyle = "#607d8b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bubbleW / 2 - r, by);
  ctx.quadraticCurveTo(bx + bubbleW / 2, by, bx + bubbleW / 2, by + r);
  ctx.lineTo(bx + bubbleW / 2, by + bubbleH - r);
  ctx.quadraticCurveTo(bx + bubbleW / 2, by + bubbleH, bx + bubbleW / 2 - r, by + bubbleH);
  ctx.lineTo(bx - bubbleW / 2 + r, by + bubbleH);
  ctx.quadraticCurveTo(bx - bubbleW / 2, by + bubbleH, bx - bubbleW / 2, by + bubbleH - r);
  ctx.lineTo(bx - bubbleW / 2, by + r);
  ctx.quadraticCurveTo(bx - bubbleW / 2, by, bx - bubbleW / 2 + r, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#eceff1";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(line, bx, by + bubbleH / 2);
}

function drawSecretRoomShop() {
  const cx = SHOP_CENTER_X;
  const cy = SHOP_CENTER_Y;
  const slotR = 28;
  const items = [
    { id: "shield", offsetX: -SHOP_ITEM_SPACING },
    { id: "key", offsetX: 0 },
    { id: "potion", offsetX: SHOP_ITEM_SPACING },
  ];
  // Stand / table
  ctx.fillStyle = "#3e2723";
  ctx.fillRect(cx - 150, cy - 10, 300, 24);
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 150, cy - 10, 300, 24);

  items.forEach(({ id, offsetX }) => {
    const x = cx + offsetX;
    const y = cy;
    const sold = shopSold[id];
    const item = SHOP_ITEMS.find((i) => i.id === id);

    // Slot circle
    ctx.fillStyle = sold ? "#2d2d2d" : "#1a1a22";
    ctx.beginPath();
    ctx.arc(x, y, slotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = sold ? "#444" : "#5d4e37";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (id === "shield") {
      // Brown pentagon with two longer (side) edges — flipped upside down
      ctx.fillStyle = sold ? "#4a3728" : "#6d4c41";
      ctx.strokeStyle = sold ? "#3e2723" : "#5d4037";
      ctx.lineWidth = 2;
      const top = y - 22;
      const bottom = y + 22;
      const upperSide = 12;
      const lowerSide = 15;
      ctx.beginPath();
      ctx.moveTo(x, bottom);                    // point at bottom
      ctx.lineTo(x + upperSide, y + 6);        // right shoulder
      ctx.lineTo(x + lowerSide, top + 3);      // long edge to upper-right corner
      ctx.lineTo(x, top);                      // point at top
      ctx.lineTo(x - lowerSide, top + 3);      // long edge to upper-left corner
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (id === "key") {
      // Old-fashioned key with loop (circular bow) and bit
      ctx.fillStyle = sold ? "#555" : "#b8860b";
      ctx.strokeStyle = sold ? "#333" : "#8b6914";
      ctx.lineWidth = 1.5;
      const kx = x;
      const ky = y;
      // Loop (bow) at top - circle
      ctx.beginPath();
      ctx.arc(kx, ky - 14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Inner circle of loop (hole)
      ctx.fillStyle = "#1a1a22";
      ctx.beginPath();
      ctx.arc(kx, ky - 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = sold ? "#555" : "#b8860b";
      // Stem (shank) from loop down to bit
      ctx.fillRect(kx - 3, ky - 14, 6, 20);
      ctx.strokeRect(kx - 3, ky - 14, 6, 20);
      // Bit (teeth) at bottom - old-fashioned L or two teeth
      ctx.fillRect(kx - 3, ky + 4, 6, 6);
      ctx.fillRect(kx - 3, ky + 8, 12, 4);
      ctx.strokeRect(kx - 3, ky + 4, 6, 6);
      ctx.strokeRect(kx - 3, ky + 8, 12, 4);
    } else if (id === "potion") {
      // Lab flask (Erlenmeyer): conical body, narrow neck, red liquid inside
      const flTop = y - 14;
      const flNeckBottom = y - 4;
      const flBaseTop = y + 4;
      const flBaseBottom = y + 14;
      const neckW = 6;
      const baseW = 22;
      // Flask outline: neck (small rect), then cone body
      ctx.strokeStyle = sold ? "#444" : "#607d8b";
      ctx.lineWidth = 1.5;
      ctx.fillStyle = sold ? "rgba(60,60,80,0.3)" : "rgba(200,220,240,0.25)";
      ctx.beginPath();
      ctx.moveTo(x - neckW / 2, flTop);
      ctx.lineTo(x + neckW / 2, flTop);
      ctx.lineTo(x + neckW / 2, flNeckBottom);
      ctx.lineTo(x + baseW / 2, flBaseTop);
      ctx.lineTo(x + baseW / 2 - 2, flBaseBottom);
      ctx.lineTo(x, flBaseBottom + 2);
      ctx.lineTo(x - baseW / 2 + 2, flBaseBottom);
      ctx.lineTo(x - baseW / 2, flBaseTop);
      ctx.lineTo(x - neckW / 2, flNeckBottom);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Red liquid inside: flat surface at liquidTop, fills conical body
      const liquidTop = y + 6;
      const t = (liquidTop - flBaseTop) / (flBaseBottom - flBaseTop);
      const liquidHalfW = baseW / 2 - 2 + t * 2; // cone width at liquid surface
      ctx.fillStyle = sold ? "#4a2020" : "#c62828";
      ctx.beginPath();
      ctx.moveTo(x - liquidHalfW, liquidTop);
      ctx.lineTo(x + liquidHalfW, liquidTop);
      ctx.lineTo(x + baseW / 2 - 2, flBaseBottom);
      ctx.lineTo(x, flBaseBottom + 2);
      ctx.lineTo(x - baseW / 2 + 2, flBaseBottom);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = sold ? "#5a2020" : "#b71c1c";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = sold ? "#666" : "#cfd8dc";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const costY = y + slotR + 10;
    if (sold) {
      ctx.fillText("SOLD", x, costY);
    } else {
      ctx.fillText(String(item.price) + " coins", x, costY);
    }
    ctx.font = "12px sans-serif";
    ctx.fillStyle = sold ? "#555" : "#9e9e9e";
    ctx.fillText(item.name, x, costY + 18);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPlayer() {
  // Resolve which hero sheet to use (same row layout for all: 0=down, 1=up, 2=left, 3=right)
  let img = heroImage, fw = heroFrameWidth, fh = heroFrameHeight, loaded = heroSpriteLoaded;
  if (currentHeroSheet === "amira" && amiraHeroLoaded) {
    img = amiraHeroImage; fw = amiraHeroFrameWidth; fh = amiraHeroFrameHeight; loaded = true;
  } else if (currentHeroSheet === "faaris" && faarisHeroLoaded) {
    img = faarisHeroImage; fw = faarisHeroFrameWidth; fh = faarisHeroFrameHeight; loaded = true;
  } else if (currentHeroSheet === "radiyya" && radiyyaHeroLoaded) {
    img = radiyyaHeroImage; fw = radiyyaHeroFrameWidth; fh = radiyyaHeroFrameHeight; loaded = true;
  }
  if (loaded && fw > 0 && fh > 0) {
    // Determine sprite row based on direction (row 0=towards player, 1=away, 2=left, 3=right)
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
      const seq =
        row === HERO_DIR_LEFT ? [0, 2, 0, 2] : [0, 2, 3, 2];
      col = seq[heroAnim.walkFrameIndex % seq.length];
    }

    const sx = col * fw;
    const sy = row * fh;
    const targetWidth = PLAYER_SIZE * 2;
    const scale = targetWidth / fw;
    const targetHeight = fh * scale;

    ctx.drawImage(
      img,
      sx, sy, fw, fh,
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

function drawPlayerShield() {
  if (!player.hasShield || player.shieldHp <= 0) return;
  const dx = Math.cos(player.facingAngle) * 28;
  const dy = Math.sin(player.facingAngle) * 28;
  const x = player.x + dx;
  const y = player.y + dy;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.facingAngle);
  // Brown pentagon: point toward player (negative x), flat part forward (positive x)
  ctx.fillStyle = "#6d4c41";
  ctx.strokeStyle = "#5d4037";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-10, 0);   // point (toward player)
  ctx.lineTo(0, 5);    // right shoulder
  ctx.lineTo(8, 2);    // right corner
  ctx.lineTo(8, -2);   // front
  ctx.lineTo(0, -5);   // left shoulder
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawEnemies() {
  enemies.forEach((enemy) => {
    if (enemy.roomId !== player.currentRoom || enemy.hp <= 0) return;
    enemy.draw();
  });
}

function drawHeartShape(x, y, r) {
  // Heart path: symmetric with two lobes and pointed bottom (r = approximate radius)
  ctx.beginPath();
  const top = y - r * 0.5;
  ctx.moveTo(x, y + r * 0.35);
  ctx.bezierCurveTo(x - r, y - r * 0.4, x - r * 0.6, top - r * 0.3, x, top);
  ctx.bezierCurveTo(x + r * 0.6, top - r * 0.3, x + r, y - r * 0.4, x, y + r * 0.35);
  ctx.closePath();
}

function drawHeartPickups() {
  const r = HEART_PICKUP_R - 2;
  heartPickups.forEach((h) => {
    if (h.roomId !== player.currentRoom) return;
    ctx.fillStyle = "#c62828";
    drawHeartShape(h.x, h.y, r);
    ctx.fill();
    ctx.strokeStyle = "#8b0000";
    ctx.lineWidth = 2;
    drawHeartShape(h.x, h.y, r);
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
    } else if (p.isDemonFireball) {
      // Demon room fireball: red core, yellow comet tail
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
      tailGradient.addColorStop(0, "rgba(255, 235, 59, 0.9)");  // yellow near core
      tailGradient.addColorStop(1, "rgba(255, 152, 0, 0)");     // fade out

      ctx.strokeStyle = tailGradient;
      ctx.lineWidth = 4;
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
      radial.addColorStop(0, "#b71c1c");  // red core
      radial.addColorStop(1, "#e53935");  // slightly lighter red edge

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
  if (player.currentRoom === HIDDEN_ROOM) {
    ctx.textAlign = "center";
    ctx.fillText("Press E near an item to purchase", SHOP_CENTER_X, ROOM_MARGIN_Y + 24);
  }
}

function drawSealedDoorCaption() {
  if (!sealedDoorCaption) return;

  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  const lines = ["Defeat all enemies to enter this room...", "or perhaps buy a key"];
  const lineHeight = 18;
  const padding = 12;
  const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const bubbleW = maxW + padding * 2;
  const bubbleH = lines.length * lineHeight + padding * 2;

  const bx = ROOM_MARGIN_X + ROOM_WIDTH / 2;
  const by = ROOM_MARGIN_Y + ROOM_HEIGHT / 2 - bubbleH / 2;

  const r = 8;
  const x = bx - bubbleW / 2;
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.strokeStyle = "#78909c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + r, by);
  ctx.lineTo(x + bubbleW - r, by);
  ctx.arcTo(x + bubbleW, by, x + bubbleW, by + r, r);
  ctx.lineTo(x + bubbleW, by + bubbleH - r);
  ctx.arcTo(x + bubbleW, by + bubbleH, x + bubbleW - r, by + bubbleH, r);
  ctx.lineTo(x + r, by + bubbleH);
  ctx.arcTo(x, by + bubbleH, x, by + bubbleH - r, r);
  ctx.lineTo(x, by + r);
  ctx.arcTo(x, by, x + r, by, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#263238";
  lines.forEach((line, i) => {
    ctx.fillText(line, bx, by + padding + (i + 1) * lineHeight - 4);
  });
}

// Overhead minimap: row0 [9][8], row1 [0,1,2,3], row2 [4,5,6,7]. Drawn in screen space (left panel).
const MINIMAP_GRID = [
  [9, 8, null, null],  // row 0
  [0, 1, 2, 3],       // row 1
  [4, 5, 6, 7],       // row 2
];

function drawMinimap() {
  const pad = 10;
  const mapH = 96;
  const cols = 4;
  const rows = 3;
  // Use 5 column-widths so row 0 (shifted left by 1 cell) still fits inside the panel
  const cellW = (MINIMAP_PANEL_WIDTH - pad * 2) / 5;
  const cellH = mapH / rows;
  const left = pad + cellW; // origin so shifted row 0 stays on screen (room 9 at pad, room 8 at pad+cellW)
  const top = (canvas.height - mapH) / 2 - 20;
  const doorGap = Math.max(4, Math.min(cellW, cellH) * 0.4);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const roomId = MINIMAP_GRID[row][col];
      if (roomId === null) continue;

      // Row 0 (rooms 9 and 8) shifted left by one cell so room 8 sits above room 0
      const colOffset = row === 0 ? -1 : 0;
      const x = left + (col + colOffset) * cellW;
      const y = top + row * cellH;
      const isCurrent = player.currentRoom === roomId;

      ctx.fillStyle = isCurrent ? "#4a5568" : "#2d3748";
      ctx.fillRect(x + 1, y + 1, cellW - 1, cellH - 1);

      ctx.strokeStyle = isCurrent ? "#a0aec0" : "#4a5568";
      ctx.lineWidth = 1;
      const room = ROOMS[roomId];
      // Draw border with gaps for doors
      ctx.beginPath();
      // Top edge (door if room has neighbor up)
      if (room.neighbors.up === undefined) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + cellW, y);
      } else {
        const gap = doorGap / 2;
        ctx.moveTo(x, y);
        ctx.lineTo(x + cellW / 2 - gap, y);
        ctx.moveTo(x + cellW / 2 + gap, y);
        ctx.lineTo(x + cellW, y);
      }
      // Right edge
      if (room.neighbors.right === undefined) {
        ctx.lineTo(x + cellW, y + cellH);
      } else {
        const gap = doorGap / 2;
        ctx.lineTo(x + cellW, y + cellH / 2 - gap);
        ctx.moveTo(x + cellW, y + cellH / 2 + gap);
        ctx.lineTo(x + cellW, y + cellH);
      }
      // Bottom edge
      if (room.neighbors.down === undefined) {
        ctx.lineTo(x, y + cellH);
      } else {
        const gap = doorGap / 2;
        ctx.lineTo(x + cellW / 2 + gap, y + cellH);
        ctx.moveTo(x + cellW / 2 - gap, y + cellH);
        ctx.lineTo(x, y + cellH);
      }
      // Left edge
      if (room.neighbors.left === undefined) {
        ctx.lineTo(x, y);
      } else {
        const gap = doorGap / 2;
        ctx.lineTo(x, y + cellH / 2 + gap);
        ctx.moveTo(x, y + cellH / 2 - gap);
        ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Room number centered in cell
      ctx.fillStyle = isCurrent ? "#e2e8f0" : "#a0aec0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(roomId), x + cellW / 2, y + cellH / 2);
    }
  }
}

function getCharacterSelectSprite(index) {
  if (index === 0) return { img: faarisHeroImage, loaded: faarisHeroLoaded, fw: faarisHeroFrameWidth, fh: faarisHeroFrameHeight };
  if (index === 1) return { img: amiraHeroImage, loaded: amiraHeroLoaded, fw: amiraHeroFrameWidth, fh: amiraHeroFrameHeight };
  return { img: radiyyaHeroImage, loaded: radiyyaHeroLoaded, fw: radiyyaHeroFrameWidth, fh: radiyyaHeroFrameHeight };
}

function characterSelectPanelAt(x, y) {
  const cw = canvas.width;
  const ch = canvas.height;
  const numOptions = CHARACTER_OPTIONS.length;
  const panelW = 180;
  const panelH = 220;
  const gap = 60;
  const totalW = numOptions * panelW + (numOptions - 1) * gap;
  const startX = (cw - totalW) / 2 + panelW / 2;
  const centerY = ch / 2 - 20;
  for (let i = 0; i < numOptions; i++) {
    const cx = startX + i * (panelW + gap);
    const boxLeft = cx - panelW / 2;
    const boxTop = centerY - panelH / 2;
    if (x >= boxLeft && x < boxLeft + panelW && y >= boxTop && y < boxTop + panelH) return i;
  }
  return -1;
}

function drawCharacterSelectScreen() {
  const cw = canvas.width;
  const ch = canvas.height;
  const hue = (Date.now() / 40) % 360;
  ctx.fillStyle = `hsl(${hue}, 55%, 92%)`;
  ctx.fillRect(0, 0, cw, ch);

  ctx.fillStyle = "#2c2c38";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Select your character", cw / 2, 28);

  const numOptions = CHARACTER_OPTIONS.length;
  const panelW = 180;
  const panelH = 220;
  const avatarH = 180;
  const gap = 60;
  const totalW = numOptions * panelW + (numOptions - 1) * gap;
  const startX = (cw - totalW) / 2 + panelW / 2;
  const centerY = ch / 2 - 20;

  for (let i = 0; i < numOptions; i++) {
    const cx = startX + i * (panelW + gap);
    const isSelected = i === selectedCharacterIndex;
    const boxLeft = cx - panelW / 2;
    const boxTop = centerY - panelH / 2;

    ctx.strokeStyle = isSelected ? "#c49b2a" : "#6a6a7a";
    ctx.lineWidth = isSelected ? 5 : 2;
    ctx.strokeRect(boxLeft, boxTop, panelW, panelH);
    if (isSelected) {
      ctx.fillStyle = "rgba(196, 155, 42, 0.15)";
      ctx.fillRect(boxLeft, boxTop, panelW, panelH);
    }

    const sprite = getCharacterSelectSprite(i);
    const avatarTop = boxTop + 10;
    const avatarBoxH = avatarH - 10;
    if (sprite.loaded && sprite.fw > 0 && sprite.fh > 0) {
      const col = 1;
      let row;
      if (isSelected) {
        const phase = (Date.now() / 280) % 4;
        const step = Math.floor(phase) % 4;
        row = [0, 3, 1, 2][step];
      } else {
        row = 0;
      }
      const sx = col * sprite.fw;
      const sy = row * sprite.fh;
      const scale = Math.min((panelW - 20) / sprite.fw, avatarBoxH / sprite.fh);
      const drawW = sprite.fw * scale;
      const drawH = sprite.fh * scale;
      const dx = cx - drawW / 2;
      const dy = avatarTop + (avatarBoxH - drawH) / 2;
      ctx.drawImage(sprite.img, sx, sy, sprite.fw, sprite.fh, dx, dy, drawW, drawH);
    } else {
      ctx.fillStyle = "#b0b0bc";
      ctx.fillRect(cx - (panelW - 30) / 2, avatarTop + 20, panelW - 30, avatarBoxH - 40);
    }

    ctx.fillStyle = isSelected ? "#8b6914" : "#4a4a5a";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(CHARACTER_OPTIONS[i].name, cx, boxTop + panelH - 28);
  }

  ctx.fillStyle = "#5a5a6a";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Left / Right arrows to choose — Space to start", cw / 2, ch - 24);
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (characterSelectActive) {
    drawCharacterSelectScreen();
    updateHUD();
    requestAnimationFrame(gameLoop);
    return;
  }

  drawMinimap();

  gameFrameCount++;

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
    updateCavernDoorAndSequence();
    updateRoom2TrapDoorAndSequence();
    updateShopkeeper();
  }

  ctx.save();
  ctx.translate(cameraOffsetX, cameraOffsetY);
  drawRoomBackground();
  drawObstacles();
  if (player.currentRoom === 2) drawRoom2SecretElements();
  if (player.currentRoom === 9) drawRoom9CavernDoor();
  if (cavernSequence === "descending" || cavernSequence === "ascending" || (player.currentRoom === 9 && room9DoorState === "open")) drawCavernSteps();
  if (player.currentRoom === HIDDEN_ROOM) {
    drawShopkeeper();
    drawShopkeeperCaption();
    drawSecretRoomShop();
  }
  drawEnemies();
  drawHeartPickups();
  drawCoinPickups();
  drawDeathScatter();
  drawEnemyProjectiles();
  drawProjectiles();
  drawExplosions();
  drawPlayer();
  drawPlayerShield();
  drawSealedDoorCaption();
  drawUIHints();
  ctx.restore();

  if (cavernBlackAlpha > 0) {
    ctx.fillStyle = `rgba(0,0,0,${cavernBlackAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  updateHUD();

  requestAnimationFrame(gameLoop);
}

// Initialize: show character select first; after choice, overlay hides and game starts
showCharacterSelectScreen();
requestAnimationFrame(gameLoop);
// Start music as soon as the game loads (may be blocked until first user gesture)
if (gameMusicEl) {
  gameMusicEl.volume = 0.5;
  gameMusicEl.play().catch(() => {});
}

