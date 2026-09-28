import { radioLines } from './radio-lines.mjs?v=20260928-13';

export function createRadio({ panel, speaker, text, channel }) {
  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = 0.82;
  const previous = new Map();
  let enabled = true;
  let muted = false;
  let channelName = '敵軍頻道';
  let lastSpoken = -Infinity;
  let captionTimer;
  let playbackTimer;
  let generation = 0;

  function silence() {
    generation++;
    clearTimeout(playbackTimer);
    audio.pause();
    audio.currentTime = 0;
  }
  function stop() {
    silence();
    clearTimeout(captionTimer);
    panel.hidden = true;
  }
  function say(event, { force = false } = {}) {
    const now = performance.now();
    if (!enabled || (!force && now - lastSpoken < 6500)) return false;
    const lines = radioLines.filter(line => line.event === event);
    if (!lines.length) return false;
    const choices = lines.filter(line => line.id !== previous.get(event));
    const pool = choices.length ? choices : lines;
    const line = pool[Math.floor(Math.random() * pool.length)];
    stop();
    lastSpoken = now;
    previous.set(event, line.id);
    speaker.textContent = line.speaker;
    text.textContent = line.text;
    const friendly = line.team === 'player';
    panel.dataset.team = friendly ? 'player' : 'enemy';
    channelName = friendly ? '基地頻道' : '敵軍頻道';
    channel.textContent = `${channelName} · ${muted ? '僅字幕' : friendly ? '補給通知' : '無線電攔截'}`;
    panel.hidden = false;
    captionTimer = setTimeout(() => { panel.hidden = true; }, 6000);
    if (!muted) {
      audio.src = line.src;
      audio.volume = 0.82 * (line.volume ?? 1);
      const current = generation;
      // 每次只播一句；失敗或取消不排隊，字幕仍然顯示。
      audio.play().catch(error => {
        if (current !== generation) return;
        channel.textContent = `${channelName} · 僅字幕`;
        console.warn('戰場語音無法播放，保留字幕：', error.name);
      });
      playbackTimer = setTimeout(silence, 8000);
    }
    return true;
  }
  return {
    say, stop,
    get enabled() { return enabled; },
    get speaking() { return !audio.paused && !audio.ended; },
    setEnabled(value) { enabled = Boolean(value); if (!enabled) stop(); },
    setMuted(value) {
      muted = Boolean(value);
      if (muted) { silence(); channel.textContent = `${channelName} · 僅字幕`; }
    },
  };
}
