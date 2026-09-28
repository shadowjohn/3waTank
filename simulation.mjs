import { getLevel } from './levels.mjs?v=20260927-6a';

const TAU = Math.PI * 2;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const radius = actor => actor.kind === 'boss' ? 1.3 : actor.kind === 'drone' ? 0.42 : 'occupied' in actor ? 0.83 : 0.32;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function random(game) {
  game.seed = (Math.imul(game.seed, 1664525) + 1013904223) >>> 0;
  return game.seed / 4294967296;
}

function event(game, type, actor, extra = {}) {
  game.events.push({ type, x: actor.x, z: actor.z, ...extra });
}

function makeTank(game, x, z, team, { kind = 'tank', crew = 1 } = {}) {
  const maxHp = kind === 'boss' ? 520 + game.level.id * 6 : team === 'player' ? 140 : Math.round(game.level.enemyHp * ({ tank: 1, scout: 0.72, heavy: 1.45, apc: 0.85 }[kind]));
  const tank = { id: ++game.serial, x, z, angle: team === 'player' ? Math.PI : 0,
    turretAngle: team === 'player' ? Math.PI : 0, hp: maxHp, maxHp, team, originTeam: team,
    kind, crew, ammo: kind === 'apc' ? 0 : 15, maxAmmo: kind === 'apc' ? 0 : 15, bailCooldown: 0, bailDriving: 0,
    missiles: kind === 'apc' ? 0 : 8, maxMissiles: kind === 'apc' ? 0 : 8, missileCooldown: 0,
    nitro: 100, maxNitro: 100, boosting: false, nitroLocked: false,
    crushContacts: [],
    occupied: true, capturedByPlayer: team === 'player', dead: false, cooldown: 1.6, routeTime: 0, route: [],
    objective: random(game) < 0.32 ? 'base' : 'player' };
  game.tanks.push(tank);
  if (kind === 'boss') {
    Object.assign(tank, { bossName: '毀城者', attack: null, attackTimer: 1.5, attackDuration: 0, attackAngle: 0,
      enraged: false, attackCount: 0, attackShots: 0, shotTimer: 0, patrolDirection: 1 });
    event(game, 'boss-arrival', tank, { bossId: tank.id, bossName: tank.bossName });
  }
  return tank;
}

function makeInfantry(game, point, angle = 0) {
  const grenades = random(game) < 0.5 ? 1 : 2;
  const enemy = { id: ++game.serial, ...point, angle, hp: 38, maxHp: 38, dead: false,
    cooldown: 0.8, routeTime: 0, route: [], invulnerable: 0.4, crushCooldown: 0, crushTime: 0, grenades, maxGrenades: 2, grenadeCooldown: 3 + random(game) * 2,
    rifleAmmo: 25, rifleMaxAmmo: 25, reloadTime: 0, bleeding: false, bleedTimer: 0, bleedAge: 0, bandageTime: 0, bleedSource: 'player' };
  game.enemies.push(enemy);
  return enemy;
}

function spawnEnemies(game) {
  const positions = [[-12, -10], [0, -10], [12, -10], [-6, -10], [6, -10], [-9, -10], [-3, -10], [3, -10]];
  while (game.spawnQueue.length > 0) {
    const spec = game.spawnQueue[0];
    const spawnRadius = spec.kind === 'boss' ? 1.3 : 0.85;
    const [x, z] = positions[game.level.waves[game.wave - 1] - game.spawnsPending];
    // 棄車占住入口時改找北方空位；完全堵塞則保留增援，不能被算成已殲滅。
    const candidates = spec.kind === 'boss' ? [0, -6, 6, -10, 10, -3, 3, -12, 12].map(x => ({ x, z: -11 }))
      : [{ x, z }, ...[-10, -11.5].flatMap(row => Array.from({ length: 13 }, (_, n) => ({ x: -12 + n * 2, z: row })))];
    const spot = candidates.find(p => canStand(game, p.x, p.z, spawnRadius)
      && !game.enemies.some(e => !e.dead && distance(e, p) < spawnRadius + 0.85));
    if (!spot) break;
    game.spawnQueue.shift();
    if (spec.kind === 'infantry') makeInfantry(game, spot);
    else makeTank(game, spot.x, spot.z, 'enemy', spec);
    game.spawnsPending = game.spawnQueue.length;
  }
  game.spawnRetry = 0.5;
}

function spawnWave(game) {
  game.spawnQueue = Array.from({ length: game.level.waves[game.wave - 1] }, (_, index) => {
    if (index === 0 && game.level.id % 5 === 0 && game.wave === game.level.waves.length) return { kind: 'boss', crew: 6 };
    if (game.level.id === 1 && game.wave === 1) return { kind: 'tank', crew: 1 };
    const variation = game.level.id + game.wave + index;
    const kind = ['infantry', 'scout', 'heavy', 'apc', 'tank', 'infantry'][variation % 6];
    const crew = kind === 'heavy' ? 3 + variation % 4 : kind === 'apc' ? 2 + variation % 5 : kind === 'scout' ? 1 + variation % 2 : 1 + variation % 3;
    return { kind, crew };
  });
  game.spawnsPending = game.spawnQueue.length;
  game.grace = 2;
  game.wavePending = 0;
  event(game, 'wave', { x: 0, z: -12 }, { wave: game.wave });
  spawnEnemies(game);
}

export function createGame({ seed = 1, level = 1 } = {}) {
  const game = { phase: 'ready', seed: seed >>> 0, level: getLevel(level), serial: 0, time: 0, score: 0, wave: 1,
    kills: 0, grace: 2, wavePending: 0, spawnsPending: 0, spawnRetry: 0, spawnQueue: [], events: [], tanks: [], enemies: [], drones: [], walls: [], bullets: [], grenades: [], hazards: [], pickups: [], enemyBases: [],
    base: { x: 0, z: 12.3, hp: 500, maxHp: 500, dead: false, supplyTimer: 25, supplyIndex: 0 },
    player: { x: 0, z: 8.5, hp: 100, maxHp: 100, dead: false, angle: Math.PI, tankId: null, invulnerable: 0, cooldown: 0, crushCooldown: 0, crushTime: 0,
      grenades: 3, maxGrenades: 3, grenadeCooldown: 0, sprintTime: 0, fatigueTime: 0, boostHeld: false, sprintLocked: false, droneKits: 2,
      rifleAmmo: 25, rifleMaxAmmo: 25, reloadTime: 0, fireLocked: false,
      bleeding: false, bleedTimer: 0, bleedAge: 0, bandageTime: 0, bleedSource: 'enemy' } };
  const basePositions = [[0], [-12, 12], [-12, 0, 12], [-12, -6, 6, 12], [-12, -6, 0, 6, 12]][game.level.enemyBaseCount - 1];
  const baseHp = Math.round(180 + (game.level.id - 1) / 49 * 60);
  game.enemyBases = basePositions.map(x => ({ id: ++game.serial, x, z: -13.3, hp: baseHp, maxHp: baseHp, dead: false }));
  game.walls = game.level.walls.map(wall => ({ ...wall, id: ++game.serial,
    hp: wall.kind === 'brick' ? 64 : Infinity, maxHp: wall.kind === 'brick' ? 64 : Infinity, dead: false }));
  game.player.tankId = makeTank(game, 0, 8.5, 'player').id;
  spawnWave(game);
  return game;
}

export function playerActor(game) {
  return game.tanks.find(t => t.id === game.player.tankId && !t.dead) || game.player;
}

function rectHit(x, z, r, wall) {
  return Math.hypot(x - clamp(x, wall.x - wall.w / 2, wall.x + wall.w / 2),
    z - clamp(z, wall.z - wall.d / 2, wall.z + wall.d / 2)) < r;
}

function canStand(game, x, z, r, ignore = null, staticOnly = false) {
  if (Math.abs(x) > 14.65 - r || Math.abs(z) > 14.65 - r) return false;
  if ([game.base, ...game.enemyBases].some(base => !base.dead && Math.hypot(x - base.x, z - base.z) < r + 0.9)) return false;
  if (game.walls.some(w => !w.dead && rectHit(x, z, r, w))) return false;
  return staticOnly || !game.tanks.some(t => !t.dead && t !== ignore && Math.hypot(x - t.x, z - t.z) < r + radius(t));
}

function move(game, actor, dx, dz) {
  if (actor.dead || actor.hp <= 0) return;
  const r = radius(actor);
  const fromX = actor.x, fromZ = actor.z;
  if (canStand(game, actor.x + dx, actor.z, r, actor)) {
    actor.x += dx;
    crush(game, actor, fromX, fromZ);
  }
  if (canStand(game, actor.x, actor.z + dz, r, actor)) {
    actor.z += dz;
    crush(game, actor, actor.x, fromZ);
  }
}

function wallBetween(x, z, body, wall) {
  let near = 0, far = 1;
  for (const [start, end, center, span] of [[x, body.x, wall.x, wall.w], [z, body.z, wall.z, wall.d]]) {
    const delta = end - start;
    if (Math.abs(delta) < 1e-9) {
      if (start < center - span / 2 || start > center + span / 2) return false;
    } else {
      const a = (center - span / 2 - start) / delta, b = (center + span / 2 - start) / delta;
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      if (near > far) return false;
    }
  }
  return true;
}

function crush(game, tank, fromX, fromZ) {
  const dx = tank.x - fromX, dz = tank.z - fromZ, lengthSquared = dx * dx + dz * dz;
  if (!('occupied' in tank) || lengthSquared < 1e-12) return;
  for (const body of [game.player, ...game.enemies]) {
    if (body.dead || body.hp <= 0 || (body === game.player && body.tankId !== null)) continue;
    const targetId = body === game.player ? 'player' : body.id;
    const t = clamp(((body.x - fromX) * dx + (body.z - fromZ) * dz) / lengthSquared, 0, 1);
    const x = fromX + dx * t, z = fromZ + dz * t;
    if (Math.hypot(body.x - x, body.z - z) >= radius(tank) + radius(body)
      || game.walls.some(w => !w.dead && w.kind !== 'water' && wallBetween(x, z, body, w))
      || tank.crushContacts.includes(targetId)) continue;
    // 接觸即記住，不能在原地重疊等冷卻／下車保護結束後反覆傷害。
    tank.crushContacts.push(targetId);
    if (body.invulnerable > 0 || body.crushCooldown > 0) continue;
    const targetTeam = body === game.player ? 'player' : 'enemy', damage = Math.min(body.hp, body.maxHp * 0.8);
    body.crushCooldown = 0.8; body.crushTime = 0.65;
    if (body === game.player) hitPlayer(game, damage, tank.team, 'crush');
    else hitInfantry(game, body, damage, tank.team, 'crush');
    event(game, 'crush', body, { targetId, targetTeam, sourceTeam: tank.team, vehicleId: tank.id, damage, angle: body.angle, dead: body.hp <= 0 });
  }
}

function exitSpot(game, tank) {
  for (const reach of [1.45, 1.9, 2.4]) {
    for (let i = 0; i < 12; i++) {
      const angle = tank.angle + Math.PI / 2 + i * TAU / 12;
      const point = { x: tank.x + Math.sin(angle) * reach, z: tank.z + Math.cos(angle) * reach };
      if (canStand(game, point.x, point.z, 0.34) && !game.enemies.some(e => !e.dead && distance(e, point) < 0.7)
        && (game.player.tankId !== null || distance(game.player, point) > 0.7)) return point;
    }
  }
  return null;
}

export function interact(game) {
  if (game.phase !== 'playing') return false;
  const player = game.player;
  if (player.tankId !== null) {
    const tank = playerActor(game);
    const point = exitSpot(game, tank);
    if (!point) return false;
    Object.assign(player, point, { tankId: null, angle: tank.turretAngle, invulnerable: 0.7 });
    tank.occupied = false;
    tank.crew = 0;
    tank.team = 'neutral';
    event(game, 'eject', point, { team: 'player' });
    return true;
  }
  const tank = game.tanks.filter(t => !t.dead && !t.occupied && t.hp > 0 && distance(t, player) < 2.35 && clearShot(game, player, t))
    .sort((a, b) => distance(a, player) - distance(b, player))[0];
  if (!tank) return false;
  if (player.sprintTime > 0) {
    player.sprintTime = 0;
    player.fatigueTime = 2.4;
    event(game, 'fatigue', player);
  }
  const stolen = tank.originTeam === 'enemy' && !tank.capturedByPlayer;
  tank.capturedByPlayer = true;
  tank.team = 'player';
  tank.occupied = true;
  tank.crew = 1;
  tank.cooldown = 0.15;
  player.tankId = tank.id;
  player.x = tank.x;
  player.z = tank.z;
  event(game, 'pickup', tank, { kind: 'tank', stolen });
  return true;
}

function ejectEnemy(game, tank) {
  const point = exitSpot(game, tank);
  if (!point) return false;
  tank.crew = Math.max(0, tank.crew - 1);
  tank.occupied = tank.crew > 0;
  if (!tank.occupied) tank.team = 'neutral';
  tank.bailCooldown = 2;
  tank.bailDriving = 1.5;
  makeInfantry(game, point, tank.turretAngle);
  event(game, 'eject', point, { team: 'enemy', remainingCrew: tank.crew });
  return true;
}

function destroyTank(game, tank, source) {
  const team = tank.team;
  const enemy = tank.team === 'enemy' && tank.occupied;
  tank.dead = true;
  tank.hp = 0;
  if (game.player.tankId === tank.id) {
    const point = exitSpot(game, tank) || { x: tank.x, z: tank.z };
    Object.assign(game.player, point, { tankId: null, angle: tank.turretAngle, invulnerable: 1.5 });
    hitPlayer(game, 20, source);
    event(game, 'eject', point, { team: 'player' });
  } else if (enemy) {
    while (tank.crew > 0) if (!ejectEnemy(game, tank)) { game.kills += tank.crew; break; }
  }
  tank.occupied = false;
  tank.crew = 0;
  if (source === 'player') game.score += tank.kind === 'boss' ? 1000 : 80;
  if (tank.kind === 'boss') {
    game.hazards = game.hazards.filter(h => h.bossId !== tank.id);
    tank.attack = null;
  }
  event(game, 'explosion', tank, { size: tank.kind === 'boss' ? 3 : 1.7, kind: 'tank', boss: tank.kind === 'boss', team, targetId: tank.id, angle: tank.angle });
  if (tank.kind === 'boss') event(game, 'boss-defeated', tank, { bossId: tank.id });
}

function startReload(game, actor, team) {
  if (actor.dead || actor.hp <= 0 || actor.bandageTime > 0 || actor.reloadTime > 0 || actor.rifleAmmo >= actor.rifleMaxAmmo
    || (actor === game.player && actor.tankId !== null)) return false;
  actor.reloadTime = 1.5;
  if (actor === game.player) actor.fireLocked = true;
  event(game, 'reload', actor, { team, kind: 'rifle', targetId: actor === game.player ? 'player' : actor.id });
  return true;
}

function startBandage(game, actor, team) {
  if (actor.dead || actor.hp <= 0 || !actor.bleeding || actor.bandageTime > 0) return false;
  actor.bandageTime = 1.5;
  event(game, 'bandage-start', actor, { team, targetId: actor === game.player ? 'player' : actor.id });
  return true;
}

function bodyTimers(game, actor, team, dt) {
  if (actor.dead || actor.hp <= 0) return;
  actor.crushCooldown = Math.max(0, (actor.crushCooldown || 0) - dt);
  actor.crushTime = Math.max(0, (actor.crushTime || 0) - dt);
  const targetId = actor === game.player ? 'player' : actor.id;
  if (actor.reloadTime > 0) {
    actor.reloadTime = Math.max(0, actor.reloadTime - dt);
    if (actor.reloadTime < 1e-9) {
      actor.reloadTime = 0;
      actor.rifleAmmo = actor.rifleMaxAmmo;
      event(game, 'reload-ready', actor, { team, kind: 'rifle', targetId });
    }
  }
  if (actor.bleeding) {
    actor.bleedAge = (actor.bleedAge || 0) + dt;
    actor.bleedTimer += dt;
    if (actor.bleedTimer >= 1 - 1e-9) {
      actor.bleedTimer = Math.max(0, actor.bleedTimer - 1);
      const damage = Math.min(4, actor.hp);
      if (actor === game.player) hitPlayer(game, damage, actor.bleedSource, 'bleeding');
      else hitInfantry(game, actor, damage, actor.bleedSource, 'bleeding');
      event(game, 'bleed-tick', actor, { team, targetId, damage });
    }
  }
  if (actor.bandageTime > 0 && actor.hp > 0) {
    actor.bandageTime = Math.max(0, actor.bandageTime - dt);
    if (actor.bandageTime < 1e-9) {
      actor.bandageTime = 0;
      actor.bleeding = false;
      actor.bleedTimer = 0;
      actor.bleedAge = 0;
      event(game, 'bandage-complete', actor, { team, targetId });
    }
  }
}

function shoot(game, actor, team, kind, angle) {
  if (actor.dead || actor.hp <= 0 || actor.bandageTime > 0 || (team === 'player' && kind !== 'drone' && (game.player.bandageTime > 0 || game.player.hp <= 0))) return false;
  if (kind === 'shell') {
    if (actor.ammo <= 0) return false;
    actor.ammo--;
  } else if (kind === 'missile') {
    if (actor.missiles <= 0 || actor.missileCooldown > 0) return false;
    actor.missiles--;
    actor.missileCooldown = 0.8;
  } else if (kind === 'bullet') {
    if (actor.reloadTime > 0 || (actor === game.player && actor.fireLocked)) return false;
    if (actor.rifleAmmo <= 0) { startReload(game, actor, team); return false; }
    actor.rifleAmmo--;
  }
  const dx = Math.sin(angle), dz = Math.cos(angle);
  // 從角色中心連續檢查，避免貼牆時炮口越過牆面。
  game.bullets.push({ id: ++game.serial, x: actor.x, z: actor.z,
    dx, dz, team, kind, ownerId: actor === game.player ? 'player' : actor.id, life: kind === 'missile' ? 3 : kind === 'shell' ? 2.1 : 1.25,
    ...(kind === 'missile' ? { speed: 13, targetId: null, targetKind: null } : {}),
    ...(kind === 'bullet' ? { range: 15, traveled: 0, tailAngle: (random(game) - 0.5) * 0.16, tailSpread: false } : {}) });
  event(game, 'shot', actor, { team, kind, angle, ...(kind === 'shell' ? { ammoRemaining: actor.ammo } : kind === 'missile' ? { ammoRemaining: actor.missiles } : {}) });
  if (kind === 'bullet' && actor.rifleAmmo === 0) startReload(game, actor, team);
  return true;
}

function throwGrenade(game, actor, team, targetX, targetZ) {
  if (actor.hp <= 0 || actor.bandageTime > 0 || actor.grenades <= 0 || actor.grenadeCooldown > 0) return false;
  const dx = targetX - actor.x, dz = targetZ - actor.z, scale = Math.min(1, 8 / Math.max(0.001, Math.hypot(dx, dz)));
  game.grenades.push({ id: ++game.serial, x: actor.x, z: actor.z, startX: actor.x, startZ: actor.z,
    targetX: clamp(actor.x + dx * scale, -14.2, 14.2), targetZ: clamp(actor.z + dz * scale, -14.2, 14.2), age: 0, fuse: 0.9, team });
  actor.grenades--;
  actor.grenadeCooldown = team === 'player' ? 0.85 : 4.5;
  event(game, 'grenade', actor, { team, kind: 'grenade' });
  return true;
}

function clearShot(game, from, to, breakBricks = false) {
  const n = Math.ceil(distance(from, to) / 0.45);
  for (let i = 1; i < n; i++) {
    const x = from.x + (to.x - from.x) * i / n, z = from.z + (to.z - from.z) * i / n;
    if (game.walls.some(w => !w.dead && w.kind !== 'water' && !(breakBricks && w.kind === 'brick') && rectHit(x, z, 0.1, w))) return false;
    if (game.tanks.some(t => !t.dead && t !== from && t !== to && Math.hypot(x - t.x, z - t.z) < radius(t) + 0.07)) return false;
  }
  return true;
}

function launchMissile(game, input) {
  const tank = playerActor(game);
  if (game.player.tankId === null || game.player.dead || game.player.hp <= 0 || game.player.bandageTime > 0
    || tank.dead || tank.hp <= 0 || tank.missileCooldown > 0) return;
  if (tank.missiles <= 0) { event(game, 'empty', tank, { team: 'player', kind: 'missile' }); return; }
  const aim = Number.isFinite(input.aimX) && Number.isFinite(input.aimZ) ? { x: input.aimX, z: input.aimZ } : tank;
  const candidates = [
    ...game.tanks.filter(t => t.team === 'enemy' && t.occupied).map(actor => ({ actor, kind: 'tank' })),
    ...game.enemies.map(actor => ({ actor, kind: 'infantry' })),
    ...game.enemyBases.map(actor => ({ actor, kind: 'base' })),
  ].filter(({ actor }) => !actor.dead && actor.hp > 0 && distance(tank, actor) <= 24
    && Math.cos(Math.atan2(actor.x - tank.x, actor.z - tank.z) - tank.turretAngle) >= Math.cos(Math.PI * 75 / 180)
    && clearShot(game, tank, actor)).sort((a, b) => distance(a.actor, aim) - distance(b.actor, aim));
  if (shoot(game, tank, 'player', 'missile', tank.turretAngle) && candidates.length) {
    Object.assign(game.bullets.at(-1), { targetId: candidates[0].actor.id, targetKind: candidates[0].kind });
  }
}

function guideMissile(game, bullet, dt) {
  const actors = bullet.targetKind === 'tank' ? game.tanks : bullet.targetKind === 'infantry' ? game.enemies : bullet.targetKind === 'base' ? game.enemyBases : [];
  const target = actors.find(actor => actor.id === bullet.targetId && !actor.dead && actor.hp > 0
    && (bullet.targetKind !== 'tank' || (actor.team === 'enemy' && actor.occupied)));
  if (!target) { bullet.targetId = null; bullet.targetKind = null; return; }
  const angle = Math.atan2(bullet.dx, bullet.dz), desired = Math.atan2(target.x - bullet.x, target.z - bullet.z);
  const difference = Math.atan2(Math.sin(desired - angle), Math.cos(desired - angle));
  const turn = angle + clamp(difference, -2.6 * dt, 2.6 * dt);
  bullet.dx = Math.sin(turn); bullet.dz = Math.cos(turn);
}

function movementBoost(game, actor, held, moving, dt) {
  const player = game.player, fresh = held && !player.boostHeld;
  player.boostHeld = held;
  if (!held) player.sprintLocked = false;
  else if (fresh && player.fatigueTime > 0) player.sprintLocked = true;
  let multiplier = 1;
  if (player.sprintTime > 0 && (!held || player.tankId !== null)) {
    player.sprintTime = 0;
    player.fatigueTime = 2.4;
    event(game, 'fatigue', player);
  }
  if (player.tankId === null && held && !player.sprintLocked && moving && player.fatigueTime <= 0) {
    player.sprintLocked = true;
    player.sprintTime = 1.2;
    event(game, 'boost', player, { kind: 'sprint' });
  }
  if (player.sprintTime > 0) {
    const duration = Math.min(dt, player.sprintTime);
    multiplier = (duration * 1.8 + (dt - duration) * 0.7) / dt;
    player.sprintTime = Math.max(0, player.sprintTime - dt);
    if (player.sprintTime < 1e-9) {
      player.sprintTime = 0;
      player.fatigueTime = 2.4 - (dt - duration);
      event(game, 'fatigue', player);
    }
  } else if (player.fatigueTime > 0) {
    const duration = Math.min(dt, player.fatigueTime);
    multiplier = (duration * 0.7 + dt - duration) / dt;
    player.fatigueTime = Math.max(0, player.fatigueTime - dt);
  }
  for (const tank of game.tanks) if (!tank.dead) {
    const wasBoosting = tank.boosting;
    if (!held) tank.nitroLocked = false;
    tank.boosting = tank === actor && held && moving > 0 && tank.nitro > 0 && !tank.nitroLocked;
    if (tank.boosting) {
      const used = Math.min(tank.nitro, 45 * dt);
      multiplier = 1 + 0.8 * used / (45 * dt);
      tank.nitro = Math.max(0, tank.nitro - used);
      if (tank.nitro < 1e-9) { tank.nitro = 0; tank.nitroLocked = true; }
      if (!wasBoosting) event(game, 'boost', tank, { kind: 'nitro' });
    } else {
      tank.nitro = Math.min(tank.maxNitro, tank.nitro + 20 * dt);
      if (tank === actor) multiplier = 1;
    }
  }
  return multiplier;
}

function dronePosition(game, slot) {
  const actor = playerActor(game), angle = actor.turretAngle ?? actor.angle, side = slot === 0 ? -1 : 1;
  return { x: clamp(actor.x + Math.cos(angle) * side * 1.8 - Math.sin(angle) * 0.5, -14.1, 14.1),
    z: clamp(actor.z - Math.sin(angle) * side * 1.8 - Math.cos(angle) * 0.5, -14.1, 14.1) };
}

function deployDrone(game) {
  const player = game.player, live = game.drones.filter(d => !d.dead);
  if (player.dead || player.hp <= 0 || player.bandageTime > 0) return;
  if (live.length >= 2 || player.droneKits <= 0) {
    event(game, 'message', player, { text: live.length >= 2 ? '已有兩架無人機支援中' : '沒有可用的無人機套件' });
    return;
  }
  const slot = live.some(d => d.slot === 0) ? 1 : 0;
  const drone = { id: ++game.serial, kind: 'drone', team: 'player', ...dronePosition(game, slot), slot,
    angle: playerActor(game).angle, hp: 45, maxHp: 45, dead: false, cooldown: 0.2, dodgeTime: 0, dodgeCooldown: 0, dodgeX: 0, dodgeZ: 0,
    targetId: null, targetKind: null, mode: 'return' };
  game.drones.push(drone);
  player.droneKits--;
  event(game, 'deploy', drone, { kind: 'drone', targetId: drone.id });
}

function droneStep(game, drone, dt) {
  drone.cooldown = Math.max(0, drone.cooldown - dt);
  drone.dodgeTime = Math.max(0, drone.dodgeTime - dt);
  drone.dodgeCooldown = Math.max(0, drone.dodgeCooldown - dt);
  if (drone.dodgeCooldown <= 0) {
    const danger = game.bullets.find(b => {
      if (b.ownerId === drone.id || b.life <= 0) return false;
      const x = drone.x - b.x, z = drone.z - b.z, along = x * b.dx + z * b.dz;
      return along > 0 && along < 4 && Math.abs(x * b.dz - z * b.dx) < 0.8;
    });
    if (danger) {
      const side = (drone.x - danger.x) * danger.dz - (drone.z - danger.z) * danger.dx >= 0 ? 1 : -1;
      drone.dodgeX = danger.dz * side; drone.dodgeZ = -danger.dx * side;
      drone.dodgeTime = 0.22; drone.dodgeCooldown = 1;
    }
  }
  const enemies = [...game.tanks.filter(t => !t.dead && t.hp > 0 && t.team === 'enemy' && t.occupied),
    ...game.enemies.filter(e => !e.dead && e.hp > 0)];
  let target = enemies.find(e => e.id === drone.targetId);
  if (!target) {
    enemies.sort((a, b) => distance(drone, a) - distance(drone, b));
    target = enemies.find(e => !game.drones.some(d => d !== drone && !d.dead && d.targetId === e.id)) || enemies[0];
  }
  drone.targetId = target?.id ?? null;
  drone.targetKind = target ? ('occupied' in target ? 'tank' : 'infantry') : null;
  drone.mode = target ? 'attack' : 'return';
  // 越過掩體後才停穩射擊；鎖定不隨玩家或其他敵人的每幀距離反覆切換。
  const visible = target && clearShot(game, drone, target)
    && !game.walls.some(w => !w.dead && w.kind !== 'water' && rectHit(drone.x, drone.z, 0.15, w));
  const follow = target ? (visible && distance(drone, target) <= 5.5 ? drone : target) : dronePosition(game, drone.slot);
  const d = distance(drone, follow);
  const speed = Math.min(10, d * 4);
  const dx = drone.dodgeTime > 0 ? drone.dodgeX * 5 : (follow.x - drone.x) / Math.max(d, 0.001) * speed;
  const dz = drone.dodgeTime > 0 ? drone.dodgeZ * 5 : (follow.z - drone.z) / Math.max(d, 0.001) * speed;
  drone.x = clamp(drone.x + dx * dt, -14.1, 14.1);
  drone.z = clamp(drone.z + dz * dt, -14.1, 14.1);
  if (target) {
    drone.angle = Math.atan2(target.x - drone.x, target.z - drone.z);
    if (drone.cooldown <= 0 && distance(drone, target) <= 11 && clearShot(game, drone, target)
      && !game.walls.some(w => !w.dead && w.kind !== 'water' && rectHit(drone.x, drone.z, 0.15, w))) {
      shoot(game, drone, 'player', 'drone', drone.angle); drone.cooldown = 0.3;
    }
  }
}

function enemyTarget(game, actor, dt, range) {
  const player = playerActor(game);
  const visible = game.drones.filter(d => !d.dead && distance(actor, d) <= range && clearShot(game, actor, d))
    .sort((a, b) => distance(actor, a) - distance(actor, b));
  actor.targetTime = Math.max(0, (actor.targetTime || 0) - dt);
  if (!visible.length) {
    actor.targetTime = 0;
    actor.targetId = actor.kind !== 'boss' && actor.objective === 'base' && distance(actor, player) > 7 ? 'base' : 'player';
    return actor.targetId === 'base' ? game.base : player;
  }
  if (!actor.targetTime || (actor.targetId !== 'player' && !visible.some(d => d.id === actor.targetId))) {
    actor.targetId = random(game) < 0.3 ? visible[0].id : 'player';
    actor.targetTime = 2;
  }
  return actor.targetId === 'player' ? player : visible.find(d => d.id === actor.targetId);
}

function findRoute(game, actor, target) {
  const cell = n => clamp(Math.round((n + 14) / 2), 0, 14);
  const start = cell(actor.z) * 15 + cell(actor.x);
  const endX = cell(target.x), endZ = cell(target.z);
  const queue = [start], previous = new Map([[start, -1]]);
  let best = start, bestDistance = Infinity;
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i], cx = current % 15, cz = Math.floor(current / 15);
    const d = (cx - endX) ** 2 + (cz - endZ) ** 2;
    if (d < bestDistance) { best = current; bestDistance = d; }
    if (!d) break;
    for (const [nx, nz] of [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]]) {
      const key = nz * 15 + nx;
      if (nx < 0 || nx > 14 || nz < 0 || nz > 14 || previous.has(key)) continue;
      if (!canStand(game, nx * 2 - 14, nz * 2 - 14, radius(actor), actor, true)) continue;
      previous.set(key, current);
      queue.push(key);
    }
  }
  const route = [];
  while (best !== start && previous.has(best)) {
    route.push({ x: (best % 15) * 2 - 14, z: Math.floor(best / 15) * 2 - 14 });
    best = previous.get(best);
  }
  return route.reverse();
}

function bossHazard(game, boss, kind, x, z, fuse) {
  game.hazards.push({ id: ++game.serial, bossId: boss.id, x: clamp(x, -13.8, 13.8), z: clamp(z, -13.8, 13.8),
    radius: boss.enraged ? 2.4 : 2.1, age: 0, fuse, kind });
}

function bossStep(game, boss, dt) {
  if (!boss.enraged && boss.hp <= boss.maxHp / 2) {
    boss.enraged = true;
    if (boss.attack === null) boss.attackTimer = Math.min(boss.attackTimer, 1.25);
    event(game, 'boss-rage', boss, { bossId: boss.id });
  }
  const target = enemyTarget(game, boss, dt, 30);
  boss.attackTimer -= dt;
  boss.turretAngle = boss.attack === 'fan' ? boss.attackAngle : Math.atan2(target.x - boss.x, target.z - boss.z);
  if (boss.attack === null) {
    const oldX = boss.x;
    if (Math.abs(boss.x) >= 10) boss.patrolDirection = boss.x > 0 ? -1 : 1;
    move(game, boss, boss.patrolDirection * 0.8 * dt, clamp(-11 - boss.z, -dt, dt));
    if (Math.abs(boss.x - oldX) < 0.1 * dt) boss.patrolDirection *= -1;
    else boss.angle = boss.patrolDirection * Math.PI / 2;
    if (boss.attackTimer > 0) return;
    const sequence = ['fan', 'grenades', 'barrage'];
    let kind = sequence[boss.attackCount++ % sequence.length];
    if (kind === 'fan' && boss.ammo <= 0) kind = sequence[boss.attackCount++ % sequence.length];
    boss.attack = kind;
    boss.attackDuration = kind === 'fan' ? 1.2 : kind === 'grenades' ? 2.5 : 1.7;
    boss.attackTimer = boss.attackDuration;
    boss.attackAngle = Math.atan2(target.x - boss.x, target.z - boss.z);
    boss.attackShots = 0;
    boss.shotTimer = 0;
    event(game, 'boss-charge', boss, { bossId: boss.id, kind });
    if (kind === 'barrage') for (const [dx, dz] of [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]]) {
      bossHazard(game, boss, kind, target.x + dx, target.z + dz, 1.7);
    }
    return;
  }
  if (boss.attack === 'grenades') {
    boss.shotTimer -= dt;
    if (boss.attackShots < 3 && boss.shotTimer <= 0) {
      // 每次重新鎖定位置，圈落地後固定；玩家有完整的閃避時間。
      bossHazard(game, boss, 'grenades', target.x, target.z, 1.4);
      boss.attackShots++;
      boss.shotTimer = boss.enraged ? 0.35 : 0.5;
    }
  }
  if (boss.attackTimer > 0) return;
  if (boss.attack === 'fan') {
    const count = Math.min(5, boss.ammo);
    for (let i = 0; i < count; i++) shoot(game, boss, 'enemy', 'shell', boss.attackAngle + (i - 2) * 0.17);
  }
  boss.attack = null;
  boss.attackDuration = 0;
  boss.attackTimer = boss.enraged ? 1.25 : 2.5;
}

function enemyStep(game, actor, dt, infantry) {
  if (!infantry && actor.kind === 'boss') { bossStep(game, actor, dt); return; }
  actor.cooldown = Math.max(0, actor.cooldown - dt);
  actor.invulnerable = Math.max(0, (actor.invulnerable || 0) - dt);
  if (infantry) {
    actor.grenadeCooldown = Math.max(0, actor.grenadeCooldown - dt);
    if (actor.bleeding && (actor.bleedAge >= 2.5 || actor.hp <= 8)) startBandage(game, actor, 'enemy');
  }
  else {
    actor.bailCooldown = Math.max(0, actor.bailCooldown - dt);
    actor.bailDriving = Math.max(0, actor.bailDriving - dt);
  }
  const player = playerActor(game);
  const target = enemyTarget(game, actor, dt, infantry ? 11 : 18);
  const d = distance(actor, target);
  if (!infantry && actor.bailCooldown <= 0 && (actor.hp <= actor.maxHp * 0.45
    || (actor.kind === 'apc' ? d < 8 : actor.ammo <= 0)
    || (game.player.tankId === null && distance(actor, player) < 4.8))) {
    if (ejectEnemy(game, actor) && !actor.occupied) return;
  }
  const aim = Math.atan2(target.x - actor.x, target.z - actor.z);
  actor.turretAngle = aim;
  if (infantry) actor.angle = aim;
  const visible = d < (infantry ? 11 : 18) && clearShot(game, actor, target, !infantry);
  if (infantry && d < 5.5 && d > 2.5 && actor.grenadeCooldown <= 0) throwGrenade(game, actor, 'enemy', target.x, target.z);
  if (visible && actor.cooldown <= 0 && (infantry || actor.ammo > 0)) {
    if (shoot(game, actor, 'enemy', infantry ? 'bullet' : 'shell', aim + (random(game) - 0.5) * (infantry ? 0.11 : 0.07))) {
      actor.cooldown = (infantry ? 0.48 : 2.15 + random(game) * 0.65) * game.level.fireScale;
    }
  }
  if (visible && d < (infantry ? 6 : 7) && (infantry || (actor.kind !== 'apc' && actor.bailDriving <= 0))) return;
  actor.routeTime -= dt;
  if (actor.routeTime <= 0) {
    actor.route = findRoute(game, actor, target);
    actor.routeTime = 1.1 + random(game) * 0.3;
  }
  while (actor.route.length && distance(actor, actor.route[0]) < 0.3) actor.route.shift();
  const next = actor.route[0] || target;
  const heading = Math.atan2(next.x - actor.x, next.z - actor.z);
  const speed = infantry ? 2.5 * (actor.bleeding ? 0.75 : 1) : (game.level.enemySpeed + game.wave * 0.18) * ({ tank: 1, scout: 1.23, heavy: 0.83, apc: 1.12 }[actor.kind]);
  const oldX = actor.x, oldZ = actor.z;
  move(game, actor, Math.sin(heading) * speed * dt, Math.cos(heading) * speed * dt);
  // ponytail: 小地圖使用格網尋路加局部避車；大量車輛再升級群體避障。
  if (Math.hypot(actor.x - oldX, actor.z - oldZ) < speed * dt * 0.2) {
    const turn = heading + (actor.id % 2 ? 1 : -1) * Math.PI / 2;
    move(game, actor, Math.sin(turn) * speed * dt, Math.cos(turn) * speed * dt);
  }
  if (!infantry && Math.hypot(actor.x - oldX, actor.z - oldZ) > 0.002) actor.angle = Math.atan2(actor.x - oldX, actor.z - oldZ);
}

function startBleeding(game, actor, team, sourceTeam) {
  if (actor.hp <= 0 || actor.bleeding || random(game) >= 0.25) return;
  actor.bleeding = true;
  actor.bleedTimer = 0;
  actor.bleedAge = 0;
  actor.bleedSource = sourceTeam;
  event(game, 'bleed-start', actor, { team, targetId: actor === game.player ? 'player' : actor.id });
}

function hitPlayer(game, damage, sourceTeam, cause) {
  const player = game.player;
  if (player.dead || player.hp <= 0) return;
  const actualDamage = Math.min(player.hp, damage);
  player.hp -= actualDamage;
  event(game, 'hit', player, { kind: 'player', targetTeam: 'player', sourceTeam, damage: actualDamage, ...(cause ? { cause } : {}) });
  if (!cause && actualDamage > 0) startBleeding(game, player, 'player', sourceTeam);
}

function hitTank(game, tank, damage, sourceTeam, point = tank) {
  const actualDamage = Math.min(tank.hp, damage);
  event(game, 'hit', point, { kind: 'tank', targetTeam: tank.team, sourceTeam, targetId: tank.id, damage: actualDamage });
  tank.hp -= actualDamage;
  if (tank.hp <= 0) destroyTank(game, tank, sourceTeam);
}

function hitDrone(game, drone, damage, sourceTeam) {
  const actualDamage = Math.min(drone.hp, damage);
  drone.hp -= actualDamage;
  event(game, 'hit', drone, { kind: 'drone', targetTeam: 'player', sourceTeam, targetId: drone.id, damage: actualDamage });
  if (drone.hp <= 0) {
    drone.dead = true;
    event(game, 'explosion', drone, { kind: 'drone', team: 'player', targetId: drone.id, angle: drone.angle, size: 0.8 });
  }
}

function hitBase(game, base, damage, sourceTeam) {
  base.hp = Math.max(0, base.hp - damage);
  event(game, 'hit', base, { kind: 'base', targetTeam: base === game.base ? 'player' : 'enemy', sourceTeam });
  if (base.hp <= 0 && !base.dead) {
    base.dead = true;
    event(game, 'explosion', base, { size: 2.5, kind: 'base' });
  }
}

function hitInfantry(game, enemy, damage, sourceTeam, cause) {
  if (enemy.dead || enemy.hp <= 0) return;
  const actualDamage = Math.min(enemy.hp, damage);
  enemy.hp -= actualDamage;
  event(game, 'hit', enemy, { kind: 'infantry', targetTeam: 'enemy', sourceTeam, damage: actualDamage, ...(cause ? { cause } : {}) });
  if (!cause && actualDamage > 0) startBleeding(game, enemy, 'enemy', sourceTeam);
  if (enemy.hp <= 0) {
    enemy.dead = true;
    game.kills++;
    if (sourceTeam === 'player') game.score += 120;
    event(game, 'explosion', enemy, { size: 0.45, ...(cause ? { cause } : {}) });
    if (game.kills % 3 === 0) {
      const drop = random(game);
      game.pickups.push({ id: ++game.serial, x: enemy.x, z: enemy.z, kind: drop < 0.25 ? 'drone' : drop < 0.5 ? 'missile' : 'repair', dead: false });
    }
  }
}

function explodeGrenade(game, grenade) {
  event(game, 'explosion', grenade, { size: 2.4, kind: 'grenade', team: grenade.team });
  for (const wall of game.walls) if (!wall.dead && wall.kind === 'brick' && rectHit(grenade.x, grenade.z, 2.4, wall)) {
    wall.hp -= 80;
    if (wall.hp <= 0) { wall.dead = true; event(game, 'explosion', wall, { size: 0.8 }); }
  }
  for (const tank of game.tanks) if (!tank.dead && distance(tank, grenade) < 2.4 + radius(tank)) {
    hitTank(game, tank, 65, grenade.team);
  }
  for (const drone of game.drones) if (!drone.dead && distance(drone, grenade) < 2.4 + radius(drone)) hitDrone(game, drone, 65, grenade.team);
  for (const enemy of game.enemies) if (!enemy.dead && enemy.invulnerable <= 0 && distance(enemy, grenade) < 2.72) hitInfantry(game, enemy, 75, grenade.team);
  if (game.player.tankId === null && game.player.invulnerable <= 0 && distance(game.player, grenade) < 2.72) {
    hitPlayer(game, 75, grenade.team);
  }
  for (const base of [game.base, ...game.enemyBases]) if (!base.dead && distance(base, grenade) < 3.3) hitBase(game, base, 90, grenade.team);
}

function explodeBossHazard(game, hazard) {
  event(game, 'explosion', hazard, { kind: 'boss', size: hazard.radius });
  for (const wall of game.walls) if (!wall.dead && wall.kind === 'brick' && rectHit(hazard.x, hazard.z, hazard.radius, wall)) {
    wall.hp -= 80;
    if (wall.hp <= 0) { wall.dead = true; event(game, 'explosion', wall, { size: 0.8 }); }
  }
  for (const tank of game.tanks) if (!tank.dead && tank.kind !== 'boss' && distance(tank, hazard) < hazard.radius + radius(tank)) hitTank(game, tank, 32, 'enemy');
  for (const drone of game.drones) if (!drone.dead && distance(drone, hazard) < hazard.radius + radius(drone)) hitDrone(game, drone, 32, 'enemy');
  for (const enemy of game.enemies) if (!enemy.dead && enemy.invulnerable <= 0 && distance(enemy, hazard) < hazard.radius + radius(enemy)) hitInfantry(game, enemy, 34, 'enemy');
  if (game.player.tankId === null && game.player.invulnerable <= 0 && distance(game.player, hazard) < hazard.radius + radius(game.player)) hitPlayer(game, 34, 'enemy');
  for (const base of [game.base, ...game.enemyBases]) if (!base.dead && distance(base, hazard) < hazard.radius + 0.9) hitBase(game, base, 24, 'enemy');
}

function bulletHit(game, bullet) {
  const missile = bullet.kind === 'missile', r = missile || bullet.kind === 'shell' ? 0.15 : 0.07;
  const wall = game.walls.find(w => !w.dead && w.kind !== 'water' && rectHit(bullet.x, bullet.z, r, w));
  if (wall) {
    if (wall.kind === 'brick') {
      wall.hp -= missile ? 64 : bullet.kind === 'shell' ? 36 : 1.5;
      if (wall.hp <= 0) { wall.dead = true; event(game, 'explosion', wall, { size: 0.8 }); }
    }
    event(game, 'hit', bullet, { kind: wall.kind });
    return true;
  }
  const drone = game.drones.find(d => !d.dead && d.id !== bullet.ownerId && distance(d, bullet) < radius(d) + r);
  if (drone) {
    const damage = missile ? 40 : bullet.kind === 'shell' ? (bullet.team === 'player' ? 32 : 22) : bullet.kind === 'drone' ? 6 : bullet.team === 'player' ? 13 : 7;
    hitDrone(game, drone, damage, bullet.team);
    return true;
  }
  const tank = game.tanks.find(t => !t.dead && t.id !== bullet.ownerId && t.team !== bullet.team && distance(t, bullet) < radius(t) + r);
  if (tank) {
    hitTank(game, tank, missile ? 50 : bullet.kind === 'shell' ? (bullet.team === 'player' ? 32 : 22) : (bullet.team === 'player' ? 3 : 1.5), bullet.team, bullet);
    return true;
  }
  const base = [game.base, ...game.enemyBases].find(base => !base.dead && distance(base, bullet) < 0.95 + r);
  if (base) {
    hitBase(game, base, missile ? 42 : bullet.kind === 'shell' ? (bullet.team === 'player' ? 36 : 22) : 3, bullet.team);
    return true;
  }
  if (bullet.team === 'player') {
    const enemy = game.enemies.find(e => !e.dead && e.invulnerable <= 0 && distance(e, bullet) < 0.4 + r);
    if (enemy) {
      hitInfantry(game, enemy, missile ? 38 : bullet.kind === 'shell' ? 55 : bullet.kind === 'drone' ? 6 : 13, bullet.team);
      return true;
    }
  } else {
    if (game.player.tankId === null && game.player.invulnerable <= 0 && distance(game.player, bullet) < 0.36 + r) {
      hitPlayer(game, missile ? 38 : bullet.kind === 'shell' ? 32 : 7, bullet.team);
      return true;
    }
  }
  return false;
}

function baseSupply(game, dt) {
  const base = game.base;
  if (base.dead || base.hp <= 0 || game.player.dead || game.player.hp <= 0) return;
  base.supplyTimer = Math.max(0, base.supplyTimer - dt);
  if (base.supplyTimer > 1e-9) return;
  const kind = ['ammo', 'drone', 'missile'][base.supplyIndex];
  if (!game.pickups.some(p => !p.dead && p.origin === 'base' && p.kind === kind)) {
    const actor = playerActor(game), r = radius(actor);
    let spot;
    for (const reach of [2.5, 3.25, 4]) {
      for (let i = 0; i < 24; i++) {
        const angle = actor.angle + i * TAU / 24;
        const candidate = { x: actor.x + Math.sin(angle) * reach, z: actor.z + Math.cos(angle) * reach };
        if (game.pickups.some(p => !p.dead && distance(p, candidate) < 1.4)) continue;
        const steps = Math.ceil(reach / 0.25);
        let clear = true;
        for (let j = 1; j <= steps; j++) {
          if (!canStand(game, actor.x + (candidate.x - actor.x) * j / steps,
            actor.z + (candidate.z - actor.z) * j / steps, r, actor)) { clear = false; break; }
        }
        if (clear) { spot = candidate; break; }
      }
      if (spot) break;
    }
    if (!spot) { base.supplyTimer = 1; return; }
    const pickup = { id: ++game.serial, ...spot, kind, origin: 'base', dropTime: 1, dead: false };
    game.pickups.push(pickup);
    event(game, 'base-supply', pickup, { kind, pickupId: pickup.id });
  }
  base.supplyIndex = (base.supplyIndex + 1) % 3;
  base.supplyTimer = 25;
}

function simulate(game, input, dt, missileRequest) {
  game.time += dt;
  game.grace = Math.max(0, game.grace - dt);
  const player = game.player, actor = playerActor(game);
  bodyTimers(game, player, 'player', dt);
  for (const enemy of game.enemies) bodyTimers(game, enemy, 'enemy', dt);
  for (const tank of game.tanks) {
    tank.missileCooldown = Math.max(0, tank.missileCooldown - dt);
    tank.crushContacts = tank.crushContacts.filter(id => {
      const body = id === 'player' ? player : game.enemies.find(enemy => enemy.id === id);
      return body && !body.dead && body.hp > 0 && (body !== player || player.tankId === null)
        && distance(tank, body) <= radius(tank) + radius(body) + 0.02;
    });
  }
  if (!input.fire && player.reloadTime <= 0) player.fireLocked = false;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.grenadeCooldown = Math.max(0, player.grenadeCooldown - dt);
  const moving = Math.hypot(input.moveX || 0, input.moveZ || 0);
  const mx = (input.moveX || 0) / Math.max(1, moving), mz = (input.moveZ || 0) / Math.max(1, moving);
  const boost = movementBoost(game, actor, Boolean(input.boost), moving, dt);
  if (moving) {
    actor.angle = Math.atan2(mx, mz);
    const speed = (player.tankId === null ? 5.5 * (player.bleeding ? 0.75 : 1) : 4.7) * boost;
    move(game, actor, mx * speed * dt, mz * speed * dt);
  }
  if (Number.isFinite(input.aimX) && Number.isFinite(input.aimZ)) {
    const aim = Math.atan2(input.aimX - actor.x, input.aimZ - actor.z);
    if (player.tankId === null) actor.angle = aim;
    else actor.turretAngle = aim;
  } else if (player.tankId !== null && moving) actor.turretAngle = actor.angle;
  if (missileRequest) launchMissile(game, input);
  actor.cooldown = Math.max(0, actor.cooldown - dt);
  if (input.fire && actor.cooldown <= 0 && player.bandageTime <= 0 && (player.tankId !== null || (!player.fireLocked && player.reloadTime <= 0))) {
    const kind = player.tankId === null ? 'bullet' : 'shell';
    if (shoot(game, actor, 'player', kind, kind === 'shell' ? actor.turretAngle : actor.angle)) actor.cooldown = kind === 'shell' ? 0.46 : 0.095;
    else if (kind === 'shell') { event(game, 'empty', actor, { team: 'player' }); actor.cooldown = 0.65; }
  }
  if (input.throwGrenade && player.tankId === null) throwGrenade(game, player, 'player',
    Number.isFinite(input.aimX) ? input.aimX : player.x + Math.sin(player.angle) * 7,
    Number.isFinite(input.aimZ) ? input.aimZ : player.z + Math.cos(player.angle) * 7);
  if (player.tankId !== null) { player.x = actor.x; player.z = actor.z; }
  if (game.spawnsPending > 0) {
    game.spawnRetry -= dt;
    if (game.spawnRetry <= 0) spawnEnemies(game);
  }
  if (game.grace <= 0) {
    for (const tank of game.tanks) if (!tank.dead && tank.occupied && tank.team === 'enemy') enemyStep(game, tank, dt, false);
    for (const enemy of game.enemies) if (!enemy.dead) enemyStep(game, enemy, dt, true);
  }
  for (const drone of game.drones) if (!drone.dead) droneStep(game, drone, dt);
  for (const bullet of game.bullets) {
    bullet.life -= dt;
    const rifle = bullet.kind === 'bullet', missile = bullet.kind === 'missile';
    if (missile && bullet.life > 0) guideMissile(game, bullet, dt);
    if (rifle) { bullet.range ??= 15; bullet.traveled ??= 0; bullet.tailAngle ??= 0; }
    let travel = Math.min((missile ? 13 : bullet.kind === 'shell' ? 20 : 32) * dt, rifle ? bullet.range - bullet.traveled : Infinity);
    while (travel > 1e-9 && bullet.life > 0) {
      if (rifle && !bullet.tailSpread && bullet.traveled >= bullet.range * 0.65 - 1e-9) {
        if (bullet.dx || bullet.dz) {
          const angle = Math.atan2(bullet.dx, bullet.dz) + bullet.tailAngle;
          bullet.dx = Math.sin(angle); bullet.dz = Math.cos(angle);
        }
        bullet.tailSpread = true;
      }
      const segment = Math.min(0.12, travel, rifle && !bullet.tailSpread ? bullet.range * 0.65 - bullet.traveled : Infinity);
      bullet.x += bullet.dx * segment;
      bullet.z += bullet.dz * segment;
      if (rifle) bullet.traveled += segment * Math.hypot(bullet.dx, bullet.dz);
      travel -= segment;
      if (Math.abs(bullet.x) > 15 || Math.abs(bullet.z) > 15 || bulletHit(game, bullet)) bullet.life = 0;
      if (rifle && bullet.traveled >= bullet.range - 1e-9) bullet.life = 0;
    }
    if (missile && bullet.life <= 0) event(game, 'explosion', bullet, { kind: 'missile', team: bullet.team, size: 0.8 });
  }
  game.bullets = game.bullets.filter(b => b.life > 0);
  for (const grenade of game.grenades) {
    grenade.age += dt;
    const progress = Math.min(1, grenade.age / grenade.fuse);
    grenade.x = grenade.startX + (grenade.targetX - grenade.startX) * progress;
    grenade.z = grenade.startZ + (grenade.targetZ - grenade.startZ) * progress;
    if (grenade.age >= grenade.fuse) { grenade.dead = true; explodeGrenade(game, grenade); }
  }
  game.grenades = game.grenades.filter(g => !g.dead);
  for (const hazard of game.hazards) {
    if (!game.tanks.some(t => t.id === hazard.bossId && !t.dead)) { hazard.dead = true; continue; }
    hazard.age += dt;
    if (hazard.age >= hazard.fuse) { hazard.dead = true; explodeBossHazard(game, hazard); }
  }
  game.hazards = game.hazards.filter(h => !h.dead);
  if (player.hp <= 0 && !player.dead) {
    player.dead = true;
    event(game, 'death', player, { kind: 'player', team: 'player', angle: player.angle });
  }
  if (game.base.hp <= 0 || player.dead) { game.phase = 'lost'; return; }
  for (const pickup of game.pickups) {
    if (pickup.dead) continue;
    if (pickup.dropTime > 0) {
      pickup.dropTime = Math.max(0, pickup.dropTime - dt);
      if (pickup.dropTime > 1e-9) continue;
      pickup.dropTime = 0;
    }
    if (distance(playerActor(game), pickup) >= 1.3) continue;
    const current = playerActor(game);
    if (pickup.kind === 'missile' && (player.tankId === null || current.maxMissiles <= 0 || current.missiles >= current.maxMissiles)) continue;
    const ammoAdded = pickup.kind === 'ammo' && player.tankId !== null ? Math.max(0, Math.min(5, current.maxAmmo - current.ammo)) : 0;
    const grenadesAdded = pickup.kind === 'ammo' ? Math.max(0, Math.min(1, player.maxGrenades - player.grenades)) : 0;
    if (pickup.kind === 'ammo' && !ammoAdded && !grenadesAdded) continue;
    pickup.dead = true;
    let amount;
    if (pickup.kind === 'drone') player.droneKits++;
    else if (pickup.kind === 'missile') {
      amount = Math.min(4, current.maxMissiles - current.missiles);
      current.missiles += amount;
    }
    else if (pickup.kind === 'ammo') {
      if (ammoAdded) current.ammo += ammoAdded;
      player.grenades += grenadesAdded;
    }
    else {
      current.hp = Math.min(current.maxHp, current.hp + 45);
      player.hp = Math.min(player.maxHp, player.hp + 25);
    }
    event(game, 'pickup', pickup, { kind: pickup.kind, ...(amount === undefined ? {} : { amount }),
      ...(pickup.kind === 'ammo' ? { ammoAdded, grenadesAdded } : {}) });
  }
  if (game.enemyBases.length && game.enemyBases.every(base => base.dead || base.hp <= 0)) { game.phase = 'won'; return; }
  const remaining = game.spawnsPending > 0 || game.tanks.some(t => !t.dead && t.occupied && t.team === 'enemy') || game.enemies.some(e => !e.dead);
  if (!remaining) {
    if (game.wave === game.level.waves.length) { game.phase = 'won'; return; }
    if (!game.wavePending) { game.wavePending = 2.5; event(game, 'message', player, { text: '區域淨空 · 增援即將抵達' }); }
    game.wavePending -= dt;
    if (game.wavePending <= 0) {
      game.wave++;
      game.score += 250;
      player.hp = Math.min(player.maxHp, player.hp + 15);
      spawnWave(game);
    }
  }
  baseSupply(game, dt);
}

export function step(game, input = {}, dt = 1 / 60) {
  game.events = [];
  if (game.phase !== 'playing') return;
  let remaining = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
  if (remaining > 0 && input.bandage) startBandage(game, game.player, 'player');
  if (remaining > 0 && input.reload) startReload(game, game.player, 'player');
  if (remaining > 0 && input.deployDrone) deployDrone(game);
  let missileRequest = Boolean(input.fireMissile);
  while (remaining > 0 && game.phase === 'playing') {
    const chunk = Math.min(remaining, 1 / 60);
    simulate(game, input, chunk, missileRequest);
    missileRequest = false;
    remaining -= chunk;
  }
}
