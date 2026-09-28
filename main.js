const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries(['overlay', 'overlay-title', 'overlay-kicker', 'overlay-description', 'start-button', 'loading', 'score', 'wave', 'remaining', 'mode', 'player-hp', 'tank-hp', 'base-hp', 'player-hp-label', 'tank-hp-label', 'base-hp-label', 'tank-status', 'toast', 'interaction-hint', 'pause-button', 'sound-button'].map(id => [id, $(id)]));

async function boot() {
  const [THREE, { createGame, step, interact, playerActor }, models, { createRadio }, { LEVELS, getLevel }] = await Promise.all([
    import('/inc/javascript/three.js/three.js/build/three.module.js'),
    import('./simulation.mjs?v=20260928-13'),
    import('./models.js?v=20260928-13'),
    import('./radio.mjs?v=20260928-13'),
    import('./levels.mjs?v=20260927-6a'),
  ]);
  const radio = createRadio({ panel: $('enemy-radio'), speaker: $('radio-speaker'), text: $('radio-text'), channel: $('radio-channel') });
  const progressKey = 'tank-campaign-v1';
  const progress = { level: 1, cleared: [] };
  let progressSaved = true;
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey));
    if (saved && typeof saved === 'object') {
      progress.level = getLevel(saved.level).id;
      if (Array.isArray(saved.cleared)) progress.cleared = [...new Set(saved.cleared.filter(id => Number.isInteger(id) && id >= 1 && id <= LEVELS.length))];
    }
  } catch { progressSaved = false; }
  let game = createGame({ seed: Date.now(), level: progress.level });
  const palette = models.applyTheme(game.level.theme);
  const canvas = $('battlefield');
  const damageFlash = $('damage-flash');
  const bloodOverlay = $('blood-overlay');
  const bloodDrops = Array.from({ length: 8 }, () => {
    const drop = document.createElement('i');
    drop.className = 'blood-drop';
    bloodOverlay.append(drop);
    return drop;
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.background);
  scene.fog = new THREE.Fog(palette.background, 72, 115);
  const camera = new THREE.OrthographicCamera(-24, 24, 18, -18, 0.1, 150);
  camera.position.set(0, 34, 27);
  camera.lookAt(0, 0, 0);
  const hemisphere = new THREE.HemisphereLight(palette.ambient, '#172532', 1.2);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(palette.sun, 2);
  sun.position.set(-16, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(250, 250), new THREE.MeshStandardMaterial({ color: palette.background, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.85;
  ground.receiveShadow = true;
  let terrain = models.terrainModel(game.level.theme);
  scene.add(ground, terrain);
  const world = new THREE.Group();
  scene.add(world);
  const base = models.baseModel();
  base.position.set(0, 0, 12);
  world.add(base);
  const selection = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.12, 48), new THREE.MeshBasicMaterial({ color: '#86e0be', transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  selection.rotation.x = -Math.PI / 2;
  selection.position.y = 0.055;
  world.add(selection);
  const aimMarker = new THREE.Group();
  const aimMaterial = new THREE.MeshBasicMaterial({ color: '#f7f4df', transparent: true, opacity: 0.85, depthWrite: false });
  const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.30, 24), aimMaterial);
  aimRing.rotation.x = -Math.PI / 2;
  aimMarker.add(aimRing);
  for (const x of [-0.45, 0.45]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.02, 0.04), aimMaterial);
    bar.position.x = x;
    aimMarker.add(bar);
  }
  aimMarker.position.y = 0.08;
  world.add(aimMarker);
  const visuals = new Map();
  const particles = [];
  const particleGeometry = new THREE.BoxGeometry(0.13, 0.13, 0.13);
  const fxMaterials = [0xffb94d, 0xfff4bd, 0x566573, 0xf07544].map(color => new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  const bloodMaterial = new THREE.MeshBasicMaterial({ color: '#bd283b', toneMapped: false });
  const bulletGeometry = new THREE.SphereGeometry(0.12, 6, 4);
  // 曳光彈保持原色亮度，避免夜間曝光把彈道一起壓暗。
  const bulletMaterials = { player: new THREE.MeshBasicMaterial({ color: '#fff3a6', toneMapped: false }), enemy: new THREE.MeshBasicMaterial({ color: '#ff7964', toneMapped: false }) };
  const warningRing = new THREE.RingGeometry(0.94, 1, 48);
  const warningDisc = new THREE.CircleGeometry(1, 48);
  const warningLine = new THREE.BoxGeometry(0.055, 0.015, 1);
  const warningMaterial = new THREE.MeshBasicMaterial({ color: '#ff604c', transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide });
  const warningFill = new THREE.MeshBasicMaterial({ color: '#ff604c', transparent: true, opacity: 0.15, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide });
  const attackNames = { fan: '扇形重砲 · 躲進掩體', grenades: '追擊榴彈 · 持續移動', barrage: '範圍轟炸 · 離開紅圈' };
  const missileMaterial = new THREE.MeshBasicMaterial({ color: '#ffcc68', transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false });
  const supportMaterial = new THREE.MeshBasicMaterial({ color: '#83faff', toneMapped: false });
  const exhaustGeometry = new THREE.ConeGeometry(0.18, 1, 6);
  base.position.set(game.base.x, 0, game.base.z);
  let paused = false;
  let lastPhase = 'ready';
  let lastWave = 1;
  let toastUntil = 0;
  let lastHud = 0;
  let soundEnabled = true;
  let audio;
  let breathBuffer;
  let nextBreath = 0;
  let lastGunSound = 0;
  let nextChatter = 10;
  let hitRed = 0;
  let bloodLife = 0;
  let shake = 0;
  let resultDelay = 0;
  const keys = new Set();
  const pointers = new Map();
  let mouseFire = false;
  let secondaryRequested = false;
  let droneRequested = false;
  let reloadRequested = false;
  let bandageRequested = false;
  let pointerAim = false;
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aimPoint = new THREE.Vector3();
  const input = { moveX: 0, moveZ: 0, aimX: null, aimZ: null, fire: false, throwGrenade: false, fireMissile: false, boost: false, deployDrone: false, reload: false, bandage: false };
  const levelSelect = $('level-select');
  levelSelect.replaceChildren();
  for (const level of LEVELS) {
    let group = [...levelSelect.children].find(optionGroup => optionGroup.label === level.region);
    if (!group) { group = document.createElement('optgroup'); group.label = level.region; levelSelect.append(group); }
    group.append(new Option(`${String(level.id).padStart(2, '0')} · ${level.name}${level.id % 5 === 0 ? ' · 魔王戰' : ''}`, String(level.id)));
  }

  function updateLevelInfo() {
    const level = game.level;
    levelSelect.value = String(level.id);
    levelSelect.disabled = game.phase === 'playing';
    $('level-name').textContent = `${String(level.id).padStart(2, '0')} / ${LEVELS.length} · ${level.name}`;
    $('region-name').textContent = `${level.region} · 守住基地`;
    $('level-briefing').textContent = level.briefing + (level.id % 5 === 0 ? ' 第三波：攻城魔王「毀城者」出擊，注意紅色砲擊預警。' : '');
    $('briefing-note').textContent = `守住 ${level.waves.length} 波攻勢，或摧毀全部 ${level.enemyBaseCount} 座敵方基地 · 友軍火力也會傷基地`;
    $('campaign-progress').textContent = `已完成 ${progress.cleared.length} / ${LEVELS.length} 關 · ${progressSaved ? '進度自動保存在此瀏覽器' : '目前僅保留本次進度'}`;
  }
  function saveProgress() {
    try { localStorage.setItem(progressKey, JSON.stringify(progress)); progressSaved = true; }
    catch { progressSaved = false; }
    updateLevelInfo();
  }
  function nextLevel() {
    return game.level.id < LEVELS.length ? game.level.id + 1 : LEVELS.find(level => !progress.cleared.includes(level.id))?.id || 1;
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const span = Math.max(36, 37 / aspect);
    camera.left = -span * aspect / 2;
    camera.right = span * aspect / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', resize);
  resize();

  function toast(message, seconds = 2.5) {
    ui.toast.textContent = message;
    ui.toast.classList.add('visible');
    toastUntil = performance.now() + seconds * 1000;
  }
  function initAudio() {
    if (!audio) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (Context) audio = new Context();
    }
    audio?.resume().catch(() => {});
  }
  function sound(kind, ammoRemaining = null) {
    if (!soundEnabled || !audio || audio.state !== 'running') return;
    if (kind === 'breath' || kind === 'missile') {
      if (!breathBuffer) {
        breathBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 0.25), audio.sampleRate);
        const samples = breathBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
      source.buffer = breathBuffer;
      filter.type = 'lowpass'; filter.frequency.value = kind === 'missile' ? 2300 : 950;
      source.connect(filter); filter.connect(gain); gain.connect(audio.destination);
      gain.gain.setValueAtTime(0.001, audio.currentTime);
      gain.gain.linearRampToValueAtTime((kind === 'missile' ? 0.15 : 0.06) * (radio.speaking ? 0.4 : 1), audio.currentTime + 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
      source.start();
      return;
    }
    if (kind === 'bullet' && audio.currentTime - lastGunSound < 0.07) return;
    lastGunSound = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    const lowAmmo = kind === 'shell' && ammoRemaining !== null && ammoRemaining <= 5;
    const duration = kind === 'warning' ? 0.5 : kind === 'explosion' ? 0.28 : kind === 'shell' ? 0.14 : 0.055;
    oscillator.type = kind === 'pickup' ? 'sine' : lowAmmo || kind === 'empty' ? 'square' : 'sawtooth';
    oscillator.frequency.setValueAtTime(kind === 'warning' ? 130 : kind === 'empty' ? 760 : lowAmmo ? 240 : kind === 'pickup' ? 620 : kind === 'bullet' ? 210 : kind === 'grenade' ? 380 : 95, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'warning' ? 420 : kind === 'pickup' ? 920 : lowAmmo ? 85 : 30, audio.currentTime + duration);
    gain.gain.setValueAtTime((kind === 'bullet' ? 0.025 : 0.07) * (radio.speaking ? 0.4 : 1), audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }
  function clearInput() {
    keys.clear();
    pointers.clear();
    mouseFire = false;
    secondaryRequested = false;
    droneRequested = false;
    reloadRequested = bandageRequested = false;
    document.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
  }
  function resetImpact() {
    hitRed = shake = bloodLife = 0;
    damageFlash.style.opacity = '0';
    bloodOverlay.style.opacity = '0';
    camera.position.set(0, 34, 27);
    camera.lookAt(0, 0, 0);
  }
  function impact(strength) {
    hitRed = Math.max(hitRed, Math.min(0.95, strength));
    shake = Math.max(shake, strength * 0.5);
  }
  function updateImpact(dt) {
    hitRed = Math.max(0, hitRed - dt * 1.35);
    bloodLife = Math.max(0, bloodLife - dt);
    shake = Math.max(0, shake - dt * 1.1);
    damageFlash.style.opacity = String(Math.min(reducedMotion.matches ? 0.28 : 0.95, hitRed));
    bloodOverlay.style.opacity = String(Math.min(reducedMotion.matches ? 0.24 : 0.65, bloodLife));
    const amount = reducedMotion.matches || paused ? 0 : shake;
    const x = (Math.random() - 0.5) * amount, z = (Math.random() - 0.5) * amount;
    camera.position.set(x, 34, 27 + z);
    camera.lookAt(x, 0, z);
  }
  function removeVisual(mesh) {
    mesh.removeFromParent();
    // 實例的 GPU 緩衝區各自釋放，共用幾何與材質保留給下一局。
    mesh.traverse(part => { if (part.isInstancedMesh) part.dispose(); });
  }
  function showOverlay(kicker, title, description, button) {
    ui['overlay-kicker'].textContent = kicker;
    ui['overlay-title'].textContent = title;
    ui['overlay-description'].textContent = description;
    if (game.phase === 'won' || game.phase === 'lost') ui['overlay-description'].after($('enemy-radio'));
    ui['start-button'].textContent = button;
    updateLevelInfo();
    ui.overlay.hidden = false;
    ui['start-button'].focus({ preventScroll: true });
    document.body.dataset.state = paused ? 'paused' : game.phase;
  }
  function setPause(value) {
    if (game.phase !== 'playing') return;
    paused = value;
    clearInput();
    resetImpact();
    if (value) radio.stop();
    ui['pause-button'].textContent = value ? '繼續 ▷' : '暫停 Ⅱ';
    ui['pause-button'].setAttribute('aria-label', value ? '繼續遊戲' : '暫停遊戲');
    if (value) showOverlay('TAKE A BREATHER', '戰術暫停', '戰場已暫停，準備好了就回到前線。', '繼續戰鬥 →');
    else {
      ui.overlay.hidden = true;
      document.body.dataset.state = 'playing';
      canvas.focus({ preventScroll: true });
    }
  }
  function loadLevel(level) {
    radio.stop();
    resetImpact();
    resultDelay = 0;
    $('boss-status').hidden = true;
    document.body.dataset.boss = 'false';
    ui.overlay.before($('enemy-radio'));
    game = createGame({ seed: Date.now(), level });
    for (const visual of visuals.values()) removeVisual(visual);
    visuals.clear();
    for (const particle of particles) world.remove(particle.mesh);
    particles.length = 0;
    removeVisual(terrain);
    const colors = models.applyTheme(game.level.theme);
    terrain = models.terrainModel(game.level.theme);
    scene.add(terrain);
    scene.background.set(colors.background);
    scene.fog.color.set(colors.background);
    ground.material.color.set(colors.background);
    hemisphere.color.set(colors.ambient);
    sun.color.set(colors.sun);
    base.position.set(game.base.x, 0, game.base.z);
    paused = false;
    ui['pause-button'].textContent = '暫停 Ⅱ';
    ui['pause-button'].setAttribute('aria-label', '暫停遊戲');
    lastWave = 1;
    lastPhase = 'ready';
    lastHud = 0;
    nextChatter = 10;
    nextBreath = 0;
    pointerAim = false;
    ui.toast.classList.remove('visible');
    clearInput();
    updateLevelInfo();
  }
  levelSelect.addEventListener('change', () => {
    if (game.phase === 'playing') return;
    loadLevel(levelSelect.value);
    progress.level = game.level.id;
    saveProgress();
    showOverlay(`STAGE ${String(game.level.id).padStart(2, '0')} / ${LEVELS.length}`, '整裝待發', `${game.level.region} · ${game.level.name}`, `出擊第 ${game.level.id} 關 →`);
  });
  ui['start-button'].addEventListener('click', () => {
    initAudio();
    if (paused) return setPause(false);
    if (game.phase === 'won') loadLevel(nextLevel());
    else if (game.phase === 'lost') loadLevel(game.level.id);
    game.phase = 'playing';
    progress.level = game.level.id;
    saveProgress();
    ui.overlay.hidden = true;
    document.body.dataset.state = 'playing';
    canvas.focus({ preventScroll: true });
    toast(`第 ${game.level.id} 關 · ${game.level.name} · 第一波來襲`, 3);
    radio.say('start', { force: true });
  });
  ui['pause-button'].addEventListener('click', () => setPause(!paused));
  ui['sound-button'].addEventListener('click', () => {
    initAudio();
    soundEnabled = !soundEnabled;
    radio.setMuted(!soundEnabled);
    ui['sound-button'].textContent = soundEnabled ? '音效 ON' : '音效 OFF';
    ui['sound-button'].setAttribute('aria-pressed', String(soundEnabled));
    if (game.phase === 'playing' && !paused) canvas.focus({ preventScroll: true });
  });
  $('voice-button').addEventListener('click', () => {
    radio.setEnabled(!radio.enabled);
    $('voice-button').textContent = radio.enabled ? '語音 ON' : '語音 OFF';
    $('voice-button').setAttribute('aria-pressed', String(radio.enabled));
    if (game.phase === 'playing' && !paused) {
      if (radio.enabled) radio.say('chase', { force: true });
      canvas.focus({ preventScroll: true });
    }
  });
  function interactPlayer() {
    if (game.phase !== 'playing' || paused) return;
    const before = game.player.tankId;
    const eventStart = game.events.length;
    interact(game);
    if (before !== game.player.tankId) {
      const tank = game.tanks.find(t => t.id === game.player.tankId);
      toast(!tank ? '已下車 · Shift 急跑，F 接管空車' : tank.kind === 'apc' ? '接管運兵車 · Shift 氮氣，F 下車作戰' : `裝甲接管 · 主砲 ${tank.ammo} 發／追蹤彈 ${tank.missiles} 發`);
      sound('pickup');
      // 手動上下車發生在兩個影格之間，先讀取事件，避免被下一次 step 清掉。
      if (game.events.slice(eventStart).some(event => event.stolen)) radio.say('stolen', { force: true });
      else if (game.player.tankId == null) radio.say('playerExit');
    } else toast(before == null ? '靠近無人坦克，再按 F 上車' : '周圍太擠，移到空地再下車');
  }
  window.addEventListener('keydown', event => {
    if (event.code === 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
    const controls = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyF', 'KeyG', 'KeyR', 'KeyZ', 'KeyP', 'Escape', 'ShiftLeft', 'ShiftRight'];
    if (event.target.tagName === 'SELECT') return;
    if (controls.includes(event.code) && game.phase === 'playing' && event.target.tagName !== 'BUTTON') event.preventDefault();
    if (!event.repeat && (event.code === 'KeyP' || event.code === 'Escape')) setPause(!paused);
    if (!event.repeat && event.code === 'KeyF') interactPlayer();
    if (!event.repeat && event.code === 'KeyE' && game.phase === 'playing' && !paused) droneRequested = true;
    if (!event.repeat && event.code === 'KeyR' && game.phase === 'playing' && !paused) reloadRequested = true;
    if (!event.repeat && event.code === 'KeyZ' && game.phase === 'playing' && !paused) bandageRequested = true;
    if (!event.repeat && event.code === 'KeyG' && game.phase === 'playing' && !paused) secondaryRequested = true;
    if (game.phase === 'playing' && !paused && event.target.tagName !== 'BUTTON') keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { clearInput(); radio.stop(); setPause(true); });
  window.addEventListener('pagehide', () => radio.stop());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); radio.stop(); setPause(true); } });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pointer.x = event.clientX / window.innerWidth * 2 - 1;
    pointer.y = -event.clientY / window.innerHeight * 2 + 1;
    pointerAim = true;
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') return;
    if (event.button === 2 && game.phase === 'playing' && !paused) { secondaryRequested = true; initAudio(); }
    if (event.button === 0 && game.phase === 'playing' && !paused) {
      mouseFire = true;
      canvas.setPointerCapture(event.pointerId);
      initAudio();
    }
  });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  window.addEventListener('pointerup', event => { if (event.button === 0) mouseFire = false; });
  canvas.addEventListener('pointercancel', () => { mouseFire = false; });
  document.querySelectorAll('[data-move], #touch-fire, #touch-boost').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (paused || game.phase !== 'playing') return;
      initAudio();
      pointerAim = false;
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, button.dataset.move || (button.id === 'touch-boost' ? 'boost' : 'fire'));
      button.classList.add('pressed');
    });
    const release = event => { pointers.delete(event.pointerId); button.classList.remove('pressed'); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });
  $('touch-interact').addEventListener('click', interactPlayer);
  $('touch-drone').addEventListener('click', () => {
    if (game.phase === 'playing' && !paused) { droneRequested = true; initAudio(); }
    canvas.focus({ preventScroll: true });
  });
  $('touch-grenade').addEventListener('click', () => {
    if (game.phase === 'playing' && !paused) { secondaryRequested = true; pointerAim = false; initAudio(); }
    canvas.focus({ preventScroll: true });
  });
  $('touch-reload').addEventListener('click', () => {
    if (game.phase === 'playing' && !paused) { reloadRequested = true; initAudio(); }
    canvas.focus({ preventScroll: true });
  });
  $('touch-bandage').addEventListener('click', () => {
    if (game.phase === 'playing' && !paused) bandageRequested = true;
    canvas.focus({ preventScroll: true });
  });

  function readInput() {
    const touch = new Set(pointers.values());
    input.moveX = Number(keys.has('KeyD') || keys.has('ArrowRight') || touch.has('right')) - Number(keys.has('KeyA') || keys.has('ArrowLeft') || touch.has('left'));
    input.moveZ = Number(keys.has('KeyS') || keys.has('ArrowDown') || touch.has('down')) - Number(keys.has('KeyW') || keys.has('ArrowUp') || touch.has('up'));
    input.fire = mouseFire || keys.has('Space') || touch.has('fire');
    input.throwGrenade = secondaryRequested && game.player.tankId == null;
    input.fireMissile = secondaryRequested && game.player.tankId != null;
    input.deployDrone = droneRequested;
    input.reload = reloadRequested;
    input.bandage = bandageRequested;
    input.boost = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.has('boost');
    input.aimX = input.aimZ = null;
    if (pointerAim) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(groundPlane, aimPoint)) {
        input.aimX = aimPoint.x;
        input.aimZ = aimPoint.z;
      }
    } else if (touch.has('fire') || secondaryRequested) {
      const player = playerActor(game);
      const targets = [...game.tanks.filter(t => t.team === 'enemy' && t.occupied && !t.dead), ...game.enemies.filter(e => !e.dead), ...game.enemyBases.filter(base => !base.dead)];
      targets.sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
      if (targets[0]) { input.aimX = targets[0].x; input.aimZ = targets[0].z; }
    }
    aimMarker.visible = pointerAim && game.phase === 'playing' && !paused;
    if (input.aimX != null) aimMarker.position.set(input.aimX, 0.08, input.aimZ);
  }
  function burst(x, z, count, explosive, height = explosive ? 0.8 : 0.6, material = null) {
    for (let i = 0; i < count && particles.length < 220; i++) {
      const mesh = new THREE.Mesh(particleGeometry, material || fxMaterials[i % fxMaterials.length]);
      mesh.position.set(x, height, z);
      const scale = explosive ? 1 + Math.random() * 3 : 0.5 + Math.random();
      mesh.scale.setScalar(scale);
      world.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      const speed = (explosive ? 5 : 2) * Math.random();
      particles.push({ mesh, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, vy: 2 + Math.random() * 4, life: explosive ? 0.8 : 0.3, max: explosive ? 0.8 : 0.3, scale });
    }
  }
  function bloodSpray() {
    bloodLife = 0.85;
    hitRed = Math.max(hitRed, 0.18);
    bloodDrops.forEach((drop, i) => {
      const size = 8 + Math.random() * 24;
      drop.style.left = `${i % 2 ? 83 + Math.random() * 12 : 3 + Math.random() * 12}%`;
      drop.style.top = `${10 + Math.random() * 75}%`;
      drop.style.width = `${size}px`;
      drop.style.height = `${size * 1.35}px`;
      drop.style.transform = `rotate(${Math.random() * 100 - 50}deg)`;
    });
  }
  function shatter(key, make, event) {
    // 碎片沿用原模型幾何與材質；每次最多 40 塊，總粒子數仍有上限。
    while (particles.length > 150) world.remove(particles.shift().mesh);
    const model = visuals.get(key) || make();
    model.position.set(event.x, event.kind === 'drone' ? 1.5 : 0, event.z);
    model.rotation.y = event.angle || 0;
    model.updateWorldMatrix(true, true);
    let count = 0;
    model.visible = true;
    model.traverseVisible(part => {
      if (!part.isMesh || part.isInstancedMesh || !part.visible || count++ >= 40) return;
      const fragment = new THREE.Mesh(part.geometry, part.material);
      part.matrixWorld.decompose(fragment.position, fragment.quaternion, fragment.scale);
      const angle = Math.random() * Math.PI * 2, speed = (2 + Math.random() * 5) * (event.boss ? 1.6 : 1);
      world.add(fragment);
      particles.push({ mesh: fragment, baseScale: fragment.scale.clone(), vx: Math.sin(angle) * speed,
        vz: Math.cos(angle) * speed, vy: 3 + Math.random() * 6, life: 1.6, max: 1.6,
        spinX: (Math.random() - 0.5) * 18, spinY: (Math.random() - 0.5) * 18 });
    });
    if (!visuals.has(key)) removeVisual(model);
  }
  function effects() {
    let taunt = '', baseSupply = false;
    for (const event of game.events) {
      if (event.type === 'explosion' && event.cause !== 'crush') {
        if (event.kind === 'tank') {
          const tank = game.tanks.find(t => t.id === event.targetId);
          shatter(`t${event.targetId}`, () => models.tankModel(event.team, tank?.kind), event);
        }
        if (event.kind === 'drone') { shatter(`d${event.targetId}`, models.droneModel, event); toast('無人機損失 · 有備用套件可按 E 再出動'); }
        burst(event.x, event.z, event.boss ? 80 : event.kind === 'tank' ? 36 : 22, true, event.kind === 'drone' ? 1.5 : 0.8);
        if (event.kind === 'boss' || event.boss) {
          const ring = new THREE.Mesh(warningRing, warningMaterial);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(event.x, 0.12, event.z);
          world.add(ring);
          particles.push({ mesh: ring, ring: true, life: 0.45, max: 0.45, scale: event.size || 2 });
          shake = Math.max(shake, event.boss ? 0.5 : 0.12);
        }
        sound('explosion');
      }
      if (event.type === 'hit' && event.cause !== 'bleeding' && event.cause !== 'crush') {
        burst(event.x, event.z, 5, false, event.kind === 'drone' ? 1.5 : 0.6);
        if (event.targetTeam === 'player' && (event.kind === 'player' || event.kind === 'tank')) {
          impact((event.kind === 'tank' ? 0.3 : 0.55) + Math.min(0.3, (event.damage || 0) / 100));
        }
      }
      if (event.type === 'crush') {
        burst(event.x, event.z, 10, false, 0.15, bloodMaterial);
        sound('explosion');
        if (event.targetTeam === 'player') {
          bloodSpray();
          impact(0.9);
          toast('遭到碾壓！扣除 80% 最大生命', 2);
        } else if (event.sourceTeam === 'player') toast(event.dead ? '碾壓擊倒' : '碾壓命中 · 扣除 80% 最大生命', 1.2);
        if (event.dead && particles.length < 220) {
          const body = models.soldierModel(event.targetTeam);
          body.position.set(event.x, 0.025, event.z);
          body.rotation.y = event.angle || 0;
          body.scale.set(1.5, 0.12, 1.25);
          world.add(body);
          particles.push({ mesh: body, flattened: true, life: 1.2, max: 1.2 });
        }
      }
      if (event.type === 'bleed-start' || event.type === 'bleed-tick') {
        burst(event.x, event.z, event.type === 'bleed-start' ? 8 : 4, false, 0.8, bloodMaterial);
        if (event.team === 'player') {
          bloodSpray();
          if (event.type === 'bleed-start') toast('正在流血 · 持續失血、移速降低，按 Z 包紮', 3);
        }
      }
      if (event.team === 'player') {
        if (event.type === 'reload') { sound('empty'); toast('換彈中 · 完成後鬆開再按射擊', 1.5); }
        if (event.type === 'reload-ready') sound('pickup');
        if (event.type === 'bandage-start') toast('包紮中 · 1.5 秒內無法攻擊', 1.5);
        if (event.type === 'bandage-complete') { toast('已止血 · 留意剩餘生命'); sound('pickup'); }
      }
      if (event.type === 'death' && event.team === 'player') {
        shatter('splayer', () => models.soldierModel('player'), event);
        burst(event.x, event.z, 64, true);
        sound('explosion');
        impact(0.95);
        resultDelay = 1.05;
        clearInput();
        document.body.dataset.state = 'dying';
      }
      if (event.type === 'shot') { burst(event.x, event.z, 2, false, event.kind === 'drone' ? 1.5 : 0.6); sound(event.kind === 'drone' ? 'bullet' : event.kind || 'bullet', event.team === 'player' ? event.ammoRemaining ?? null : null); }
      if (event.type === 'deploy' && event.kind === 'drone') { toast('無人機出擊 · 主動追擊敵軍，小心誤傷'); sound('pickup'); }
      if (event.type === 'fatigue') toast('急跑結束 · 喘息中，走速降低 30%', 2.4);
      if (event.type === 'empty' && event.team === 'player') { sound('empty'); toast(event.kind === 'missile' ? '追蹤彈已空 · 尋找黃色飛彈補給' : '主砲已空 · 可用追蹤彈，或跳車奪車'); }
      if (event.type === 'grenade') sound('grenade');
      if (event.type === 'boss-arrival') { toast('重裝魔王「毀城者」出擊 · 小心砲擊預警！', 4); sound('warning'); }
      if (event.type === 'boss-charge') sound('warning');
      if (event.type === 'boss-rage') { toast('魔王進入狂暴 · 攻擊間隔縮短！', 3); sound('warning'); }
      if (event.type === 'boss-defeated') toast('攻城魔王擊破！清除殘兵，守住基地', 4);
      if (event.type === 'eject' && event.team === 'enemy') toast(event.remainingCrew > 0 ? '敵軍下車增援 · 車內仍有駕駛！' : '敵軍棄車！小心步兵，也能搶下空車');
      if (event.type === 'base-supply') {
        baseSupply = true;
        toast(`基地補給：${{ ammo: '武器箱', drone: '無人機組', missile: '追蹤彈' }[event.kind]} · 已空投附近`, 4);
        sound('pickup');
      }
      if (event.type === 'pickup') {
        const ammo = [event.ammoAdded ? `主砲 +${event.ammoAdded}` : '', event.grenadesAdded ? `榴彈 +${event.grenadesAdded}` : ''].filter(Boolean).join(' / ');
        toast(event.kind === 'ammo' ? `武器補給 · ${ammo}` : event.kind === 'missile' ? `追蹤彈 +${event.amount} · 右鍵 / G 發射` : event.kind === 'drone' ? '取得無人機組 · E 出動，最多同時兩組' : '維修補給 · 裝甲與生命恢復');
        sound('pickup');
      }
      if (event.type === 'message' && event.text) toast(event.text);
      if (event.type === 'eject' && event.team === 'enemy') taunt = 'eject';
      else if (!taunt && event.type === 'hit' && event.kind === 'base' && event.targetTeam === 'player') taunt = 'baseHit';
      else if (!taunt && event.type === 'hit' && event.targetTeam === 'enemy' && event.sourceTeam === 'player') taunt = 'hurt';
      else if (!taunt && event.type === 'eject' && event.team === 'player') taunt = 'playerExit';
    }
    if (baseSupply) radio.say('baseSupply', { force: true });
    else if (taunt) radio.say(taunt);
    if (game.phase === 'playing' && game.player.tankId === null && game.player.fatigueTime > 0 && game.time >= nextBreath) {
      sound('breath'); nextBreath = game.time + 0.8;
    }
    if (game.phase === 'playing' && game.time >= nextChatter) {
      nextChatter = game.time + 10 + Math.random() * 6;
      const player = playerActor(game);
      const enemies = [...game.tanks.filter(t => t.team === 'enemy' && t.occupied && !t.dead), ...game.enemies.filter(e => !e.dead)];
      if (enemies.some(enemy => Math.hypot(enemy.x - player.x, enemy.z - player.z) < 13)) radio.say('chase');
    }
  }
  function syncVisuals(dt) {
    const alive = new Set();
    function sync(key, entity, make) {
      if (entity.dead) return;
      alive.add(key);
      let mesh = visuals.get(key);
      if (!mesh) { mesh = make(); visuals.set(key, mesh); world.add(mesh); }
      mesh.position.x = entity.x;
      mesh.position.z = entity.z;
      return mesh;
    }
    for (const wall of game.walls) {
      const mesh = sync(`w${wall.id}`, wall, () => models.wallModel(wall));
      if (mesh && wall.kind === 'brick') mesh.scale.y = 0.6 + 0.4 * wall.hp / wall.maxHp;
    }
    for (const enemyBase of game.enemyBases) {
      const mesh = sync(`hq${enemyBase.id}`, enemyBase, () => models.baseModel('enemy'));
      if (mesh) mesh.scale.y = 0.75 + 0.25 * enemyBase.hp / enemyBase.maxHp;
    }
    for (const tank of game.tanks) {
      const key = `t${tank.id}`;
      const team = tank.occupied ? tank.team : 'neutral';
      if (visuals.has(key) && visuals.get(key).userData.team !== team) { removeVisual(visuals.get(key)); visuals.delete(key); }
      const mesh = sync(key, tank, () => models.tankModel(team, tank.kind));
      if (!mesh) continue;
      mesh.rotation.y = tank.angle;
      if (mesh.userData.turret) mesh.userData.turret.rotation.y = (tank.turretAngle ?? tank.angle) - tank.angle;
      mesh.userData.crewMarkers?.forEach((marker, i) => { marker.visible = i < tank.crew; });
      if (mesh.userData.core) mesh.userData.core.scale.setScalar(reducedMotion.matches ? 1 : 1 + Math.sin(game.time * (tank.enraged ? 12 : 5)) * 0.12);
      if (tank.kind === 'boss' && tank.attack === 'fan' && game.phase === 'playing') {
        const fan = sync(`fan${tank.id}`, tank, () => {
          const group = new THREE.Group();
          for (let i = -2; i <= 2; i++) {
            const ray = new THREE.Mesh(warningLine, warningMaterial);
            ray.rotation.y = i * 0.17;
            group.add(ray);
          }
          return group;
        });
        fan.rotation.y = tank.attackAngle;
        fan.children.forEach(ray => {
          const spread = ray.rotation.y;
          const dx = Math.sin(tank.attackAngle + spread), dz = Math.cos(tank.attackAngle + spread);
          const reach = Math.min(42, Math.abs(dx) < 0.001 ? 42 : (Math.sign(dx) * 14.8 - tank.x) / dx,
            Math.abs(dz) < 0.001 ? 42 : (Math.sign(dz) * 14.8 - tank.z) / dz);
          ray.position.set(Math.sin(spread) * reach / 2, 0.1, Math.cos(spread) * reach / 2);
          ray.scale.z = reach;
        });
      }
      if (!tank.occupied) mesh.position.y = 0;
    }
    const soldiers = [...game.enemies];
    if (game.player.tankId == null && !game.player.dead) soldiers.push({ ...game.player, id: 'player', team: 'player' });
    for (const soldier of soldiers) {
      const mesh = sync(`s${soldier.id}`, soldier, () => models.soldierModel(soldier.team || 'enemy'));
      if (!mesh) continue;
      const flattened = Math.min(1, (soldier.crushTime || 0) / 0.22);
      mesh.scale.set(1 + flattened * 0.5, 1 - flattened * 0.88, 1 + flattened * 0.25);
      mesh.rotation.y = soldier.angle;
      const moving = mesh.userData.lastX != null && Math.hypot(soldier.x - mesh.userData.lastX, soldier.z - mesh.userData.lastZ) > 0.003;
      mesh.userData.legs?.forEach((leg, i) => { leg.rotation.x = moving && !flattened ? Math.sin(game.time * 16 + i * Math.PI) * 0.5 : 0; });
      mesh.userData.lastX = soldier.x;
      mesh.userData.lastZ = soldier.z;
      mesh.userData.bandageMarker.visible = soldier.bandageTime > 0;
      mesh.userData.bleedMarker.visible = soldier.bleeding && soldier.bandageTime <= 0;
      mesh.visible = soldier.id !== 'player' || game.player.invulnerable <= 0 || Math.floor(game.time * 12) % 2 === 0;
    }
    for (const drone of game.drones) {
      const mesh = sync(`d${drone.id}`, drone, models.droneModel);
      if (!mesh) continue;
      mesh.position.y = 1.5 + (reducedMotion.matches ? 0 : Math.sin(game.time * 4 + drone.id) * 0.08);
      mesh.rotation.y = drone.angle;
      mesh.userData.rotors?.forEach((rotor, i) => { rotor.rotation.y += dt * (i % 2 ? 65 : -65); });
    }
    const playerVehicle = game.tanks.find(t => t.id === game.player.tankId && !t.dead);
    if (game.phase === 'playing' && (playerVehicle?.boosting || (!playerVehicle && game.player.sprintTime > 0))) {
      const actor = playerVehicle || game.player;
      const exhaust = sync('boost', actor, () => {
        const group = new THREE.Group();
        for (const x of [-0.42, 0.42]) {
          const flame = new THREE.Mesh(exhaustGeometry, supportMaterial);
          flame.rotation.x = -Math.PI / 2;
          flame.position.set(x, 0.3, -1.15);
          group.add(flame);
        }
        return group;
      });
      exhaust.rotation.y = playerVehicle ? playerVehicle.angle : Math.atan2(input.moveX, input.moveZ);
      exhaust.scale.setScalar(playerVehicle ? 1 : 0.5);
      exhaust.children.forEach(flame => { flame.scale.y = reducedMotion.matches ? 1 : 1 + Math.sin(game.time * 35) * 0.2; });
    }
    for (const bullet of game.bullets) {
      const missile = bullet.kind === 'missile';
      const mesh = sync(`b${bullet.id}`, bullet, () => missile ? models.missileModel() : new THREE.Mesh(bulletGeometry, bullet.kind === 'drone' ? supportMaterial : bulletMaterials[bullet.team] || bulletMaterials.enemy));
      if (mesh) {
        mesh.position.y = bullet.kind === 'drone' ? 1.5 : missile ? 0.8 : 0.65;
        if (!missile) mesh.scale.set(1, 1, bullet.kind === 'shell' ? 5 : 2.8);
        mesh.rotation.y = Math.atan2(bullet.dx, bullet.dz);
        if (missile && dt > 0 && !reducedMotion.matches && game.time >= (mesh.userData.nextTrail || 0)) {
          burst(bullet.x, bullet.z, 1, false, 0.75, missileMaterial);
          mesh.userData.nextTrail = game.time + 0.055;
        }
      }
      if (missile && bullet.targetId != null) {
        const targets = bullet.targetKind === 'tank' ? game.tanks : bullet.targetKind === 'infantry' ? game.enemies : game.enemyBases;
        const target = targets.find(t => t.id === bullet.targetId && !t.dead);
        if (target) {
          const marker = sync(`lock${bullet.id}`, target, () => {
            const ring = new THREE.Mesh(warningRing, missileMaterial);
            ring.rotation.x = -Math.PI / 2;
            return ring;
          });
          marker.position.y = 0.09;
          marker.scale.setScalar(target.kind === 'boss' ? 1.6 : bullet.targetKind === 'infantry' ? 0.6 : 1.15);
        }
      }
    }
    for (const grenade of game.grenades) {
      const mesh = sync(`g${grenade.id}`, grenade, () => models.grenadeModel());
      if (mesh) {
        mesh.position.y = 0.6 + Math.sin(Math.PI * Math.min(1, grenade.age / grenade.fuse)) * 3;
        mesh.rotation.set(grenade.age * 9, grenade.age * 5, 0);
      }
    }
    for (const pickup of game.pickups || []) {
      const mesh = sync(`p${pickup.id}`, pickup, () => models.pickupModel(pickup.kind, pickup.origin === 'base'));
      if (mesh) {
        mesh.position.y = (pickup.dropTime || 0) * 6 + (reducedMotion.matches ? 0 : Math.sin(game.time * 3) * 0.07);
        if (mesh.userData.parachute) mesh.userData.parachute.visible = pickup.dropTime > 0;
      }
    }
    for (const hazard of game.phase === 'playing' ? game.hazards : []) {
      const mesh = sync(`hazard${hazard.id}`, hazard, () => {
        const group = new THREE.Group();
        const ring = new THREE.Mesh(warningRing, warningMaterial);
        const fill = new THREE.Mesh(warningDisc, warningFill);
        for (const part of [ring, fill]) { part.rotation.x = -Math.PI / 2; part.position.y = 0.11; group.add(part); }
        const shell = new THREE.Mesh(bulletGeometry, bulletMaterials.enemy);
        shell.scale.set(2.5, 7, 2.5);
        group.add(shell);
        group.userData.fill = fill;
        group.userData.shell = shell;
        ring.scale.setScalar(hazard.radius);
        return group;
      });
      const progress = Math.min(1, hazard.age / hazard.fuse);
      mesh.userData.fill.scale.setScalar(hazard.radius * (0.15 + 0.85 * progress));
      mesh.userData.shell.visible = hazard.fuse - hazard.age < 0.65;
      mesh.userData.shell.position.y = 0.5 + Math.max(0, hazard.fuse - hazard.age) * 14;
    }
    for (const [key, mesh] of visuals) if (!alive.has(key)) { removeVisual(mesh); visuals.delete(key); }
    const actor = playerActor(game);
    selection.position.set(actor.x, 0.055, actor.z);
    selection.scale.setScalar(game.player.tankId == null ? 0.5 : 1);
    selection.visible = game.phase !== 'lost';
    base.scale.y = game.base.hp <= 0 ? 0.3 : 1;
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= dt;
      if (particle.life <= 0) { world.remove(particle.mesh); particles.splice(i, 1); continue; }
      if (particle.ring) { particle.mesh.scale.setScalar(particle.scale * (1 - particle.life / particle.max)); continue; }
      if (particle.flattened) { particle.mesh.scale.set(1.5, 0.12, 1.25).multiplyScalar(Math.min(1, particle.life / 0.25)); continue; }
      particle.mesh.position.x += particle.vx * dt;
      particle.mesh.position.z += particle.vz * dt;
      particle.mesh.position.y += particle.vy * dt;
      particle.vy -= 12 * dt;
      if (particle.mesh.position.y < 0.08) {
        particle.mesh.position.y = 0.08;
        particle.vy = Math.abs(particle.vy) * 0.25;
        particle.vx *= 0.7; particle.vz *= 0.7;
      }
      particle.mesh.rotation.x += dt * (particle.spinX ?? 3);
      particle.mesh.rotation.y += dt * (particle.spinY || 0);
      if (particle.baseScale) particle.mesh.scale.copy(particle.baseScale).multiplyScalar(Math.min(1, particle.life / 0.35));
      else particle.mesh.scale.setScalar(particle.scale * particle.life / particle.max);
    }
  }
  function updateHud(now) {
    if (now - lastHud < 80) return;
    lastHud = now;
    const tank = game.tanks.find(t => t.id === game.player.tankId && !t.dead);
    const boss = game.tanks.find(t => t.kind === 'boss' && t.team === 'enemy' && !t.dead);
    const showBoss = !!boss && game.phase === 'playing' && !paused;
    $('boss-status').hidden = !showBoss;
    document.body.dataset.boss = String(showBoss);
    if (showBoss) {
      $('boss-status').dataset.enraged = String(boss.enraged);
      $('boss-name').textContent = boss.bossName;
      $('boss-state').textContent = (boss.enraged ? '狂暴 · ' : '') + (attackNames[boss.attack] || (game.hazards.length ? '砲彈來襲 · 離開紅圈' : '火力重整 · 趁機反擊'));
      $('boss-hp').max = boss.maxHp;
      $('boss-hp').value = boss.hp;
      $('boss-hp-label').textContent = `${Math.ceil(boss.hp)} / ${boss.maxHp}`;
    }
    ui.score.textContent = String(game.score).padStart(5, '0');
    ui.wave.textContent = `${String(game.wave).padStart(2, '0')} / ${String(game.level.waves.length).padStart(2, '0')}`;
    ui.remaining.textContent = game.tanks.filter(t => t.team === 'enemy' && t.occupied && !t.dead).length + game.enemies.filter(e => !e.dead).length + game.spawnsPending;
    ui.mode.textContent = tank ? tank.kind === 'apc' ? '運兵車 / 無武裝' : '裝甲 / 主砲＋飛彈' : '步兵 / 步槍＋榴彈';
    $('enemy-base-count').textContent = `敵基地 ${game.enemyBases.filter(base => !base.dead).length} / ${game.enemyBases.length} · 全毀即勝`;
    const reloading = !tank && game.player.reloadTime > 0;
    const bandaging = game.player.bandageTime > 0;
    const fireLocked = !tank && game.player.fireLocked;
    $('weapon-label').textContent = tank ? '主砲彈藥' : reloading ? '換彈中' : fireLocked ? '鬆開再射' : '步槍彈匣';
    $('ammo-count').textContent = tank ? tank.kind === 'apc' ? '無主砲' : `${tank.ammo} / ${tank.maxAmmo}` : reloading ? `${game.player.reloadTime.toFixed(1)}s` : `${game.player.rifleAmmo} / 25`;
    $('weapon-status').dataset.low = String(tank ? tank.kind !== 'apc' && tank.ammo <= 5 : game.player.rifleAmmo <= 5);
    $('grenades-count').hidden = !!tank;
    $('grenades-count').textContent = `榴彈 ${game.player.grenades}`;
    $('missile-count').hidden = !tank || tank.maxMissiles === 0;
    $('missile-count').textContent = tank ? `追蹤 ${tank.missiles}/8` : '';
    $('missile-count').dataset.empty = String(tank?.missiles === 0);
    $('wound-status').hidden = !game.player.bleeding && !bandaging;
    $('wound-label').textContent = bandaging ? '包紮中 · 無法攻擊' : '流血 · Z 包紮';
    $('bandage-progress').hidden = !bandaging;
    $('bandage-progress').value = bandaging ? 1.5 - game.player.bandageTime : 0;
    $('touch-bandage').disabled = !game.player.bleeding || bandaging;
    $('touch-bandage').textContent = bandaging ? `${game.player.bandageTime.toFixed(1)}s` : '包紮';
    $('touch-reload').hidden = !!tank;
    $('touch-reload').disabled = reloading || bandaging || game.player.rifleAmmo >= 25;
    $('touch-reload').textContent = reloading ? '換彈中' : '換彈';
    // 保留按住的 pointer capture，換彈完成仍須真的鬆開再按。
    $('touch-fire').firstChild.textContent = bandaging ? '包紮中' : reloading ? '換彈中' : fireLocked ? '先鬆開' : '開火';
    $('touch-grenade').hidden = !!tank && tank.maxMissiles === 0;
    $('touch-grenade').disabled = bandaging || (tank ? tank.missiles <= 0 || tank.missileCooldown > 0 : game.player.grenades <= 0);
    $('touch-grenade').textContent = tank ? `飛彈 ${tank.missiles}` : `榴彈 ${game.player.grenades}`;
    $('touch-grenade').setAttribute('aria-label', tank ? `發射追蹤彈，剩餘 ${tank.missiles} 發` : `投擲手榴彈，剩餘 ${game.player.grenades} 顆`);
    const fatigue = !tank && game.player.fatigueTime > 0;
    const sprinting = !tank && game.player.sprintTime > 0;
    $('boost-label').textContent = tank ? '氮氣' : fatigue ? '喘息 −30%' : sprinting ? '急跑中' : '急跑';
    $('boost-meter').max = 100;
    $('boost-meter').value = tank ? tank.nitro / tank.maxNitro * 100 : fatigue ? (1 - game.player.fatigueTime / 2.4) * 100 : sprinting ? game.player.sprintTime / 1.2 * 100 : 100;
    $('boost-value').textContent = tank ? `${Math.floor(tank.nitro)}%` : fatigue ? `${game.player.fatigueTime.toFixed(1)}s` : sprinting ? `${game.player.sprintTime.toFixed(1)}s` : 'Shift';
    $('boost-status').dataset.empty = String(fatigue || !!tank && tank.nitro <= 0);
    $('touch-boost').textContent = tank ? '氮氣' : fatigue ? '喘息中' : '急跑';
    $('touch-boost').setAttribute('aria-label', tank ? '按住氮氣加速' : fatigue ? '喘息中，走速降低百分之三十' : '按住短暫急跑');
    const droneCount = game.drones.filter(d => !d.dead).length;
    $('drone-count').textContent = `${droneCount} / 2`;
    $('drone-kits').textContent = `備用 ${game.player.droneKits}`;
    $('drone-status').dataset.empty = String(game.player.droneKits === 0);
    $('touch-drone').textContent = '無人機';
    $('touch-drone').disabled = bandaging || game.player.droneKits === 0 || droneCount >= 2;
    for (const [name, hp, max] of [['player', game.player.hp, game.player.maxHp], ['tank', tank?.hp || 0, tank?.maxHp || 100], ['base', game.base.hp, game.base.maxHp]]) {
      ui[`${name}-hp`].max = max;
      ui[`${name}-hp`].value = Math.max(0, hp);
      ui[`${name}-hp-label`].textContent = `${Math.max(0, Math.ceil(hp * 100 / max))}%`;
    }
    ui['tank-status'].hidden = !tank;
    const nearby = !tank && game.tanks.some(t => !t.dead && !t.occupied && Math.hypot(t.x - game.player.x, t.z - game.player.z) < 2.8);
    ui['interaction-hint'].textContent = game.phase !== 'playing' || paused ? '' : bandaging ? '正在包紮 · 暫時無法攻擊' : game.player.bleeding ? 'Z 包紮止血 · 不治療會持續失血' : reloading ? '步槍換彈中 · 完成後鬆開再按射擊' : fireLocked ? '鬆開射擊鍵，再按一次開火' : tank ? tank.kind === 'apc' ? 'F 下車作戰 · E 無人機 · Shift 氮氣' : '右鍵 / G 追蹤彈 · F 跳車 · Shift 氮氣' : nearby ? 'F 接管空車 · R 換彈 · E 無人機' : 'R 換彈 · Z 包紮 · 右鍵 / G 榴彈';
    if ($('touch-interact')) $('touch-interact').textContent = tank ? '下車' : '上車';
    if (now > toastUntil) ui.toast.classList.remove('visible');
  }
  function checkPhase() {
    if (game.phase === 'lost' && resultDelay > 0) return;
    if (game.wave !== lastWave) {
      lastWave = game.wave;
      const boss = game.tanks.some(t => t.kind === 'boss' && !t.dead);
      toast(boss ? '重裝魔王「毀城者」出擊 · 注意紅色預警！' : `第 ${game.wave} 波來襲 · 守住基地`, boss ? 4 : 3);
      radio.say('wave', { force: true });
    }
    if (lastPhase === game.phase) return;
    lastPhase = game.phase;
    if (game.phase === 'won' || game.phase === 'lost') {
      clearInput();
      const won = game.phase === 'won';
      if (won) {
        if (!progress.cleared.includes(game.level.id)) progress.cleared.push(game.level.id);
        progress.level = nextLevel();
        saveProgress();
      }
      radio.say(won ? 'win' : 'lose', { force: true });
      const title = won ? progress.cleared.length === LEVELS.length ? '全戰役制霸' : game.level.id === LEVELS.length ? '終章突破' : '關卡突破' : game.base.hp <= 0 ? '基地失守' : '下次再突圍';
      showOverlay(won ? `STAGE ${String(game.level.id).padStart(2, '0')} CLEAR` : 'MISSION FAILED', title, `${game.level.name} · 本關得分 ${game.score} · 擊破 ${game.kills} 個目標。${won ? '基地與裝甲補給完畢，準備前往下一戰區。' : '利用掩體、跳車求生，再試一次。'}`, won ? `前往第 ${nextLevel()} 關 →` : '重試本關 →');
    }
  }
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    clearInput();
    radio.stop();
    resetImpact();
    paused = true;
    showOverlay('RENDERER INTERRUPTED', '畫面暫時中斷', '圖形資源中斷，恢復後會重新載入戰場。', '重新載入');
    ui['start-button'].onclick = () => location.reload();
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  // 只輸出可序列化狀態，讓瀏覽器驗證不依賴畫面像素猜測。
  window.render_game_to_text = () => JSON.stringify({ phase: game.phase, paused, level: { id: game.level.id, name: game.level.name, theme: game.level.theme }, cleared: progress.cleared.length, wave: game.wave, score: game.score, player: game.player, tanks: game.tanks.filter(t => !t.dead), enemies: game.enemies.filter(e => !e.dead), base: game.base, enemyBases: game.enemyBases, grenades: game.grenades.length, pending: game.spawnsPending, drones: game.drones.filter(d => !d.dead), pickups: game.pickups.filter(p => !p.dead), hazards: game.hazards, bullets: game.bullets.length, rifleBullets: game.bullets.filter(b => b.kind === 'bullet'), missiles: game.bullets.filter(b => b.kind === 'missile'), walls: game.walls.filter(w => !w.dead).length, feedback: { red: hitRed, blood: bloodLife, shake: reducedMotion.matches ? 0 : shake, fragments: particles.filter(p => p.baseScale).length, resultDelay }, renderer: { calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries } });
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    readInput();
    if (!paused && game.phase === 'playing') { step(game, input, dt); secondaryRequested = droneRequested = reloadRequested = bandageRequested = false; effects(); }
    syncVisuals(paused ? 0 : dt);
    updateImpact(paused ? 0 : dt);
    resultDelay = Math.max(0, resultDelay - dt);
    updateHud(now);
    checkPhase();
    renderer.render(scene, camera);
  }
  syncVisuals(0);
  ui.loading.hidden = true;
  ui['start-button'].disabled = false;
  updateLevelInfo();
  ui['start-button'].textContent = `出擊第 ${game.level.id} 關 →`;
  requestAnimationFrame(frame);
}

boot().catch(error => {
  console.error('Tank boot failed:', error);
  ui.loading.hidden = false;
  ui.loading.textContent = '無法啟動 3D 畫面，請確認瀏覽器已開啟硬體加速後重試。';
  ui['start-button'].disabled = false;
  ui['start-button'].textContent = '重新載入';
  ui['start-button'].onclick = () => location.reload();
});
