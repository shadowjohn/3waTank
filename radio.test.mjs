import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRadio } from './radio.mjs';
import { radioLines } from './radio-lines.mjs';

assert.ok(radioLines.length);
assert.equal(new Set(radioLines.map(line => line.id)).size, radioLines.length);
assert.equal(new Set(radioLines.map(line => line.src)).size, radioLines.length);
assert.equal(new Set(radioLines.map(line => createHash('sha256')
  .update(readFileSync(new URL(line.src, import.meta.url))).digest('hex'))).size, radioLines.length,
'同一段原聲不得換檔名重複收錄');
const supplies = radioLines.filter(line => line.event === 'baseSupply');
assert.ok(supplies.length >= 2 && supplies.length <= 4);
assert.equal(radioLines.length - supplies.length, 28);
assert.ok(supplies.every(line => line.team === 'player' && line.speaker === '基地軍需官'));
for (const line of radioLines) {
  assert.ok(line.event && line.speaker && line.text);
  assert.doesNotMatch(line.text, /幹[！!，,]|靠北|他媽的|老子|躲屁/, '台詞不得含有舊版髒話');
  assert.ok(line.volume > 0 && line.volume <= 1);
  assert.ok(statSync(new URL(line.src, import.meta.url)).size > 0, line.src);
}

const saved = Object.fromEntries(['Audio', 'performance', 'setTimeout', 'clearTimeout']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const random = Math.random, warn = console.warn;
let now = 0, timerId = 0, audio;
const timers = new Map(), warnings = [];
function advance(ms) {
  const target = now + ms;
  for (;;) {
    const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next || next[1].at > target) break;
    timers.delete(next[0]);
    now = next[1].at;
    next[1].callback();
  }
  now = target;
}
class FakeAudio {
  paused = true;
  ended = false;
  currentTime = 0;
  plays = [];
  pauses = 0;
  constructor() { audio = this; }
  pause() { this.paused = true; this.pauses++; }
  play() {
    this.paused = false;
    return new Promise((resolve, reject) => this.plays.push({ src: this.src, resolve, reject }));
  }
}

try {
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  globalThis.Audio = FakeAudio;
  globalThis.setTimeout = (callback, delay) => {
    const id = ++timerId;
    timers.set(id, { at: now + delay, callback });
    return id;
  };
  globalThis.clearTimeout = id => timers.delete(id);
  Math.random = () => 0;
  console.warn = (...args) => warnings.push(args);
  const panel = { hidden: true, dataset: {} }, speaker = {}, text = {}, channel = {};
  const radio = createRadio({ panel, speaker, text, channel });
  const selected = () => radioLines.find(line => line.src === audio.src);

  assert.equal(radio.say('start'), true);
  assert.equal(selected().event, 'start');
  assert.equal(speaker.textContent, selected().speaker);
  assert.equal(text.textContent, selected().text);
  assert.equal(audio.volume, 0.82 * selected().volume);
  assert.equal(panel.dataset.team, 'enemy');
  assert.equal(panel.hidden, false);
  assert.equal(radio.speaking, true);
  const firstSrc = audio.src, liveLabel = channel.textContent;
  for (let i = 0; i < 30; i++) assert.equal(radio.say('hurt'), false);
  assert.equal(audio.plays.length, 1);
  advance(6000);
  assert.equal(panel.hidden, true);
  advance(499);
  assert.equal(radio.say('start'), false);
  advance(1);
  assert.equal(radio.say('start'), true);
  assert.notEqual(audio.src, firstSrc);
  assert.equal(audio.plays.length, 2);

  advance(1000);
  const pauses = audio.pauses;
  assert.equal(radio.say('hurt', { force: true }), true);
  assert.ok(audio.pauses > pauses);
  assert.equal(selected().event, 'hurt');
  assert.equal(audio.plays.length, 3);
  advance(5000);
  assert.equal(panel.hidden, false, '舊字幕計時器不得隱藏新句子');
  advance(1000);
  assert.equal(panel.hidden, true);
  advance(2000);
  assert.equal(radio.speaking, false);
  assert.equal(timers.size, 0);
  assert.equal(audio.plays.length, 3, '被限流的台詞不得排隊播放');

  for (const event of new Set(radioLines.map(line => line.event))) {
    radio.say(event, { force: true });
    assert.equal(audio.volume, 0.82 * selected().volume);
    const previous = audio.src;
    radio.say(event, { force: true });
    assert.notEqual(audio.src, previous, `${event} 不得立即重複`);
  }
  const stale = audio.plays.at(-1);
  radio.say('start', { force: true });
  const currentText = text.textContent;
  stale.reject({ name: 'AbortError' });
  await Promise.resolve();
  assert.equal(channel.textContent, liveLabel);
  assert.equal(text.textContent, currentText);
  assert.equal(panel.hidden, false);
  assert.equal(warnings.length, 0);
  audio.plays.at(-1).reject({ name: 'NotAllowedError' });
  await Promise.resolve();
  assert.equal(text.textContent, currentText);
  assert.equal(panel.hidden, false);
  assert.match(channel.textContent, /僅字幕/);
  assert.equal(warnings.length, 1);

  const plays = audio.plays.length;
  radio.setMuted(true);
  assert.equal(radio.speaking, false);
  assert.equal(radio.say('playerExit', { force: true }), true);
  assert.ok(radioLines.some(line => line.event === 'playerExit' && line.text === text.textContent));
  assert.equal(panel.hidden, false);
  assert.match(channel.textContent, /僅字幕/);
  assert.equal(audio.plays.length, plays);
  assert.equal(timers.size, 1);
  radio.setEnabled(false);
  assert.equal(radio.enabled, false);
  assert.equal(panel.hidden, true);
  assert.equal(timers.size, 0);
  assert.equal(radio.say('start', { force: true }), false);
  assert.equal(audio.plays.length, plays);
  radio.setEnabled(true);
  radio.setMuted(false);
  assert.equal(radio.say('unknown', { force: true }), false);
  assert.equal(radio.say('start', { force: true }), true);
  radio.stop();
  assert.equal(panel.hidden, true);
  assert.equal(radio.speaking, false);
  assert.equal(audio.currentTime, 0);
  assert.equal(timers.size, 0);
  audio.plays.at(-1).reject({ name: 'AbortError' });
  await Promise.resolve();
  advance(10000);
  assert.equal(warnings.length, 1);
  assert.equal(panel.hidden, true);
  assert.equal(audio.plays.length, plays + 1);

  // 基地沿用同一個播放器；敵我切換不得保留過期頻道或排隊補播。
  radio.say('start', { force: true });
  const enemyPlayback = audio.plays.at(-1), beforeSupplyPause = audio.pauses;
  assert.equal(radio.say('baseSupply', { force: true }), true);
  assert.ok(audio.pauses > beforeSupplyPause);
  assert.equal(selected().event, 'baseSupply');
  assert.equal(panel.dataset.team, 'player');
  assert.equal(speaker.textContent, '基地軍需官');
  assert.equal(channel.textContent, '基地頻道 · 補給通知');
  const supplyText = text.textContent, beforeSupplyWarnings = warnings.length;
  enemyPlayback.reject({ name: 'AbortError' });
  await Promise.resolve();
  assert.equal(channel.textContent, '基地頻道 · 補給通知');
  assert.equal(warnings.length, beforeSupplyWarnings);
  audio.plays.at(-1).reject({ name: 'NotAllowedError' });
  await Promise.resolve();
  assert.equal(text.textContent, supplyText);
  assert.equal(channel.textContent, '基地頻道 · 僅字幕');
  assert.equal(panel.hidden, false);
  radio.setMuted(true);
  assert.equal(radio.speaking, false);
  assert.equal(channel.textContent, '基地頻道 · 僅字幕');
  const beforeMutedSupply = audio.plays.length;
  assert.equal(radio.say('baseSupply', { force: true }), true);
  assert.equal(panel.dataset.team, 'player');
  assert.equal(channel.textContent, '基地頻道 · 僅字幕');
  assert.equal(audio.plays.length, beforeMutedSupply);
  assert.equal(timers.size, 1);
  radio.setEnabled(false);
  assert.equal(panel.hidden, true);
  assert.equal(timers.size, 0);
  assert.equal(radio.say('baseSupply', { force: true }), false);
  radio.setEnabled(true);
  radio.setMuted(false);
  radio.say('baseSupply', { force: true });
  radio.stop();
  assert.equal(panel.hidden, true);
  assert.equal(radio.speaking, false);
  assert.equal(audio.currentTime, 0);
  assert.equal(timers.size, 0);
  audio.plays.at(-1).reject({ name: 'AbortError' });
  await Promise.resolve();
  assert.equal(warnings.length, beforeSupplyWarnings + 1);
  radio.say('start', { force: true });
  assert.equal(panel.dataset.team, 'enemy');
  assert.equal(channel.textContent, '敵軍頻道 · 無線電攔截');
  radio.stop();
  console.log(`PASS: ${radioLines.length} 語音檔、原聲去重、敵我頻道、字幕、限流、強制插播、靜音、停用、停止與非同步失敗`);
} finally {
  for (const [key, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  Math.random = random;
  console.warn = warn;
}
