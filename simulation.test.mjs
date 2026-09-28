import assert from 'node:assert/strict';
import { createGame, step, interact, playerActor } from './simulation.mjs';
import { LEVELS, getLevel } from './levels.mjs';

const start = () => Object.assign(createGame({ seed: 7 }), { phase: 'playing' });
const run = (game, seconds, input = {}) => { for (let i = 0; i < seconds * 60; i++) step(game, input, 1 / 60); };
const quiet = game => { game.grace = 1000; return game; };
const aliveEnemies = game => [...game.tanks.filter(t => !t.dead && t.team === 'enemy'), ...game.enemies.filter(e => !e.dead)];

// 實際地圖的牆面阻擋、斜向速度、上下車與獨立血量。
const game = quiet(start());
const tank = playerActor(game);
run(game, 1, { moveZ: 1 });
assert(tank.z < 9.4, '基地前的磚牆應擋住坦克');
assert.equal(interact(game), true);
assert.equal(game.player.tankId, null);
assert.equal(tank.occupied, false);
game.player.hp = 67;
assert.equal(interact(game), true);
assert.equal(game.player.hp, 67);
assert.equal(tank.hp, 140);
assert.equal(tank.originTeam, 'player');
assert.equal(game.events.at(-1).stolen, false);
tank.x = 0; tank.z = 1;
run(game, 0.5, { moveX: 1, moveZ: 1 });
assert(Math.hypot(tank.x, tank.z - 1) <= 4.7 * 0.5 + 0.001);

// 高速子彈不穿牆，坦克受損時敵人只跳車一次。
const combat = start();
combat.walls = [];
combat.grace = 0;
const foe = combat.tanks.find(t => t.team === 'enemy');
foe.x = 0; foe.z = 3; foe.hp = 33;
const friendly = playerActor(combat);
friendly.cooldown = 0;
run(combat, 0.3, { fire: true, aimX: 0, aimZ: -10 });
assert.equal(foe.occupied, false);
assert.equal(foe.team, 'neutral');
assert.equal(combat.enemies.length, 1);
run(combat, 0.2);
assert.equal(combat.enemies.length, 1);
assert(foe.hp < 33, '炮彈應擊中前方棄置坦克');
const infantry = combat.enemies[0];
infantry.invulnerable = 0;
combat.bullets.push({ id: 9999, x: infantry.x, z: infantry.z - 0.1, dx: 0, dz: 1, kind: 'shell', team: 'player', life: 1 });
step(combat, {}, 1 / 60);
assert(infantry.dead);
assert.equal(combat.kills, 1);
const infantryHit = combat.events.find(e => e.type === 'hit' && e.kind === 'infantry');
assert.equal(infantryHit.targetTeam, 'enemy');
assert.equal(infantryHit.sourceTeam, 'player');
assert.equal(interact(combat), true);
combat.player.x = foe.x + 1.4; combat.player.z = foe.z;
assert.equal(interact(combat), true);
assert.equal(foe.originTeam, 'enemy');
assert.equal(combat.events.at(-1).stolen, true);
assert.equal(interact(combat), true);
assert.equal(interact(combat), true);
assert.equal(combat.player.tankId, foe.id);
assert.equal(combat.events.at(-1).stolen, false);

// 擊毀車輛前保存命中陣營，避免棄車或奪車後誤播敵方語音。
for (const targetTeam of ['enemy', 'neutral', 'player']) {
  const metadata = quiet(start());
  metadata.walls = [];
  const target = targetTeam === 'player' ? playerActor(metadata) : metadata.tanks.find(t => t.team === 'enemy');
  target.team = targetTeam; target.hp = 1;
  const sourceTeam = targetTeam === 'player' ? 'enemy' : 'player';
  metadata.bullets = [{ id: 999, x: target.x, z: target.z, dx: 0, dz: 1, kind: 'shell', team: sourceTeam, life: 1 }];
  step(metadata);
  const hit = metadata.events.find(e => e.type === 'hit' && e.kind === 'tank');
  assert.equal(hit.targetTeam, targetTeam);
  assert.equal(hit.sourceTeam, sourceTeam);
  assert.equal(hit.damage, 1);
  assert.equal(hit.targetId, target.id);
  assert.equal(target.dead, true);
  const wreck = metadata.events.find(e => e.type === 'explosion' && e.kind === 'tank');
  assert.equal(wreck.team, targetTeam);
  assert.equal(wreck.targetId, target.id);
  assert.equal(wreck.angle, target.angle);
}

const wallGame = quiet(start());
wallGame.walls = [{ id: 1, x: 0, z: 4, w: 2, d: 0.1, hp: 64, maxHp: 64, kind: 'brick', dead: false }];
wallGame.bullets = [{ id: 2, x: 0, z: 5, dx: 0, dz: -1, kind: 'shell', team: 'player', life: 2 }];
step(wallGame, {}, 0.1);
assert.equal(wallGame.walls[0].hp, 28);
assert.equal(wallGame.bullets.length, 0);

const closeWall = quiet(start());
const closeTank = playerActor(closeWall);
closeTank.cooldown = 0;
closeWall.walls = [{ id: 1, x: 0, z: closeTank.z - 0.94, w: 2, d: 0.12, hp: 64, maxHp: 64, kind: 'brick', dead: false }];
run(closeWall, 0.15, { fire: true, aimX: 0, aimZ: -14 });
assert.equal(closeWall.walls[0].hp, 28, '貼牆開炮也不能穿過薄牆');

const siege = start();
siege.grace = 0;
playerActor(siege).x = 12;
const attacker = siege.tanks.find(t => t.team === 'enemy');
attacker.x = 0; attacker.z = 5; attacker.cooldown = 0; attacker.objective = 'base';
siege.tanks = [playerActor(siege), attacker];
run(siege, 8);
assert(siege.walls.find(w => w.x === 0 && w.z === 10.4).dead, '敵方炮彈應突破基地磚牆');
assert(siege.base.hp < 500, '磚牆毀損後基地應受到攻擊');

// 基地耐久提高，但友軍也會誤傷；三波清空勝利，基地毀損失敗。
const waves = quiet(start());
assert.equal(waves.base.maxHp, 500);
waves.walls = [];
waves.bullets.push({ id: 100, x: 0, z: 11.1, dx: 0, dz: 1, team: 'player', kind: 'shell', life: 1 });
run(waves, 0.2);
assert.equal(waves.base.hp, 464);
for (const t of waves.tanks) if (t.team === 'enemy') t.dead = true;
run(waves, 2.6);
assert.equal(waves.wave, 2);
assert.equal(aliveEnemies(waves).length, 4);
waves.wave = 3;
for (const t of waves.tanks) if (t.team === 'enemy') t.dead = true;
for (const e of waves.enemies) e.dead = true;
step(waves);
assert.equal(waves.phase, 'won');
const loss = start();
loss.base.hp = 0;
step(loss);
assert.equal(loss.phase, 'lost');

// 五十張實際不同的配置；用坦克圓形足跡及路段採樣驗證兩格 AI 路網。
assert.equal(LEVELS.length, 50);
assert.equal(new Set(LEVELS.map(level => level.name)).size, 50);
assert.equal(new Set(LEVELS.map(level => JSON.stringify(level.walls.map(({ x, z, w, d }) => [x, z, w, d]).sort()))).size, 50);
const themes = ['urban', 'forest', 'desert', 'snow', 'harbor', 'factory', 'swamp', 'volcano', 'ruins', 'citadel'];
const clearAt = (state, x, z, radius = 0.83) => Math.abs(x) <= 14.65 - radius && Math.abs(z) <= 14.65 - radius
  && [state.base, ...state.enemyBases].every(base => base.dead || Math.hypot(x - base.x, z - base.z) >= radius + 0.9)
  && !state.walls.some(w => !w.dead && Math.hypot(Math.max(Math.abs(x - w.x) - w.w / 2, 0), Math.max(Math.abs(z - w.z) - w.d / 2, 0)) < radius);
const segmentClear = (state, from, to, radius = 0.83) => Array.from({ length: 11 }, (_, i) => i / 10)
  .every(t => clearAt(state, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, radius));
const partitionBlocks = (state, from, to) => {
  const samples = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.1);
  for (let i = 1; i < samples; i++) {
    const x = from.x + (to.x - from.x) * i / samples, z = from.z + (to.z - from.z) * i / samples;
    if (state.walls.some(w => w.kind !== 'water' && w.z > -9 && w.z < 8
      && Math.abs(x - w.x) <= w.w / 2 && Math.abs(z - w.z) <= w.d / 2)) return true;
  }
  return false;
};
const bossLevels = new Set();
for (const level of LEVELS) {
  assert.equal(level.id, LEVELS.indexOf(level) + 1);
  assert.equal(level.theme, themes[Math.floor((level.id - 1) / 5)]);
  assert(level.walls.length < 45);
  assert(level.enemyHp >= 80 && level.enemyHp <= 112);
  assert(level.enemySpeed >= 2.3 && level.enemySpeed <= 2.9);
  assert(level.fireScale >= 0.82 && level.fireScale <= 1);
  assert.equal(level.waves.length, 3);
  assert(level.waves.every(count => Number.isInteger(count) && count >= 3 && count <= 8));
  const campaign = Object.assign(createGame({ level: level.id }), { phase: 'playing', grace: 1000 });
  assert.deepEqual(campaign.level, level);
  assert.equal(campaign.enemyBases.length, level.enemyBaseCount);
  assert(level.enemyBaseCount >= 1 && level.enemyBaseCount <= 5);
  assert(clearAt(campaign, 0, 8.5), `第 ${level.id} 關玩家出生點遭阻擋`);
  for (const hq of campaign.enemyBases) {
    assert(partitionBlocks(campaign, campaign.player, hq), `第 ${level.id} 關起點可直接射穿至敵方 HQ`);
    assert(partitionBlocks(campaign, hq, campaign.base), `第 ${level.id} 關兩軍 HQ 間缺少中央隔牆`);
  }
  const queue = [{ x: 0, z: 8 }], reached = new Set(['0,8']);
  for (let index = 0; index < queue.length; index++) {
    const from = queue[index];
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const to = { x: from.x + dx, z: from.z + dz }, key = `${to.x},${to.z}`;
      if (!reached.has(key) && segmentClear(campaign, from, to, 1)) { reached.add(key); queue.push(to); }
    }
  }
  for (let wave = 0; wave < level.waves.length; wave++) {
    assert.equal(campaign.wave, wave + 1);
    assert.equal(campaign.spawnsPending, 0);
    const enemies = aliveEnemies(campaign);
    assert.equal(enemies.length, level.waves[wave], `第 ${level.id} 關第 ${wave + 1} 波數量不符`);
    const bosses = enemies.filter(e => e.kind === 'boss');
    assert.equal(bosses.length, level.id % 5 === 0 && wave === 2 ? 1 : 0);
    for (const enemy of enemies) {
      if (enemy.kind === 'boss') {
        bossLevels.add(level.id);
        assert.equal(enemy.maxHp, 520 + level.id * 6);
        assert.equal(enemy.crew, 6);
      } else if (enemy.kind) assert.equal(enemy.maxHp, Math.round(level.enemyHp * ({ tank: 1, scout: 0.72, heavy: 1.45, apc: 0.85 }[enemy.kind])));
      assert(clearAt(campaign, enemy.x, enemy.z, enemy.kind === 'boss' ? 1.3 : 0.83), `第 ${level.id} 關敵軍出生點遭阻擋`);
      assert(!enemies.some(t => !t.dead && t !== enemy && Math.hypot(t.x - enemy.x, t.z - enemy.z) < (enemy.kind === 'boss' || t.kind === 'boss' ? 2.13 : 1.66)));
      const node = { x: Math.round(enemy.x / 2) * 2, z: enemy.kind === 'boss' ? -10 : Math.round(enemy.z / 2) * 2 };
      assert(reached.has(`${node.x},${node.z}`) && segmentClear(campaign, enemy, node), `第 ${level.id} 關敵軍無法走到玩家區域`);
      enemy.dead = true;
    }
    run(campaign, wave === level.waves.length - 1 ? 0.02 : 2.6);
  }
  assert.equal(campaign.phase, 'won', `第 ${level.id} 關第三波結束未獲勝`);
}
assert.deepEqual([...bossLevels], Array.from({ length: 10 }, (_, i) => (i + 1) * 5));
assert.equal(getLevel(0).id, 1);
assert.equal(getLevel(99).id, 50);
assert.equal(getLevel('17.9').id, 17);
for (const invalid of [undefined, null, {}, [], NaN, Infinity, 'oops']) assert.equal(getLevel(invalid).id, 1);
assert.equal(createGame({ level: 50 }).level.id, 50);

// 北側被棄車／地形堵塞時，尚未入場的增援不可被算成已消滅。
const blocked = Object.assign(createGame({ level: 50 }), { phase: 'playing', grace: 1000 });
for (const t of blocked.tanks) if (t.team === 'enemy') t.dead = true;
for (const e of blocked.enemies) e.dead = true;
blocked.walls.push({ x: 0, z: -12, w: 28, d: 4, kind: 'steel', dead: false });
run(blocked, 5);
assert.equal(blocked.wave, 2);
assert.equal(blocked.spawnsPending, 7);
assert.equal(blocked.phase, 'playing');
blocked.walls.pop();
run(blocked, 0.6);
assert.equal(blocked.spawnsPending, 0);
assert.equal(aliveEnemies(blocked).length, 7);

// 所有有炮的車只有十五發；乾扣扳機節流，事件帶出剩餘彈藥。
const magazine = quiet(start()), shots = [], emptyTimes = [];
assert.equal(playerActor(magazine).ammo, 15);
for (let i = 0; i < 660; i++) {
  step(magazine, { fire: true, aimX: 14, aimZ: 8.5 });
  for (const e of magazine.events) {
    if (e.type === 'shot' && e.team === 'player') shots.push(e.ammoRemaining);
    if (e.type === 'empty') emptyTimes.push(magazine.time);
  }
}
assert.deepEqual(shots, Array.from({ length: 15 }, (_, i) => 14 - i));
assert.equal(playerActor(magazine).ammo, 0);
assert(emptyTimes.length >= 2 && emptyTimes.every((time, i) => i === 0 || time - emptyTimes[i - 1] >= 0.5));

// 混合兵種、六人乘員、APC 無武器；部分下車後駕駛仍在移動。
const kinds = new Set(), crews = new Set();
for (const level of LEVELS) for (const enemy of aliveEnemies(createGame({ level: level.id }))) {
  kinds.add(enemy.kind || 'infantry');
  if (enemy.kind) { crews.add(enemy.crew); assert.equal(enemy.ammo, enemy.kind === 'apc' ? 0 : 15); }
}
assert.deepEqual([...kinds].sort(), ['apc', 'heavy', 'infantry', 'scout', 'tank']);
assert(crews.has(1) && crews.has(6));
const carrier = Object.assign(createGame({ level: 2 }), { phase: 'playing', grace: 0 });
const apc = carrier.tanks.find(t => t.kind === 'apc');
carrier.tanks = [playerActor(carrier), apc]; carrier.enemies = []; carrier.walls = [];
apc.x = 0; apc.z = 2; apc.objective = 'player';
const originalCrew = apc.crew;
step(carrier, {}, 0.1);
assert.equal(apc.crew, originalCrew - 1);
assert.equal(apc.occupied, true);
assert.equal(apc.team, 'enemy');
assert(Math.hypot(apc.x, apc.z - 2) > 0.05);
assert.equal(carrier.events.find(e => e.type === 'eject').remainingCrew, apc.crew);
let carrierShells = 0;
playerActor(carrier).hp = 10000;
for (let i = 0; i < 660; i++) { step(carrier); carrierShells += carrier.events.filter(e => e.type === 'shot' && e.kind === 'shell').length; }
assert.equal(carrierShells, 0);
assert.equal(apc.crew, 0);
assert.equal(apc.team, 'neutral');

const emptyEnemy = start();
emptyEnemy.grace = 0; emptyEnemy.walls = [];
const emptyTank = emptyEnemy.tanks.find(t => t.team === 'enemy');
emptyEnemy.tanks = [playerActor(emptyEnemy), emptyTank]; emptyTank.ammo = 0; emptyTank.crew = 3;
run(emptyEnemy, 4.2);
assert.equal(emptyTank.crew, 0);
assert.equal(emptyEnemy.enemies.length, 3);

const crewDeath = quiet(start()), doomed = crewDeath.tanks.find(t => t.team === 'enemy');
doomed.crew = 6; doomed.hp = 1;
crewDeath.bullets.push({ id: 999, x: doomed.x, z: doomed.z, dx: 0, dz: 1, kind: 'shell', team: 'player', life: 1 });
step(crewDeath);
assert.equal(crewDeath.enemies.length, 6);
assert.deepEqual(crewDeath.events.filter(e => e.type === 'eject').map(e => e.remainingCrew), [5, 4, 3, 2, 1, 0]);
assert(crewDeath.enemies.every(e => clearAt(crewDeath, e.x, e.z, 0.32)));

// 手榴彈飛行與引信、有限庫存、範圍傷害同時影響磚牆、車輛、步兵及基地。
const blast = quiet(start());
assert.equal(interact(blast), true);
blast.player.x = 0; blast.player.z = 3;
const blastTank = blast.tanks.find(t => t.team === 'enemy');
blastTank.x = 2.3; blastTank.z = -3;
blast.enemyBases[0].x = 0; blast.enemyBases[0].z = -5;
blast.walls = [{ x: 0, z: -3, w: 1, d: 1, hp: 64, kind: 'brick', dead: false }];
blast.enemies = [{ id: 999, x: 0, z: -1.3, hp: 38, maxHp: 38, dead: false, invulnerable: 0 }];
step(blast, { throwGrenade: true, aimX: 0, aimZ: -3 });
assert.equal(blast.player.grenades, 2);
assert.equal(blast.grenades.length, 1);
assert(blast.grenades[0].z < 3 && blast.grenades[0].z > -3);
step(blast, { throwGrenade: true, aimX: 0, aimZ: -3 });
assert.equal(blast.player.grenades, 2);
run(blast, 0.7);
assert.equal(blast.enemyBases[0].hp, 180);
assert.equal(blastTank.hp, 80);
let explosion = false, blastImpact;
for (let i = 0; i < 15; i++) {
  step(blast);
  explosion ||= blast.events.some(e => e.type === 'explosion' && e.kind === 'grenade');
  blastImpact ||= blast.events.find(e => e.type === 'hit' && e.kind === 'tank');
}
assert(explosion);
assert.equal(blastImpact.damage, 65);
assert.equal(blastImpact.targetId, blastTank.id);
assert.equal(blastImpact.targetTeam, 'enemy');
assert.equal(blastImpact.sourceTeam, 'player');
assert.equal(blast.grenades.length, 0);
assert(blast.walls[0].dead && blast.enemies[0].dead);
assert.equal(blastTank.hp, 15);
assert.equal(blast.enemyBases[0].hp, 90);
step(blast, { throwGrenade: true, aimX: 14, aimZ: -14 });
assert(Math.hypot(blast.grenades[0].targetX - blast.player.x, blast.grenades[0].targetZ - blast.player.z) <= 8.0001);

const friendlyBlast = quiet(start());
assert.equal(interact(friendlyBlast), true);
friendlyBlast.player.x = 0; friendlyBlast.player.z = 8.5;
step(friendlyBlast, { throwGrenade: true, aimX: 0, aimZ: 12.3 });
run(friendlyBlast, 1);
assert.equal(friendlyBlast.base.hp, 410);
friendlyBlast.base.hp = 36;
friendlyBlast.enemyBases.forEach(base => { base.dead = true; });
friendlyBlast.bullets.push({ id: 999, x: 0, z: 11.5, dx: 0, dz: 1, kind: 'shell', team: 'player', life: 1 });
step(friendlyBlast);
assert.equal(friendlyBlast.base.hp, 0);
assert.equal(friendlyBlast.phase, 'lost', '自軍基地同時被炸毀時應優先判敗');

const headquarters = Object.assign(createGame({ level: 50 }), { phase: 'playing', grace: 1000 });
headquarters.enemyBases.slice(0, -1).forEach(base => { base.dead = true; });
const lastBase = headquarters.enemyBases.at(-1);
lastBase.hp = 36;
headquarters.bullets.push({ id: 999, x: lastBase.x, z: lastBase.z + 0.8, dx: 0, dz: -1, kind: 'shell', team: 'player', life: 1 });
step(headquarters);
assert.equal(headquarters.phase, 'won');
assert.equal(headquarters.wave, 1);
assert(aliveEnemies(headquarters).length > 0);
assert.equal(headquarters.events.find(e => e.type === 'hit' && e.kind === 'base').targetTeam, 'enemy');

const enemyGrenade = Object.assign(createGame({ level: 2 }), { phase: 'playing', grace: 0 });
enemyGrenade.tanks = [playerActor(enemyGrenade)]; enemyGrenade.enemies = enemyGrenade.enemies.slice(0, 1); enemyGrenade.walls = [];
const grenadier = enemyGrenade.enemies[0];
grenadier.x = 0; grenadier.z = 4; grenadier.grenades = 2; grenadier.grenadeCooldown = 0;
step(enemyGrenade);
assert.equal(grenadier.grenades, 1);
assert(enemyGrenade.events.some(e => e.type === 'grenade' && e.team === 'enemy'));
run(enemyGrenade, 1);
assert(playerActor(enemyGrenade).hp < 100);
assert.equal(grenadier.grenades, 1, '敵方手榴彈也應有冷卻時間');

// 身體與裝甲實際扣血事件一致；車毀逃生仍保留無敵時間，並非角色死亡。
const armoredHit = quiet(start()), playerTank = playerActor(armoredHit);
armoredHit.walls = [];
assert.equal(armoredHit.player.dead, false);
armoredHit.bullets.push({ id: 999, x: playerTank.x, z: playerTank.z - 0.1, dx: 0, dz: 1, kind: 'shell', team: 'enemy', life: 1 });
step(armoredHit);
assert.equal(playerTank.hp, 118);
let impact = armoredHit.events.find(e => e.type === 'hit' && e.kind === 'tank');
assert.equal(impact.damage, 22);
assert.equal(impact.targetId, playerTank.id);
assert.equal(impact.targetTeam, 'player');
assert.equal(impact.sourceTeam, 'enemy');
playerTank.hp = 1;
armoredHit.bullets.push({ id: 1000, x: playerTank.x, z: playerTank.z - 0.1, dx: 0, dz: 1, kind: 'shell', team: 'enemy', life: 1 });
step(armoredHit);
assert.equal(armoredHit.player.hp, 80);
assert.equal(armoredHit.player.dead, false);
assert.equal(armoredHit.phase, 'playing');
assert(armoredHit.player.invulnerable > 1.4);
assert(!armoredHit.events.some(e => e.type === 'death'));
impact = armoredHit.events.find(e => e.type === 'hit' && e.kind === 'player');
assert.equal(impact.damage, 20);
assert.equal(impact.targetTeam, 'player');
assert.equal(impact.sourceTeam, 'enemy');
const wreckEvent = armoredHit.events.find(e => e.type === 'explosion' && e.kind === 'tank');
assert.equal(wreckEvent.team, 'player');
assert.equal(wreckEvent.targetId, playerTank.id);
assert.equal(wreckEvent.angle, playerTank.angle);

const footHit = quiet(start());
footHit.walls = []; interact(footHit);
Object.assign(footHit.player, { x: 0, z: 0, invulnerable: 0 });
footHit.bullets.push({ id: 999, x: 0, z: -0.1, dx: 0, dz: 1, kind: 'bullet', team: 'enemy', life: 1 });
step(footHit);
assert.equal(footHit.player.hp, 93);
assert.equal(footHit.events.find(e => e.kind === 'player').damage, 7);
footHit.player.invulnerable = 1;
footHit.bullets.push({ id: 1000, x: 0, z: -0.1, dx: 0, dz: 1, kind: 'bullet', team: 'enemy', life: 1 });
step(footHit);
assert.equal(footHit.player.hp, 93);
assert(!footHit.events.some(e => e.type === 'hit' && e.kind === 'player'));

// 致命子彈、手榴彈及跳車扣血都只送一次死亡；同幀修理包不可復活。
for (const cause of ['bullet', 'grenade', 'ejection']) {
  const fatal = quiet(start());
  fatal.walls = [];
  if (cause === 'ejection') {
    const vehicle = playerActor(fatal);
    vehicle.hp = 1; vehicle.angle = 0; vehicle.turretAngle = 0.8;
    fatal.player.hp = 15;
    fatal.pickups.push({ id: 999, x: 1.45, z: 8.5, kind: 'repair', dead: false });
    fatal.bullets.push({ id: 1000, x: vehicle.x, z: vehicle.z - 0.1, dx: 0, dz: 1, kind: 'shell', team: 'enemy', life: 1 });
  } else {
    interact(fatal);
    Object.assign(fatal.player, { x: 0, z: 0, invulnerable: 0, hp: cause === 'bullet' ? 4 : 40 });
    fatal.pickups.push({ id: 999, x: 0, z: 0, kind: 'repair', dead: false });
    if (cause === 'bullet') for (const id of [1000, 1001]) fatal.bullets.push({ id, x: 0, z: -0.1, dx: 0, dz: 1, kind: 'bullet', team: 'enemy', life: 1 });
    else fatal.grenades.push({ id: 1000, x: 0, z: 0, startX: 0, startZ: 0, targetX: 0, targetZ: 0, age: 0.89, fuse: 0.9, team: 'player' });
  }
  const initialHp = fatal.player.hp;
  step(fatal);
  assert.equal(fatal.player.hp, 0);
  assert.equal(fatal.player.dead, true);
  assert.equal(fatal.phase, 'lost');
  assert.equal(fatal.pickups[0].dead, false);
  const bodyHit = fatal.events.find(e => e.type === 'hit' && e.kind === 'player');
  assert.equal(bodyHit.damage, initialHp);
  assert.equal(bodyHit.targetTeam, 'player');
  assert.equal(bodyHit.sourceTeam, cause === 'grenade' ? 'player' : 'enemy');
  const deaths = fatal.events.filter(e => e.type === 'death');
  assert.equal(deaths.length, 1);
  assert.deepEqual(deaths[0], { type: 'death', x: fatal.player.x, z: fatal.player.z, kind: 'player', team: 'player', angle: fatal.player.angle });
  step(fatal);
  assert.equal(fatal.events.length, 0);
  assert.equal(fatal.player.hp, 0);
}
// Boss 仍屬於原本一波的名額，入口受阻時保留整批增援。
const bossBlocked = Object.assign(createGame({ level: 5 }), { phase: 'playing', grace: 1000 });
aliveEnemies(bossBlocked).forEach(e => { e.dead = true; }); run(bossBlocked, 2.6);
aliveEnemies(bossBlocked).forEach(e => { e.dead = true; });
bossBlocked.walls.push({ x: 0, z: -11, w: 28, d: 2, kind: 'steel', dead: false });
run(bossBlocked, 2.6);
assert.equal(bossBlocked.wave, 3);
assert.equal(bossBlocked.spawnQueue[0].kind, 'boss');
assert.equal(bossBlocked.spawnsPending, bossBlocked.level.waves[2]);
assert.equal(bossBlocked.phase, 'playing');
bossBlocked.walls.pop(); run(bossBlocked, 0.6);
assert.equal(bossBlocked.spawnsPending, 0);
assert.equal(aliveEnemies(bossBlocked).filter(e => e.kind === 'boss').length, 1);

const bossBattle = () => {
  const state = Object.assign(createGame({ level: 5 }), { phase: 'playing', grace: 1000 });
  for (let wave = 0; wave < 2; wave++) { aliveEnemies(state).forEach(e => { e.dead = true; }); run(state, 2.6); }
  const boss = state.tanks.find(t => t.kind === 'boss');
  state.tanks = [playerActor(state), boss]; state.enemies = []; state.walls = []; state.grace = 0;
  playerActor(state).hp = 10000; state.base.hp = 10000;
  return [state, boss];
};
const advanceUntil = (state, condition, input = {}, frames = 3600) => {
  for (let i = 0; i < frames; i++) { step(state, input); if (condition()) return; }
  assert.fail('Boss 狀態未在限定時間內出現');
};

const [telegraph, siegeBoss] = bossBattle();
advanceUntil(telegraph, () => siegeBoss.attack === 'fan');
const lockTime = telegraph.time, lockedAngle = siegeBoss.attackAngle;
run(telegraph, 1, { moveX: 1 });
assert.equal(siegeBoss.attackAngle, lockedAngle);
assert.equal(siegeBoss.ammo, 15, '扇形炮擊不可在預警完成前開火');
advanceUntil(telegraph, () => siegeBoss.ammo < 15);
assert(telegraph.time - lockTime >= 1.2 - 1e-9);
const fan = telegraph.events.filter(e => e.type === 'shot');
assert.equal(fan.length, 5);
fan.forEach((shot, i) => assert(Math.abs(shot.angle - (lockedAngle + (i - 2) * 0.17)) < 1e-9));
advanceUntil(telegraph, () => siegeBoss.attack === 'grenades');
advanceUntil(telegraph, () => telegraph.hazards.length > 0);
const firstCircle = telegraph.hazards[0], firstX = firstCircle.x, warnings = new Map([[firstCircle.id, { ...firstCircle }]]);
const hpBeforeEvade = playerActor(telegraph).hp;
let mortarBursts = 0;
for (let i = 0; i < 180; i++) {
  step(telegraph, { moveX: -1 });
  for (const hazard of telegraph.hazards) if (!warnings.has(hazard.id)) warnings.set(hazard.id, { ...hazard });
  mortarBursts += telegraph.events.filter(e => e.type === 'explosion' && e.kind === 'boss').length;
}
assert.equal(firstCircle.x, firstX);
assert.equal(warnings.size, 3);
assert.equal(mortarBursts, 3);
assert([...warnings.values()].every(h => h.kind === 'grenades' && h.fuse - h.age >= 1.3));
assert([...warnings.values()].some(h => Math.abs(h.x - firstX) > 1), '後續迫擊應重新鎖定移動中的玩家');
assert.equal(playerActor(telegraph).hp, hpBeforeEvade, '離開固定圈後應能完全躲過迫擊');
advanceUntil(telegraph, () => siegeBoss.attack === 'barrage');
assert.equal(telegraph.hazards.length, 5);
assert(telegraph.hazards.every(h => h.kind === 'barrage' && h.fuse - h.age >= 1.6));
const hpBeforeBarrage = playerActor(telegraph).hp;
run(telegraph, 1.5, { moveX: 1 });
assert.equal(playerActor(telegraph).hp, hpBeforeBarrage);
assert.equal(telegraph.hazards.length, 5);
run(telegraph, 0.3, { moveX: 1 });
assert.equal(playerActor(telegraph).hp, hpBeforeBarrage);
assert.equal(telegraph.hazards.length, 0);

const [bossMagazine, ammoBoss] = bossBattle();
ammoBoss.hp = ammoBoss.maxHp / 2;
step(bossMagazine);
assert.equal(ammoBoss.enraged, true);
assert(bossMagazine.events.some(e => e.type === 'boss-rage'));
let bossShots = 0, emptyAmmoHazards = 0;
for (let i = 0; i < 3600; i++) {
  step(bossMagazine);
  assert(!bossMagazine.events.some(e => e.type === 'boss-rage'), '狂暴事件只能觸發一次');
  bossShots += bossMagazine.events.filter(e => e.type === 'shot' && e.kind === 'shell').length;
  if (!ammoBoss.ammo) emptyAmmoHazards += bossMagazine.events.filter(e => e.type === 'boss-charge' && e.kind !== 'fan').length;
  if (ammoBoss.attack === null) assert(ammoBoss.attackTimer <= 1.25 + 1e-9);
}
assert.equal(bossShots, 15);
assert.equal(ammoBoss.ammo, 0);
assert(emptyAmmoHazards > 0);
assert.equal(ammoBoss.crew, 6);
assert.equal(ammoBoss.occupied, true);

const [footprint, largeBoss] = bossBattle();
footprint.grace = 1000;
const approaching = playerActor(footprint);
approaching.x = largeBoss.x + 3; approaching.z = largeBoss.z;
run(footprint, 0.5, { moveX: -1 });
assert(Math.hypot(approaching.x - largeBoss.x, approaching.z - largeBoss.z) >= 2.13);
const fullBossHp = largeBoss.hp;
footprint.bullets.push({ id: 999, x: largeBoss.x + 1.1, z: largeBoss.z - 0.9, dx: 0, dz: 1, kind: 'shell', team: 'player', life: 1 });
step(footprint);
assert.equal(largeBoss.hp, fullBossHp - 32, '擦過大車體邊緣的炮彈應命中');
footprint.grenades.push({ id: 1000, x: largeBoss.x + 3.5, z: largeBoss.z, startX: largeBoss.x + 3.5, startZ: largeBoss.z,
  targetX: largeBoss.x + 3.5, targetZ: largeBoss.z, age: 0.89, fuse: 0.9, team: 'player' });
step(footprint);
assert.equal(largeBoss.hp, fullBossHp - 97, '爆炸也應使用 Boss 的大車體半徑');
footprint.hazards.push({ id: 1001, bossId: largeBoss.id, x: largeBoss.x, z: largeBoss.z, radius: 2.1, age: 1.69, fuse: 1.7, kind: 'barrage' });
step(footprint);
assert.equal(largeBoss.hp, fullBossHp - 97, 'Boss 不可被自己的迫擊傷害');
const oldBaseHp = footprint.base.hp;
footprint.hazards.push({ id: 1002, bossId: largeBoss.id, x: footprint.base.x, z: footprint.base.z, radius: 2.1, age: 1.69, fuse: 1.7, kind: 'barrage' });
step(footprint);
assert.equal(footprint.base.hp, oldBaseHp - 24);

const [bossDeath, lastBoss] = bossBattle();
lastBoss.hp = 1;
bossDeath.hazards.push({ id: 999, bossId: lastBoss.id, x: 0, z: 8.5, radius: 2.1, age: 1.69, fuse: 1.7, kind: 'barrage' });
bossDeath.bullets.push({ id: 1000, x: lastBoss.x + 1.1, z: lastBoss.z - 0.9, dx: 0, dz: 1, kind: 'shell', team: 'player', life: 1 });
const bossScore = bossDeath.score, survivorHp = playerActor(bossDeath).hp;
step(bossDeath);
assert.equal(lastBoss.dead, true);
assert.equal(bossDeath.hazards.length, 0);
assert.equal(playerActor(bossDeath).hp, survivorHp);
assert.equal(bossDeath.enemies.length, 6);
assert.equal(bossDeath.score, bossScore + 1000);
assert.equal(bossDeath.events.at(-1).type, 'boss-defeated');
assert(bossDeath.events.some(e => e.type === 'explosion' && e.boss && e.size === 3));

const [bossBypass, survivingBoss] = bossBattle();
bossBypass.enemyBases.forEach(base => { base.hp = 0; base.dead = true; });
step(bossBypass);
assert.equal(bossBypass.phase, 'won');
assert.equal(survivingBoss.dead, false);
const stoppedTimer = survivingBoss.attackTimer;
step(bossBypass, {}, 0.1);
assert.equal(survivingBoss.attackTimer, stoppedTimer);
const supportArena = () => {
  const state = quiet(start()), actor = playerActor(state), enemy = state.tanks.find(t => t.team === 'enemy');
  state.walls = []; state.tanks = [actor, enemy]; actor.x = 0; actor.z = 0; enemy.x = -12; enemy.z = -12;
  return state;
};
const closeTo = (actual, expected, tolerance = 1e-7) => assert(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

// 氮氣各車獨立，部分油量能用，耗盡後長按不能反覆點火。
const nitro = supportArena(), nitroTank = playerActor(nitro);
nitroTank.x = -10;
run(nitro, 0.5, { moveX: 1, boost: true });
closeTo(nitroTank.x + 10, 4.7 * 1.8 * 0.5);
closeTo(nitroTank.nitro, 77.5);
assert.equal(nitroTank.boosting, true);
run(nitro, 0.5, { moveX: 1 });
closeTo(nitroTank.nitro, 87.5);
assert.equal(nitroTank.boosting, false);
nitroTank.nitro = 4.5;
step(nitro, { moveX: 1, boost: true }, 0.1);
closeTo(nitroTank.nitro, 0);
assert.equal(nitroTank.nitroLocked, true);
let restarts = 0;
for (let i = 0; i < 60; i++) { step(nitro, { moveX: 1, boost: true }); restarts += nitro.events.filter(e => e.type === 'boost').length; }
assert.equal(restarts, 0);
assert.equal(nitroTank.boosting, false);
closeTo(nitroTank.nitro, 20);
step(nitro, {}, 0.1);
step(nitro, { moveX: 1, boost: true }, 0.1);
assert.equal(nitroTank.boosting, true);
closeTo(nitroTank.nitro, 17.5);
const reserveTank = nitro.tanks.find(t => t !== nitroTank);
reserveTank.nitro = 10;
run(nitro, 0.5);
closeTo(reserveTank.nitro, 20);
const storedNitro = nitroTank.nitro;
interact(nitro); interact(nitro);
closeTo(nitroTank.nitro, storedNitro);

// 先按 Shift 再走也會衝刺；時間到或提早放開都會疲勞，速度精確為七成。
const sprint = supportArena();
interact(sprint); Object.assign(sprint.player, { x: -10, z: -4 });
step(sprint, { boost: true });
assert.equal(sprint.player.sprintTime, 0);
run(sprint, 0.5, { moveX: 1, boost: true });
closeTo(sprint.player.x + 10, 5.5 * 1.8 * 0.5);
closeTo(sprint.player.sprintTime, 0.7);
run(sprint, 0.7, { moveX: 1, boost: true });
closeTo(sprint.player.sprintTime, 0);
closeTo(sprint.player.fatigueTime, 2.4);
const tiredX = sprint.player.x;
run(sprint, 0.5, { moveX: 1, boost: true });
closeTo(sprint.player.x - tiredX, 5.5 * 0.7 * 0.5);
run(sprint, 2.1, { boost: true });
step(sprint, { moveX: -1, boost: true });
assert.equal(sprint.player.sprintTime, 0, '長按穿過疲勞結束不可自動再衝刺');
step(sprint);
step(sprint, { moveX: -1, boost: true });
assert(sprint.player.sprintTime > 1.1);
step(sprint, { moveX: -1 });
assert.equal(sprint.player.sprintTime, 0);
assert(sprint.player.fatigueTime > 2.3);
const footTank = sprint.tanks[0];
sprint.player.x = footTank.x + 1.45; sprint.player.z = footTank.z;
const fatigueBeforeBoard = sprint.player.fatigueTime;
assert(interact(sprint)); assert(interact(sprint));
closeTo(sprint.player.fatigueTime, fatigueBeforeBoard);
step(sprint, { boost: true }); run(sprint, 2.5, { boost: true });
step(sprint, { moveX: 1, boost: true });
assert.equal(sprint.player.sprintTime, 0, '疲勞中提前重新按住也不可排隊連跑');

// 單一輸入即使 dt 拆六步也只部署一架；上限計算存活機體且不浪費庫存。
const deployment = supportArena();
deployment.tanks[1].team = 'neutral'; // 部署間距使用無戰鬥場景，避免追擊位移混進出生點檢查。
step(deployment, { deployDrone: true }, 0.1);
assert.equal(deployment.drones.length, 1);
assert.equal(deployment.player.droneKits, 1);
assert(deployment.events.some(e => e.type === 'deploy' && e.kind === 'drone'));
step(deployment, { deployDrone: true }, 0.1);
deployment.player.droneKits = 1;
step(deployment, { deployDrone: true }, 0.1);
assert.equal(deployment.drones.length, 2);
assert.equal(deployment.player.droneKits, 1);
assert(deployment.events.some(e => e.type === 'message'));
assert(Math.hypot(deployment.drones[0].x - deployment.drones[1].x, deployment.drones[0].z - deployment.drones[1].z) > 3);
const damagedDrone = deployment.drones[0];
for (const kind of ['shell', 'bullet']) {
  deployment.bullets.push({ id: ++deployment.serial, x: damagedDrone.x, z: damagedDrone.z, dx: 0, dz: 0, kind, team: 'player', ownerId: 'player', life: 1 });
  step(deployment);
}
assert(damagedDrone.dead);
assert(deployment.events.some(e => e.type === 'explosion' && e.kind === 'drone' && e.targetId === damagedDrone.id));
step(deployment, { deployDrone: true }, 0.1);
assert.equal(deployment.drones.filter(d => !d.dead).length, 2);
assert.equal(deployment.player.droneKits, 0);

// 自動機槍保留牆面視線及彈道碰撞；自身發射的子彈不會誤傷自己。
const droneFire = supportArena();
const droneFoe = droneFire.tanks.find(t => t.team === 'enemy'); droneFoe.x = 0; droneFoe.z = -5;
step(droneFire, { deployDrone: true }, 0.1);
run(droneFire, 0.12);
const droneRound = droneFire.bullets.find(b => b.kind === 'drone');
assert(droneRound && droneRound.ownerId === droneFire.drones[0].id);
run(droneFire, 0.22);
assert.equal(droneFoe.hp, 77);
assert.equal(droneFire.drones[0].hp, 45);
const infantrySupport = supportArena();
infantrySupport.enemies.push({ id: 999, x: 2, z: -2, hp: 38, maxHp: 38, invulnerable: 0, dead: false });
step(infantrySupport, { deployDrone: true }, 0.1); run(infantrySupport, 0.25);
assert.equal(infantrySupport.enemies[0].hp, 32);
const blockedDrone = supportArena(), coveredFoe = blockedDrone.tanks.find(t => t.team === 'enemy');
coveredFoe.x = 0; coveredFoe.z = -5;
blockedDrone.walls = [{ x: 0, z: -2, w: 6, d: 0.6, kind: 'steel', dead: false }];
step(blockedDrone, { deployDrone: true }, 0.1); run(blockedDrone, 0.12);
assert.equal(coveredFoe.hp, 80);
assert.equal(blockedDrone.bullets.length, 0);
blockedDrone.walls = []; blockedDrone.drones[0].cooldown = 0; step(blockedDrone);
assert(blockedDrone.bullets.some(b => b.kind === 'drone'));
blockedDrone.walls = [{ x: 0, z: -2, w: 6, d: 0.6, kind: 'steel', dead: false }];
blockedDrone.drones[0].cooldown = 1; // 只驗已射子彈碰牆，跨牆後的新射擊另行測試。
run(blockedDrone, 0.3);
assert.equal(coveredFoe.hp, 80);
assert.equal(blockedDrone.bullets.length, 0);

// 友軍、敵軍及另一架無人機都能命中，只有 ownerId 對應的自身子彈排除。
const droneHits = supportArena(); step(droneHits, { deployDrone: true }, 0.1);
const targetDrone = droneHits.drones[0];
for (const [team, kind, ownerId, damage] of [
  ['player', 'drone', targetDrone.id, 0], ['player', 'shell', 'player', 32],
  ['player', 'bullet', 'player', 13], ['player', 'drone', 999, 6], ['enemy', 'shell', 999, 22], ['enemy', 'bullet', 999, 7],
]) {
  targetDrone.hp = 45; targetDrone.dead = false; droneHits.bullets = [];
  droneHits.bullets.push({ id: ++droneHits.serial, x: targetDrone.x, z: targetDrone.z, dx: 0, dz: 0, kind, team, ownerId, life: 1 });
  step(droneHits);
  assert.equal(targetDrone.hp, 45 - damage);
  const hit = droneHits.events.find(e => e.type === 'hit' && e.kind === 'drone');
  assert.equal(Boolean(hit), damage > 0);
  if (hit) { assert.equal(hit.targetTeam, 'player'); assert.equal(hit.targetId, targetDrone.id); assert.equal(hit.sourceTeam, team); }
}
droneHits.bullets = []; targetDrone.hp = 45;
droneHits.grenades.push({ id: 999, x: targetDrone.x, z: targetDrone.z, startX: targetDrone.x, startZ: targetDrone.z,
  targetX: targetDrone.x, targetZ: targetDrone.z, age: 0.89, fuse: 0.9, team: 'player' });
step(droneHits); assert(targetDrone.dead);

// 閃避有速度／冷卻上限，友軍來彈也會躲；近距離仍然能擊中。
const dodging = supportArena(); step(dodging, { deployDrone: true }, 0.1);
const dodger = dodging.drones[0], beforeDodgeX = dodger.x;
dodging.bullets.push({ id: 999, x: dodger.x, z: dodger.z - 3.5, dx: 0, dz: 1, kind: 'bullet', team: 'player', ownerId: 'player', life: 1 });
step(dodging);
assert(dodger.dodgeTime > 0);
assert(dodger.x > beforeDodgeX && dodger.x - beforeDodgeX <= 5 / 60 + 1e-8);
run(dodging, 0.15);
assert.equal(dodger.hp, 45);
dodging.bullets = [{ id: 1000, x: dodger.x, z: dodger.z - 0.05, dx: 0, dz: 1, kind: 'bullet', team: 'player', ownerId: 'player', life: 1 }];
step(dodging);
assert.equal(dodger.hp, 32);
const flying = supportArena(); flying.tanks[1].team = 'neutral'; step(flying, { deployDrone: true }, 0.1);
flying.walls = [{ x: 3, z: 0.5, w: 1, d: 1, kind: 'steel', dead: false }];
playerActor(flying).x = 6; run(flying, 0.6);
assert(flying.drones[0].x > 3.5, '無人機跟隨不能被牆擋住');

// 可見無人機的選取約三成，目標保持兩秒；遮蔽或死亡立即失效。
const targeting = supportArena(); step(targeting, { deployDrone: true }, 0.1); targeting.grace = 0;
const chooser = targeting.tanks.find(t => t.team === 'enemy');
Object.assign(chooser, { x: 0, z: -5, hp: 10000, maxHp: 10000, cooldown: 1e9 });
let droneChoices = 0;
for (let i = 0; i < 1200; i++) { chooser.targetTime = 0; step(targeting); if (chooser.targetId === targeting.drones[0].id) droneChoices++; }
assert(droneChoices / 1200 > 0.25 && droneChoices / 1200 < 0.35);
const heldTarget = chooser.targetId; run(targeting, 0.5); assert.equal(chooser.targetId, heldTarget);
chooser.targetId = targeting.drones[0].id; chooser.targetTime = 2;
targeting.walls = [{ x: (chooser.x + targeting.drones[0].x) / 2, z: (chooser.z + targeting.drones[0].z) / 2,
  w: 0.8, d: 0.8, kind: 'steel', dead: false }];
step(targeting); assert.equal(chooser.targetId, 'player');
targeting.walls = []; targeting.drones[0].dead = true; chooser.targetId = targeting.drones[0].id; chooser.targetTime = 2;
step(targeting); assert.equal(chooser.targetId, 'player');
chooser.objective = 'base'; chooser.x = -12; chooser.z = -10; step(targeting); assert.equal(chooser.targetId, 'base');
const [droneBoss, targetingBoss] = bossBattle(); step(droneBoss, { deployDrone: true }, 0.1);
Object.assign(targetingBoss, { targetId: droneBoss.drones[0].id, targetTime: 2, attack: 'fan', attackAngle: 0.4, attackTimer: 1 });
step(droneBoss); assert.equal(targetingBoss.targetId, droneBoss.drones[0].id); assert.equal(targetingBoss.attackAngle, 0.4);
const bossDrone = droneBoss.drones[0];
droneBoss.hazards.push({ id: 999, bossId: targetingBoss.id, x: bossDrone.x, z: bossDrone.z, radius: 2.1, age: 1.69, fuse: 1.7, kind: 'barrage' });
step(droneBoss); assert.equal(bossDrone.hp, 13);

// 掉落隨機但可重現，無人機套件不回血；修理與關卡重設保持原行為。
let droneDrops = 0;
for (let seed = 1; seed <= 400; seed++) {
  const drop = Object.assign(createGame({ seed }), { phase: 'playing', grace: 1000, kills: 2 });
  drop.walls = []; drop.enemies = [{ id: 999, x: 0, z: 0, hp: 1, invulnerable: 0, dead: false }];
  drop.bullets.push({ id: 1000, x: 0, z: -0.1, dx: 0, dz: 1, kind: 'drone', team: 'player', ownerId: 'player', life: 1 });
  step(drop);
  if (drop.pickups[0].kind === 'drone') droneDrops++;
}
assert(droneDrops / 400 > 0.2 && droneDrops / 400 < 0.3);
const kits = supportArena(); kits.player.hp = 50; kits.player.droneKits = 100; playerActor(kits).hp = 70;
kits.pickups.push({ id: 999, x: 0, z: 0, kind: 'drone', dead: false }); step(kits);
assert.equal(kits.player.droneKits, 101); assert.equal(kits.player.hp, 50); assert.equal(playerActor(kits).hp, 70);
assert(kits.events.some(e => e.type === 'pickup' && e.kind === 'drone'));
kits.pickups.push({ id: 1000, x: 0, z: 0, kind: 'repair', dead: false }); step(kits);
assert.equal(kits.player.hp, 75); assert.equal(playerActor(kits).hp, 115);
step(kits, { deployDrone: true });
aliveEnemies(kits).forEach(e => { e.dead = true; }); kits.wave = 3; step(kits);
assert.equal(kits.phase, 'won', '友軍無人機不算過關所需消滅的敵人');
for (const phase of ['paused', 'won', 'lost']) {
  kits.phase = phase;
  const frozen = JSON.stringify([kits.time, kits.player, kits.tanks, kits.drones]);
  step(kits, { boost: true, moveX: 1, deployDrone: true }, 0.1);
  assert.equal(JSON.stringify([kits.time, kits.player, kits.tanks, kits.drones]), frozen);
}
const freshSupport = createGame({ level: 2 });
assert.equal(freshSupport.player.droneKits, 2); assert.equal(freshSupport.drones.length, 0);
assert.equal(freshSupport.player.sprintTime, 0); assert.equal(freshSupport.player.fatigueTime, 0);
assert(freshSupport.tanks.every(t => t.nitro === 100 && t.maxNitro === 100 && !t.boosting));
const rifleFoot = () => {
  const state = supportArena(); interact(state);
  Object.assign(state.player, { x: -12, z: -4, invulnerable: 0 });
  return state;
};

// 共用 fire 輸入涵蓋滑鼠、空白鍵及觸控：二十五發後換彈，持續按住不可自動續射。
const rifle = rifleFoot(); let rifleShots = 0, reloadStarts = 0, reloadFinishes = 0;
for (let i = 0; i < 360; i++) {
  step(rifle, { fire: true, aimX: 14, aimZ: -4 });
  rifleShots += rifle.events.filter(e => e.type === 'shot' && e.kind === 'bullet').length;
  reloadStarts += rifle.events.filter(e => e.type === 'reload').length;
  reloadFinishes += rifle.events.filter(e => e.type === 'reload-ready').length;
}
assert.equal(rifleShots, 25); assert.equal(reloadStarts, 1); assert.equal(reloadFinishes, 1);
assert.equal(rifle.player.rifleAmmo, 25); assert.equal(rifle.player.fireLocked, true);
step(rifle); step(rifle, { fire: true, aimX: 14, aimZ: -4 });
assert.equal(rifle.player.rifleAmmo, 24);
step(rifle, { reload: true, fire: true }, 0.1);
closeTo(rifle.player.reloadTime, 1.4);
run(rifle, 1.3, { fire: true }); assert.equal(rifle.player.rifleAmmo, 24);
run(rifle, 0.3, { fire: true }); assert.equal(rifle.player.rifleAmmo, 25); assert(rifle.player.fireLocked);
step(rifle); step(rifle, { fire: true, aimX: 14, aimZ: -4 }); assert.equal(rifle.player.rifleAmmo, 24);
step(rifle, { reload: true }, 0.1);
rifle.player.x = rifle.tanks[0].x + 1.45; rifle.player.z = rifle.tanks[0].z;
assert(interact(rifle)); run(rifle, 0.4); assert(interact(rifle));
closeTo(rifle.player.reloadTime, 1); assert.equal(rifle.player.rifleAmmo, 24);
run(rifle, 1.1); assert.equal(rifle.player.rifleAmmo, 25);
assert(interact(rifle)); const cannonAmmo = playerActor(rifle).ammo;
step(rifle, { reload: true }); assert.equal(playerActor(rifle).ammo, cannonAmmo); assert.equal(rifle.player.reloadTime, 0);

// 射程按真實路徑累積；後三成五只偏轉同一顆子彈，不分裂、不穿薄牆。
const rangeTest = rifleFoot();
step(rangeTest, { fire: true, aimX: 14, aimZ: -4 });
const rangedBullet = rangeTest.bullets[0];
assert.equal(rangedBullet.range, 15); assert.equal(rangeTest.bullets.length, 1);
run(rangeTest, 0.28); assert.equal(rangedBullet.tailSpread, false);
step(rangeTest); assert.equal(rangedBullet.tailSpread, true);
run(rangeTest, 0.3);
closeTo(rangedBullet.traveled, 15); assert.equal(rangedBullet.life, 0);
assert(Math.hypot(rangedBullet.x + 12, rangedBullet.z + 4) <= 15 + 1e-8);
const spread = rifleFoot(), angles = [];
for (let i = 0; i < 160; i++) {
  step(spread, { fire: true, aimX: 14, aimZ: -4 });
  if (spread.events.some(e => e.type === 'shot')) angles.push(spread.bullets.at(-1).tailAngle);
}
assert.equal(angles.length, 25);
assert(angles.some(a => a < -0.02) && angles.some(a => a > 0.02));
assert(angles.every(a => Math.abs(a) <= 0.08));
const thinWall = rifleFoot();
thinWall.walls = [{ x: -1, z: -4, w: 0.03, d: 2, kind: 'steel', dead: false }];
step(thinWall, { fire: true, aimX: 14, aimZ: -4 }); const stoppedRifle = thinWall.bullets[0]; run(thinWall, 0.5);
assert(stoppedRifle.traveled < 15 && stoppedRifle.x < -0.9);
assert.equal(droneRound.range, undefined);
const unaffectedShell = supportArena(); playerActor(unaffectedShell).cooldown = 0;
step(unaffectedShell, { fire: true, aimX: 14, aimZ: 0 });
assert.equal(unaffectedShell.bullets[0].range, undefined);

const enemyRifle = Object.assign(createGame({ level: 2 }), { phase: 'playing', grace: 0 });
const rifleman = enemyRifle.enemies[0]; enemyRifle.tanks = [playerActor(enemyRifle)]; enemyRifle.enemies = [rifleman]; enemyRifle.walls = [];
playerActor(enemyRifle).hp = 10000; rifleman.x = 3; rifleman.z = 8.5; rifleman.cooldown = 0;
let enemyRifleShots = 0, lastMagazineShot = 0, nextMagazineShot = 0;
for (let i = 0; i < 1100 && !nextMagazineShot; i++) {
  step(enemyRifle);
  if (enemyRifle.events.some(e => e.type === 'shot' && e.kind === 'bullet' && e.team === 'enemy')) {
    enemyRifleShots++;
    if (enemyRifleShots === 25) lastMagazineShot = enemyRifle.time;
    if (enemyRifleShots === 26) nextMagazineShot = enemyRifle.time;
  }
}
assert.equal(enemyRifleShots, 26); assert(nextMagazineShot - lastMagazineShot >= 1.5 - 1e-8);

// 實際非致命身體命中約四分之一出血，裝甲不流血，既有傷口不堆疊或重設計時。
let bleedCases = 0, wounded;
for (let seed = 1; seed <= 240; seed++) {
  const state = Object.assign(createGame({ seed: Math.imul(seed, 2654435761) >>> 0 }), { phase: 'playing', grace: 1000 }); state.walls = []; interact(state);
  Object.assign(state.player, { x: 0, z: 0, invulnerable: 0 });
  state.bullets.push({ id: 999, x: 0, z: -0.1, dx: 0, dz: 1, kind: 'bullet', team: 'enemy', life: 1 });
  step(state);
  assert.equal(state.player.hp, 93);
  if (state.player.bleeding) { bleedCases++; wounded ||= state; }
}
assert(bleedCases / 240 > 0.2 && bleedCases / 240 < 0.3);
wounded.player.bleedTimer = 0.4;
wounded.bullets.push({ id: 1000, x: 0, z: -0.1, dx: 0, dz: 1, kind: 'bullet', team: 'enemy', life: 1 });
step(wounded); assert(wounded.player.bleedTimer > 0.4); assert(!wounded.events.some(e => e.type === 'bleed-start'));
const dryArmor = supportArena();
dryArmor.bullets.push({ id: 999, x: 0, z: -0.1, dx: 0, dz: 1, kind: 'shell', team: 'enemy', life: 1 });
step(dryArmor); assert.equal(dryArmor.player.bleeding, false); assert.equal(playerActor(dryArmor).bleeding, undefined);
const slowBleed = rifleFoot();
Object.assign(slowBleed.player, { bleeding: true, bleedTimer: 0, bleedSource: 'enemy', fatigueTime: 1 });
run(slowBleed, 0.5, { moveX: 1 }); closeTo(slowBleed.player.x + 12, 5.5 * 0.75 * 0.7 * 0.5);
slowBleed.player.x = slowBleed.tanks[0].x + 1.45; slowBleed.player.z = slowBleed.tanks[0].z; assert(interact(slowBleed));
const mountedX = playerActor(slowBleed).x; run(slowBleed, 0.6, { moveX: 1 });
closeTo(playerActor(slowBleed).x - mountedX, 4.7 * 0.6); assert.equal(slowBleed.player.hp, 96);
slowBleed.pickups.push({ id: 999, x: playerActor(slowBleed).x, z: playerActor(slowBleed).z, kind: 'repair', dead: false }); step(slowBleed);
assert(slowBleed.player.bleeding, '修理包不會代替包紮止血');

const fatalBleed = rifleFoot();
Object.assign(fatalBleed.player, { hp: 3, bleeding: true, bleedTimer: 0.99, bleedSource: 'enemy' });
fatalBleed.pickups.push({ id: 999, x: fatalBleed.player.x, z: fatalBleed.player.z, kind: 'repair', dead: false });
fatalBleed.enemyBases.forEach(base => { base.dead = true; }); step(fatalBleed);
assert.equal(fatalBleed.phase, 'lost'); assert.equal(fatalBleed.player.hp, 0);
assert.equal(fatalBleed.events.filter(e => e.type === 'death').length, 1);
assert(fatalBleed.events.some(e => e.type === 'hit' && e.cause === 'bleeding' && e.damage === 3));
assert.equal(fatalBleed.pickups[0].dead, false); step(fatalBleed); assert.equal(fatalBleed.events.length, 0);
const enemyBleed = supportArena(); enemyBleed.kills = 2;
enemyBleed.enemies.push({ id: 999, x: 4, z: 0, hp: 3, maxHp: 38, dead: false, bleeding: true, bleedTimer: 0.99, bleedSource: 'player', bandageTime: 0 });
step(enemyBleed); assert(enemyBleed.enemies[0].dead); assert.equal(enemyBleed.kills, 3); assert.equal(enemyBleed.score, 120); assert.equal(enemyBleed.pickups.length, 1);
step(enemyBleed); assert.equal(enemyBleed.kills, 3); assert.equal(enemyBleed.score, 120);

// 包紮一點五秒：期間持續失血、禁止直接攻擊／部署，無人機仍自主作戰。
const medical = supportArena(); const medicalFoe = medical.tanks.find(t => t.team === 'enemy'); medicalFoe.x = 0; medicalFoe.z = -5;
step(medical, { deployDrone: true }, 0.1); interact(medical);
Object.assign(medical.player, { x: 0, z: 0, hp: 60, invulnerable: 0, bleeding: true, bleedTimer: 0, bleedSource: 'enemy', rifleAmmo: 10 });
medical.tanks[0].x = 8; medical.tanks[0].z = 8;
const castInput = { bandage: true, fire: true, throwGrenade: true, deployDrone: true, aimX: 0, aimZ: -5 };
step(medical, { ...castInput, reload: true }, 0.1); closeTo(medical.player.bandageTime, 1.4);
run(medical, 0.4, castInput);
assert.equal(medical.player.rifleAmmo, 10); assert.equal(medical.player.reloadTime, 0);
assert.equal(medical.player.grenades, 3); assert.equal(medical.player.droneKits, 1); assert.equal(medical.drones.length, 1);
assert(medicalFoe.hp < 80, '包紮不應停掉既有無人機的自主射擊');
medical.player.x = 9.45; medical.player.z = 8; assert(interact(medical));
const castingCannonAmmo = playerActor(medical).ammo;
run(medical, 0.2, castInput); assert.equal(playerActor(medical).ammo, castingCannonAmmo); assert(interact(medical));
run(medical, 0.6, castInput); assert(medical.player.bleeding); closeTo(medical.player.bandageTime, 0.2);
run(medical, 0.25, { bandage: true });
assert.equal(medical.player.bleeding, false); assert.equal(medical.player.bandageTime, 0); assert.equal(medical.player.hp, 56);

const aiMedical = Object.assign(createGame({ level: 2 }), { phase: 'playing', grace: 0 });
const medic = aiMedical.enemies[0]; aiMedical.tanks = [playerActor(aiMedical)]; aiMedical.enemies = [medic]; aiMedical.walls = [];
Object.assign(medic, { x: 3, z: 8.5, hp: 20, bleeding: true, bleedTimer: 0, bleedAge: 2.5, bleedSource: 'player', grenadeCooldown: 0, cooldown: 0 });
step(aiMedical); assert.equal(medic.bandageTime, 1.5); assert(aiMedical.events.some(e => e.type === 'bandage-start' && e.team === 'enemy'));
const medicGrenades = medic.grenades; run(aiMedical, 1.4);
assert(medic.bleeding && medic.bandageTime > 0); assert.equal(medic.rifleAmmo, 25); assert.equal(medic.grenades, medicGrenades);
run(aiMedical, 0.15); assert.equal(medic.bleeding, false); assert.equal(medic.hp, 16);
Object.assign(medic, { hp: 3, bleeding: true, bleedTimer: 0.8, bleedAge: 0, bandageTime: 0 }); run(aiMedical, 0.3); assert(medic.dead);
const frozenMedical = rifleFoot(); Object.assign(frozenMedical.player, { bleeding: true, bandageTime: 1, reloadTime: 1, rifleAmmo: 7 });
frozenMedical.phase = 'paused'; const oldMedical = JSON.stringify(frozenMedical.player); step(frozenMedical, { fire: true, reload: true, bandage: true }, 0.1);
assert.equal(JSON.stringify(frozenMedical.player), oldMedical);
const freshRifle = createGame({ level: 2 });
for (const body of [freshRifle.player, ...freshRifle.enemies]) {
  assert.equal(body.rifleAmmo, 25); assert.equal(body.rifleMaxAmmo, 25); assert.equal(body.reloadTime, 0);
  assert.equal(body.bleeding, false); assert.equal(body.bandageTime, 0);
}
const missileArena = () => {
  const state = supportArena(), enemy = state.tanks.find(t => t.team === 'enemy');
  Object.assign(enemy, { x: 0, z: -9 });
  return state;
};
// 飛彈與主砲各自計算彈藥／冷卻，單次 request 不會因拆子步而重複發射。
const missiles = missileArena(), missileTank = playerActor(missiles);
assert.equal(missileTank.missiles, 8); assert.equal(missileTank.maxMissiles, 8);
const missileFleet = createGame({ level: 2 }); assert(missileFleet.tanks.some(t => t.kind === 'apc'));
for (const tank of missileFleet.tanks) assert.equal(tank.missiles, tank.kind === 'apc' ? 0 : 8);
missileTank.cooldown = 0;
step(missiles, { fire: true, fireMissile: true, aimX: 0, aimZ: -9 }, 0.1);
assert.equal(missileTank.missiles, 7); assert.equal(missileTank.ammo, 14); assert.equal(missiles.player.rifleAmmo, 25);
assert.equal(missiles.events.filter(e => e.type === 'shot' && e.kind === 'missile').length, 1);
assert.equal(missiles.events.find(e => e.kind === 'missile' && e.type === 'shot').ammoRemaining, 7);
const homing = missiles.bullets.find(b => b.kind === 'missile');
assert.equal(homing.ownerId, missileTank.id); assert.equal(homing.speed, 13); assert.equal(homing.targetKind, 'tank');
closeTo(homing.z, -1.3); closeTo(homing.life, 2.9);
step(missiles, { fireMissile: true }, 0.1); assert.equal(missileTank.missiles, 7);
const pursued = missiles.tanks.find(t => t.id === homing.targetId); pursued.x = 3;
const oldHeading = Math.atan2(homing.dx, homing.dz);
step(missiles, {}, 0.1);
const headingChange = Math.atan2(Math.sin(Math.atan2(homing.dx, homing.dz) - oldHeading), Math.cos(Math.atan2(homing.dx, homing.dz) - oldHeading));
assert(homing.x > 0 && Math.abs(headingChange) > 0 && Math.abs(headingChange) <= 0.26 + 1e-8);
pursued.dead = true; const straight = { dx: homing.dx, dz: homing.dz };
missiles.enemies.push({ id: 9000, x: -3, z: -8, hp: 38, dead: false, invulnerable: 0 });
step(missiles, {}, 0.1);
assert.equal(homing.targetId, null); assert.equal(homing.targetKind, null);
closeTo(homing.dx, straight.dx); closeTo(homing.dz, straight.dz);
run(missiles, 0.5); step(missiles, { fireMissile: true }); assert.equal(missileTank.missiles, 6);
assert(interact(missiles)); const savedMissiles = missileTank.missiles;
step(missiles, { fireMissile: true, reload: true }, 0.1); assert.equal(missileTank.missiles, savedMissiles);
assert(interact(missiles)); step(missiles, { reload: true }); assert.equal(missileTank.missiles, savedMissiles);
const capturedMissiles = missileArena(), firstLauncher = playerActor(capturedMissiles), secondLauncher = capturedMissiles.tanks[1];
step(capturedMissiles, { fireMissile: true }); assert(interact(capturedMissiles));
Object.assign(secondLauncher, { x: 4, z: 0, occupied: false, crew: 0, team: 'neutral' });
Object.assign(capturedMissiles.player, { x: 5.45, z: 0 }); assert(interact(capturedMissiles));
step(capturedMissiles, { fireMissile: true });
assert.equal(secondLauncher.missiles, 7); assert.equal(firstLauncher.missiles, 7);
assert(firstLauncher.missileCooldown > 0.7 && secondLauncher.missileCooldown > 0.7);
run(missiles, 0.9); missiles.player.bleeding = true;
step(missiles, { bandage: true, fireMissile: true }, 0.1); assert.equal(missileTank.missiles, savedMissiles);
missiles.player.bandageTime = 0; missiles.player.bleeding = false; missileTank.missiles = 0;
step(missiles, { fireMissile: true }, 0.1);
assert.equal(missiles.events.filter(e => e.type === 'empty' && e.kind === 'missile').length, 1);

// 瞄準點優先，無瞄準點選最近者；只選視線內、前方且二十四單位內的目標。
const aimedMissile = missileArena(); aimedMissile.tanks[1].x = 6;
aimedMissile.enemies.push({ id: 9001, x: -3, z: -5, hp: 38, dead: false, invulnerable: 0 });
step(aimedMissile, { fireMissile: true, aimX: 0, aimZ: -13.3 });
assert.equal(aimedMissile.bullets[0].targetKind, 'base');
aimedMissile.bullets = []; playerActor(aimedMissile).missileCooldown = 0;
step(aimedMissile, { fireMissile: true }); assert.equal(aimedMissile.bullets[0].targetId, 9001);
const noLock = missileArena(); Object.assign(playerActor(noLock), { x: -12, z: 10 });
Object.assign(noLock.tanks[1], { x: -12, z: 13 }); noLock.enemyBases[0].x = 12;
step(noLock, { fireMissile: true }, 0.1);
assert.equal(noLock.bullets[0].targetId, null); closeTo(noLock.bullets[0].x, -12); closeTo(noLock.bullets[0].z, 8.7);
const ownerEscape = missileArena();
step(ownerEscape, { fireMissile: true }, 0.001); assert(interact(ownerEscape)); run(ownerEscape, 0.1);
assert.equal(ownerEscape.tanks[0].hp, 140); assert(ownerEscape.bullets.some(b => b.kind === 'missile'));

// 命中沿用實際彈道：貼牆不穿越，爆光只一次且沒有範圍傷害。
for (const kind of ['brick', 'steel']) {
  const wallMissile = missileArena();
  wallMissile.walls = [{ x: 0, z: -1, w: 3, d: 0.1, kind, hp: kind === 'brick' ? 64 : Infinity, dead: false }];
  step(wallMissile, { fireMissile: true }, 0.1);
  assert.equal(wallMissile.events.filter(e => e.type === 'explosion' && e.kind === 'missile').length, 1);
  assert.equal(wallMissile.walls[0].dead, kind === 'brick'); assert.equal(wallMissile.tanks[1].hp, 80);
  run(wallMissile, 0.5); assert(!wallMissile.events.some(e => e.kind === 'missile')); assert.equal(wallMissile.bullets.length, 0);
}
const tankImpact = missileArena(); step(tankImpact, { fireMissile: true }); run(tankImpact, 0.7);
assert.equal(tankImpact.tanks[1].hp, 30);
const infantryImpact = missileArena();
infantryImpact.enemies.push({ id: 9002, x: 0, z: -3, hp: 38, invulnerable: 0, dead: false });
step(infantryImpact, { fireMissile: true, aimX: 0, aimZ: -3 }); run(infantryImpact, 0.25);
assert(infantryImpact.enemies[0].dead); assert.equal(infantryImpact.tanks[1].hp, 80);
for (const friendly of [false, true]) {
  const baseMissile = missileArena(); baseMissile.tanks[1].x = 6;
  const target = friendly ? baseMissile.base : baseMissile.enemyBases[0], before = target.hp;
  step(baseMissile, { fireMissile: true, aimX: target.x, aimZ: target.z }); run(baseMissile, 1.1);
  assert.equal(target.hp, before - 42);
}
const missileDrone = missileArena(); step(missileDrone, { deployDrone: true }); const friendlyDrone = missileDrone.drones[0];
missileDrone.bullets.push({ id: 9990, kind: 'missile', team: 'player', ownerId: playerActor(missileDrone).id,
  x: friendlyDrone.x, z: friendlyDrone.z, dx: 0, dz: 0, life: 3 });
step(missileDrone); assert.equal(friendlyDrone.hp, 5); assert.equal(missileDrone.player.hp, 100);
assert.equal(missileDrone.events.filter(e => e.type === 'explosion' && e.kind === 'missile').length, 1);
const expires = missileArena();
expires.bullets.push({ id: 9991, x: 4, z: 0, dx: 0, dz: 0, kind: 'missile', team: 'player', life: 0.01 });
step(expires); assert.equal(expires.events.filter(e => e.type === 'explosion' && e.kind === 'missile').length, 1);
step(expires); assert(!expires.events.some(e => e.kind === 'missile'));

// 彈藥箱只供缺彈武裝座車，實際補充量有上限；不補血且不能靠上下車／換彈重設。
const resupply = missileArena(), suppliedTank = playerActor(resupply);
resupply.player.hp = 50; suppliedTank.hp = 70;
const missileBox = { id: 9992, x: 0, z: 0, kind: 'missile', dead: false }; resupply.pickups.push(missileBox);
step(resupply); assert.equal(missileBox.dead, false);
suppliedTank.missiles = 7; step(resupply);
assert.equal(suppliedTank.missiles, 8); assert(resupply.events.some(e => e.type === 'pickup' && e.kind === 'missile' && e.amount === 1));
assert.equal(resupply.player.hp, 50); assert.equal(suppliedTank.hp, 70);
missileBox.dead = false; suppliedTank.missiles = 1; step(resupply); assert.equal(suppliedTank.missiles, 5);
assert(resupply.events.some(e => e.type === 'pickup' && e.amount === 4));
missileBox.dead = false; assert(interact(resupply)); missileBox.x = resupply.player.x; missileBox.z = resupply.player.z;
step(resupply); assert.equal(missileBox.dead, false); assert.equal(suppliedTank.missiles, 5);
assert(interact(resupply)); missileBox.x = suppliedTank.x; missileBox.z = suppliedTank.z;
Object.assign(suppliedTank, { kind: 'apc', maxMissiles: 0, missiles: 0 });
step(resupply, { fireMissile: true }); assert.equal(missileBox.dead, false); assert.equal(suppliedTank.missiles, 0);
const drops = { repair: 0, drone: 0, missile: 0 };
for (let seed = 1; seed <= 800; seed++) {
  const drop = Object.assign(createGame({ seed: Math.imul(seed, 2654435761) >>> 0 }), { phase: 'playing', grace: 1000, kills: 2 });
  drop.walls = []; drop.enemies = [{ id: 999, x: 0, z: 0, hp: 1, invulnerable: 0, dead: false }];
  drop.bullets.push({ id: 1000, x: 0, z: -0.1, dx: 0, dz: 1, kind: 'drone', team: 'player', life: 1 }); step(drop);
  drops[drop.pickups[0].kind]++;
}
assert(drops.repair / 800 > 0.45 && drops.repair / 800 < 0.55);
for (const kind of ['drone', 'missile']) assert(drops[kind] / 800 > 0.2 && drops[kind] / 800 < 0.3);
for (const phase of ['paused', 'won', 'lost']) {
  const frozenMissile = missileArena(); step(frozenMissile, { fireMissile: true }); frozenMissile.phase = phase;
  const state = JSON.stringify([frozenMissile.tanks, frozenMissile.bullets]); step(frozenMissile, { fireMissile: true }, 0.1);
  assert.equal(JSON.stringify([frozenMissile.tanks, frozenMissile.bullets]), state);
}
assert.equal(playerActor(createGame()).missiles, 8);
const crushBody = (state, x, z) => {
  const body = { ...createGame({ level: 2 }).enemies[0], id: ++state.serial, x, z,
    invulnerable: 0, cooldown: 1000, grenadeCooldown: 1000 };
  state.enemies.push(body); return body;
};
const enemyCrushArena = () => {
  const state = supportArena(); assert(interact(state)); state.tanks[0].x = 10; state.tanks[0].z = 10;
  Object.assign(state.player, { x: 0, z: 0, invulnerable: 0 });
  Object.assign(state.tanks[1], { x: 0, z: -1.15, kind: 'apc', ammo: 0, bailCooldown: 100,
    cooldown: 1000, routeTime: 100, route: [{ x: 0, z: 4 }] });
  state.grace = 0; return state;
};
// 碾壓以最大血量計算，連續接觸即使冷卻結束也不重扣；離開再撞才算下一次。
const crushing = supportArena(), crushed = crushBody(crushing, 0, -0.9), crusher = playerActor(crushing);
step(crushing, { moveZ: -1 }); closeTo(crushed.hp, 7.6); assert.equal(crushed.bleeding, false);
const crushEvent = crushing.events.find(e => e.type === 'crush');
assert.deepEqual([crushEvent.targetId, crushEvent.targetTeam, crushEvent.sourceTeam, crushEvent.vehicleId, crushEvent.dead],
  [crushed.id, 'enemy', 'player', crusher.id, false]);
closeTo(crushEvent.damage, 30.4); closeTo(crushed.crushTime, 0.65); closeTo(crushed.crushCooldown, 0.8);
assert(crushing.events.some(e => e.type === 'hit' && e.cause === 'crush'));
for (let i = 0; i < 90; i++) {
  step(crushing, { moveZ: i % 2 ? -0.1 : 0.1 });
  assert(!crushing.events.some(e => e.type === 'crush'));
}
closeTo(crushed.hp, 7.6); assert.equal(crushed.crushTime, 0); assert.equal(crushed.crushCooldown, 0);
run(crushing, 0.6, { moveZ: 1 }); assert(!crusher.crushContacts.includes(crushed.id));
run(crushing, 0.6, { moveZ: -1 });
assert(crushed.dead); assert.equal(crushing.kills, 1); assert.equal(crushing.score, 120);
run(crushing, 0.2, { moveZ: -1 }); assert.equal(crushing.kills, 1); assert.equal(crushing.score, 120);

// 敵方 APC 能壓玩家與己方步兵；多人同時撞由角色冷卻擋住第二次扣血。
const playerCrushed = enemyCrushArena(); step(playerCrushed);
assert.equal(playerCrushed.player.hp, 20);
assert(playerCrushed.events.some(e => e.type === 'crush' && e.targetId === 'player' && e.sourceTeam === 'enemy' && e.damage === 80));
const friendlyCrush = enemyCrushArena(); friendlyCrush.player.x = 8; friendlyCrush.player.z = 8;
const alliedFoot = crushBody(friendlyCrush, 0, 0); alliedFoot.hp = 7;
step(friendlyCrush); assert(alliedFoot.dead); assert.equal(friendlyCrush.kills, 1); assert.equal(friendlyCrush.score, 0);
assert(friendlyCrush.events.some(e => e.type === 'crush' && e.sourceTeam === 'enemy' && e.targetTeam === 'enemy' && e.damage === 7));
const doubleCrush = enemyCrushArena(), leftCrusher = doubleCrush.tanks[1];
Object.assign(leftCrusher, { x: -1.1, z: 0, route: [{ x: 4, z: 0 }] });
doubleCrush.tanks.push({ ...leftCrusher, id: ++doubleCrush.serial, x: 1.1, route: [{ x: -4, z: 0 }], crushContacts: [] });
step(doubleCrush); assert.equal(doubleCrush.player.hp, 20); assert.equal(doubleCrush.events.filter(e => e.type === 'crush').length, 1);
assert(doubleCrush.tanks.slice(1).every(t => t.crushContacts.includes('player')));

// 靜止、卡牆及隔著薄鋼牆都不能壓人；高速的實際路徑仍會掃中擦邊目標。
const idleCrush = supportArena(), idleBody = crushBody(idleCrush, 0.8, 0);
run(idleCrush, 1); assert.equal(idleBody.hp, 38);
idleCrush.walls = [{ x: 1, z: 0, w: 0.3, d: 3, kind: 'steel', dead: false }];
step(idleCrush, { moveX: 1 }, 0.1); closeTo(playerActor(idleCrush).x, 0); assert.equal(idleBody.hp, 38);
const separatedWall = supportArena(), behindWall = crushBody(separatedWall, 1.1, 0);
separatedWall.walls = [{ x: 0.9, z: 0, w: 0.02, d: 3, kind: 'steel', dead: false }];
step(separatedWall, { moveZ: 1 }, 0.1); assert(playerActor(separatedWall).z > 0); assert.equal(behindWall.hp, 38);
const fastCrush = supportArena(), grazed = crushBody(fastCrush, 0.4, 1.12);
step(fastCrush, { moveX: 1, boost: true }, 0.1);
closeTo(playerActor(fastCrush).x, 0.846); closeTo(grazed.hp, 7.6);
assert.equal(fastCrush.events.filter(e => e.type === 'crush').length, 1);
const [bossCrush, heavyCrusher] = bossBattle(); heavyCrusher.attack = null; heavyCrusher.attackTimer = 10;
const bossVictim = crushBody(bossCrush, heavyCrusher.x + 1.6, heavyCrusher.z); step(bossCrush);
closeTo(bossVictim.hp, 7.6); assert(bossCrush.events.some(e => e.type === 'crush' && e.vehicleId === heavyCrusher.id));

// 下車保護與駕駛席／無人機免疫保持；壓死不能補血復活、繼續射擊或重複計分。
const protectedExit = enemyCrushArena(); protectedExit.player.invulnerable = 0.7;
run(protectedExit, 0.75); assert.equal(protectedExit.player.hp, 100);
assert.equal(protectedExit.player.invulnerable, 0); assert(protectedExit.tanks[1].crushContacts.includes('player'));
const protectedPassenger = supportArena(); step(protectedPassenger, { deployDrone: true });
Object.assign(protectedPassenger.drones[0], { x: 0, z: 0 }); step(protectedPassenger, { moveX: 1 });
assert.equal(protectedPassenger.player.hp, 100); assert.equal(protectedPassenger.drones[0].hp, 45);
const fatalCrush = enemyCrushArena(); fatalCrush.player.hp = 60;
fatalCrush.enemyBases.forEach(base => { base.dead = true; base.hp = 0; });
fatalCrush.pickups.push({ id: ++fatalCrush.serial, x: 0, z: 0, kind: 'repair', dead: false });
step(fatalCrush, {}, 0.1); assert.equal(fatalCrush.phase, 'lost'); assert.equal(fatalCrush.player.hp, 0);
assert.equal(fatalCrush.pickups[0].dead, false); assert.equal(fatalCrush.events.filter(e => e.type === 'death').length, 1);
assert(fatalCrush.events.some(e => e.type === 'crush' && e.dead && e.damage === 60));
step(fatalCrush, { fire: true }); assert.equal(fatalCrush.events.length, 0);
const fatalInfantryCrush = supportArena(), doomedFoot = crushBody(fatalInfantryCrush, 0, -0.9);
fatalInfantryCrush.grace = 0; fatalInfantryCrush.kills = 2; doomedFoot.hp = 8; doomedFoot.cooldown = 0;
step(fatalInfantryCrush, { moveZ: -1 }); assert(doomedFoot.dead); assert.equal(fatalInfantryCrush.score, 120);
assert.equal(fatalInfantryCrush.pickups.length, 1);
assert(!fatalInfantryCrush.events.some(e => e.type === 'shot' && e.kind === 'bullet'));
assert(fatalInfantryCrush.events.some(e => e.type === 'explosion' && e.cause === 'crush'));
for (const phase of ['paused', 'won', 'lost']) {
  crushing.phase = phase;
  const state = JSON.stringify([crushing.player, crushing.enemies, crushing.tanks]); step(crushing, { moveZ: 1 }, 0.1);
  assert.equal(JSON.stringify([crushing.player, crushing.enemies, crushing.tanks]), state);
}
const freshCrush = createGame({ level: 2 });
assert(freshCrush.tanks.every(t => t.crushContacts.length === 0));
assert([freshCrush.player, ...freshCrush.enemies].every(body => body.crushCooldown === 0 && body.crushTime === 0));
// 玩家靜止時也主動飛出，接近五點五單位後停穩射擊，不隨玩家繞行。
const hunting = supportArena(), remoteEnemy = hunting.tanks[1];
step(hunting, { deployDrone: true }, 0.1); const hunter = hunting.drones[0];
assert.equal(hunter.mode, 'attack'); assert.equal(hunter.targetId, remoteEnemy.id); assert.equal(hunter.targetKind, 'tank');
let lastHunterPosition = { x: hunter.x, z: hunter.z };
for (let i = 0; i < 120; i++) {
  step(hunting);
  assert(Math.hypot(hunter.x - lastHunterPosition.x, hunter.z - lastHunterPosition.z) <= 10 / 60 + 1e-8);
  assert.equal(hunter.targetId, remoteEnemy.id);
  lastHunterPosition = { x: hunter.x, z: hunter.z };
}
assert(Math.hypot(hunter.x, hunter.z) > 9); assert(remoteEnemy.hp < 80);
assert.equal(playerActor(hunting).x, 0); assert.equal(playerActor(hunting).z, 0);
assert(Math.hypot(hunter.x - remoteEnemy.x, hunter.z - remoteEnemy.z) <= 5.5);
const firingPosition = { x: hunter.x, z: hunter.z };
playerActor(hunting).x = 5; run(hunting, 0.5);
closeTo(hunter.x, firingPosition.x); closeTo(hunter.z, firingPosition.z);
remoteEnemy.team = 'player'; step(hunting);
assert.equal(hunter.targetId, null); assert.equal(hunter.mode, 'return');

// 厚鋼牆後的敵人仍會被追擊；必須飛越整面牆才取得射線，不能在牆內停住空射。
const wallHunt = supportArena(), shelteredEnemy = wallHunt.tanks[1];
Object.assign(shelteredEnemy, { x: 0, z: -9 });
wallHunt.walls = [{ x: 0, z: -3, w: 10, d: 1.6, kind: 'steel', hp: Infinity, dead: false }];
step(wallHunt, { deployDrone: true });
let crossedCover = false, shotsAcrossCover = 0;
for (let i = 0; i < 90; i++) {
  step(wallHunt); const scoutDrone = wallHunt.drones[0];
  if (scoutDrone.z < -3.95) crossedCover = true;
  else assert.equal(shelteredEnemy.hp, 80);
  for (const shot of wallHunt.events.filter(e => e.type === 'shot' && e.kind === 'drone')) {
    assert(shot.z < -3.95); shotsAcrossCover++;
  }
}
assert(crossedCover && shotsAcrossCover > 0); assert(shelteredEnemy.hp < 80); assert.equal(wallHunt.walls[0].dead, false);

// 雙機初次分派不同敵人，較近新敵不會搶掉既有鎖定；目標失效再挑選，清空後回隊。
const huntingPair = supportArena();
huntingPair.tanks.push({ ...huntingPair.tanks[1], id: ++huntingPair.serial, x: 12, crushContacts: [] });
step(huntingPair, { deployDrone: true }, 0.1); step(huntingPair, { deployDrone: true }, 0.1);
const assignedTargets = huntingPair.drones.map(d => d.targetId);
assert.notEqual(assignedTargets[0], assignedTargets[1]);
const nearbyInfantry = crushBody(huntingPair, huntingPair.drones[0].x + 0.4, huntingPair.drones[0].z + 0.4);
for (let i = 0; i < 70; i++) { step(huntingPair); assert.deepEqual(huntingPair.drones.map(d => d.targetId), assignedTargets); }
huntingPair.tanks.find(t => t.id === assignedTargets[0]).dead = true; step(huntingPair);
assert.equal(huntingPair.drones[0].targetId, nearbyInfantry.id); assert.equal(huntingPair.drones[0].targetKind, 'infantry');
assert.equal(huntingPair.drones[1].targetId, assignedTargets[1]);
nearbyInfantry.dead = true; step(huntingPair);
assert(huntingPair.drones.every(d => d.targetId === assignedTargets[1]), '只剩一名敵人時可集中火力');
const abandonedTarget = huntingPair.tanks.find(t => t.id === assignedTargets[1]);
abandonedTarget.team = 'neutral'; abandonedTarget.occupied = false; step(huntingPair);
assert(huntingPair.drones.every(d => d.targetId === null && d.targetKind === null && d.mode === 'return'));
run(huntingPair, 2);
for (const drone of huntingPair.drones) {
  closeTo(drone.x, drone.slot === 0 ? 1.8 : -1.8, 0.12); closeTo(drone.z, 0.5, 0.12);
}
// 基地每二十五秒依序供應，已有同種未撿箱就跳過該輪，不重複投放或廣播。
const supplies = supportArena(), deliveries = [];
assert.equal(supplies.base.supplyTimer, 25); assert.equal(supplies.base.supplyIndex, 0);
for (let i = 0; i < 150 * 60; i++) {
  step(supplies);
  for (const delivery of supplies.events.filter(e => e.type === 'base-supply')) {
    deliveries.push(delivery); closeTo(supplies.time, deliveries.length * 25);
    const box = supplies.pickups.find(p => p.id === delivery.pickupId);
    assert.equal(box.origin, 'base'); assert.equal(box.kind, delivery.kind); closeTo(box.dropTime, 1);
    assert.equal(box.x, delivery.x); assert.equal(box.z, delivery.z);
  }
}
assert.deepEqual(deliveries.map(d => d.kind), ['ammo', 'drone', 'missile']);
assert.equal(supplies.pickups.filter(p => !p.dead).length, 3); assert.equal(supplies.base.supplyIndex, 0);
supplies.pickups.find(p => p.kind === 'drone').dead = true;
run(supplies, 25); assert.equal(supplies.pickups.filter(p => !p.dead).length, 2);
run(supplies, 25); assert.equal(supplies.pickups.filter(p => !p.dead).length, 3);
assert(supplies.events.some(e => e.type === 'base-supply' && e.kind === 'drone'));

// 箱子下降一秒才可拾取；空中箱也計入去重，暫停時降落與基地倒數一起停住。
const landing = supportArena(); landing.base.supplyTimer = 0;
step(landing); const fallingBox = landing.pickups[0];
Object.assign(playerActor(landing), { x: fallingBox.x, z: fallingBox.z, ammo: 8 });
run(landing, 0.5); assert.equal(fallingBox.dead, false); assert.equal(playerActor(landing).ammo, 8); closeTo(fallingBox.dropTime, 0.5);
landing.phase = 'paused'; const remainingFall = fallingBox.dropTime, remainingSupply = landing.base.supplyTimer;
step(landing, {}, 0.1); assert.equal(fallingBox.dropTime, remainingFall); assert.equal(landing.base.supplyTimer, remainingSupply);
landing.phase = 'playing'; landing.base.supplyTimer = 0; landing.base.supplyIndex = 0;
step(landing); assert.equal(landing.pickups.length, 1); assert(!landing.events.some(e => e.type === 'base-supply'));
run(landing, 0.5); assert.equal(fallingBox.dropTime, 0); assert(fallingBox.dead); assert.equal(playerActor(landing).ammo, 13);

// 武器箱只補主砲與一枚手榴彈；滿額留箱，換彈／包紮狀態與血量維持原狀。
const ammoSupply = supportArena(), armedSupply = playerActor(ammoSupply);
Object.assign(armedSupply, { ammo: 8, hp: 70 });
Object.assign(ammoSupply.player, { grenades: 2, hp: 60, rifleAmmo: 7, reloadTime: 1, bandageTime: 1, bleeding: true });
const addAmmoBox = state => {
  const actor = playerActor(state), box = { id: ++state.serial, x: actor.x, z: actor.z, kind: 'ammo', dead: false };
  state.pickups.push(box); return box;
};
addAmmoBox(ammoSupply); step(ammoSupply);
assert.equal(armedSupply.ammo, 13); assert.equal(ammoSupply.player.grenades, 3);
assert.equal(armedSupply.hp, 70); assert.equal(ammoSupply.player.hp, 60); assert.equal(ammoSupply.player.rifleAmmo, 7);
closeTo(ammoSupply.player.reloadTime, 1 - 1 / 60); closeTo(ammoSupply.player.bandageTime, 1 - 1 / 60);
assert(ammoSupply.events.some(e => e.type === 'pickup' && e.kind === 'ammo' && e.ammoAdded === 5 && e.grenadesAdded === 1));
addAmmoBox(ammoSupply); step(ammoSupply); assert.equal(armedSupply.ammo, 15);
assert(ammoSupply.events.some(e => e.type === 'pickup' && e.ammoAdded === 2 && e.grenadesAdded === 0));
const fullAmmoBox = addAmmoBox(ammoSupply); step(ammoSupply); assert.equal(fullAmmoBox.dead, false);
ammoSupply.player.grenades = 2; step(ammoSupply); assert(fullAmmoBox.dead); assert.equal(ammoSupply.player.grenades, 3);
for (const mode of ['foot', 'apc']) {
  const state = supportArena(), vehicle = playerActor(state); vehicle.ammo = 4;
  if (mode === 'foot') assert(interact(state));
  else Object.assign(vehicle, { kind: 'apc', maxAmmo: 0, ammo: 0 });
  state.player.grenades = 2; state.player.rifleAmmo = 11;
  const box = addAmmoBox(state); step(state);
  assert(box.dead); assert.equal(state.player.grenades, 3); assert.equal(state.player.rifleAmmo, 11);
  assert.equal(vehicle.ammo, mode === 'foot' ? 4 : 0);
  assert(state.events.some(e => e.type === 'pickup' && e.ammoAdded === 0 && e.grenadesAdded === 1));
  const spare = addAmmoBox(state); step(state); assert.equal(spare.dead, false);
}

// 找不到直達空地時保留輪序稍後重試；五十圖、三類箱均驗證落點與整條可走路線。
const trappedSupply = supportArena(); trappedSupply.base.supplyTimer = 0;
trappedSupply.walls = [
  { x: 0, z: -1.3, w: 4, d: 0.2 }, { x: 0, z: 1.3, w: 4, d: 0.2 },
  { x: -1.3, z: 0, w: 0.2, d: 4 }, { x: 1.3, z: 0, w: 0.2, d: 4 },
].map(w => ({ ...w, kind: 'steel', dead: false }));
step(trappedSupply); assert.equal(trappedSupply.pickups.length, 0); assert.equal(trappedSupply.base.supplyIndex, 0); closeTo(trappedSupply.base.supplyTimer, 1);
trappedSupply.walls = []; run(trappedSupply, 1);
assert.equal(trappedSupply.pickups.length, 1); assert.equal(trappedSupply.pickups[0].kind, 'ammo'); assert.equal(trappedSupply.base.supplyIndex, 1);
for (const level of LEVELS) {
  const state = quiet(Object.assign(createGame({ level: level.id }), { phase: 'playing' }));
  for (const kind of ['ammo', 'drone', 'missile']) {
    state.base.supplyTimer = 0; step(state); const box = state.pickups.at(-1), actor = playerActor(state);
    assert.equal(box?.kind, kind, `第 ${level.id} 關應有 ${kind} 的安全落點`);
    const range = Math.hypot(box.x - actor.x, box.z - actor.z);
    assert(range >= 2.5 - 1e-8 && range <= 4 + 1e-8); assert(segmentClear(state, actor, box));
    assert(state.tanks.every(t => t === actor || t.dead || Math.hypot(t.x - box.x, t.z - box.z) >= 1.66));
  }
  assert.equal(new Set(state.pickups.map(p => `${p.x},${p.z}`)).size, 3);
}
const acrossWaves = supportArena(); acrossWaves.base.supplyTimer = 20;
aliveEnemies(acrossWaves).forEach(e => { e.dead = true; }); run(acrossWaves, 2.6);
assert.equal(acrossWaves.wave, 2); closeTo(acrossWaves.base.supplyTimer, 17.4);
for (const phase of ['ready', 'paused', 'won', 'lost']) {
  const state = supportArena(); state.phase = phase; state.base.supplyTimer = 0;
  state.pickups.push({ id: ++state.serial, x: 0, z: 0, kind: 'ammo', origin: 'base', dropTime: 0.5, dead: false });
  const before = JSON.stringify([state.base, state.pickups]); step(state, {}, 0.1);
  assert.equal(JSON.stringify([state.base, state.pickups]), before); assert.equal(state.events.length, 0);
}
for (const ending of ['base', 'player', 'headquarters', 'waves']) {
  const state = supportArena(); state.base.supplyTimer = 0;
  if (ending === 'base') state.base.hp = 0;
  if (ending === 'player') state.player.hp = 0;
  if (ending === 'headquarters') state.enemyBases.forEach(b => { b.dead = true; });
  if (ending === 'waves') { state.wave = 3; aliveEnemies(state).forEach(e => { e.dead = true; }); }
  step(state); assert.equal(state.phase, ending === 'base' || ending === 'player' ? 'lost' : 'won');
  assert.equal(state.pickups.length, 0); assert(!state.events.some(e => e.type === 'base-supply'));
}
const freshSupply = createGame(); assert.equal(freshSupply.base.supplyTimer, 25); assert.equal(freshSupply.base.supplyIndex, 0);
console.log('simulation checks passed: 50 maps / 150 waves, combat, offensive drones, missiles, crushing and base supplies');
