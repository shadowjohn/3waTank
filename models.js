import * as THREE from '/inc/javascript/three.js/three.js/build/three.module.js';

// 幾何與材質全場共用；移除角色時只移除場景節點。
const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const sphere = new THREE.IcosahedronGeometry(0.5, 0);
const cone = new THREE.ConeGeometry(0.5, 1, 6);
const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const mat = {
  track: material('#273c37'), rubber: material('#1e302b'), rim: material('#6f7b65'),
  player: material('#5fbd98'), playerDark: material('#2a6a58'), playerLight: material('#b0e4bf'),
  enemy: material('#da7d58'), enemyDark: material('#934d39'), enemyLight: material('#ffc793'),
  neutral: material('#687b84'), neutralDark: material('#3e515b'), neutralLight: material('#a2b4ba'),
  cream: material('#f8eccb'), skin: material('#eac899'), gun: material('#33443c'),
  mortar: material('#302b2e'), brick: material('#684e49'), brickLight: material('#896459'),
  steel: material('#466275', { metalness: 0.35 }), metal: material('#708b9b', { metalness: 0.45 }),
  water: material('#173f51', { roughness: 0.35, metalness: 0.12 }), ripple: material('#4c8799'),
  board: material('#243546'), edge: material('#0f171f'), soil: material('#1b2831'),
  ground: material('#1a2935'), patch: material('#213442'), line: material('#365368'),
  grass: material('#2d4951'), tree: material('#294c43'), treeLight: material('#426b56'),
  trunk: material('#423d32'), rock: material('#455a67'), gold: material('#e9bd65', { metalness: 0.2 }),
  flag: material('#4b9080', { side: THREE.DoubleSide }),
  enemyFlag: material('#c64545', { side: THREE.DoubleSide }),
  accent: material('#839095'), cap: material('#657582'),
  glow: material('#795138', { emissive: '#a66b35', emissiveIntensity: 0.35 }),
  bossArmor: material('#354351', { metalness: 0.3 }), bossRed: material('#923b3c', { metalness: 0.2 }),
  bossCore: material('#ff8550', { emissive: '#ff3922', emissiveIntensity: 1.4 }),
  droneLight: material('#67eced', { emissive: '#20aecc', emissiveIntensity: 0.65 }),
};

const environmentKeys = ['mortar', 'brick', 'brickLight', 'steel', 'metal', 'water', 'ripple', 'board', 'edge', 'soil', 'ground', 'patch', 'line', 'grass', 'tree', 'treeLight', 'trunk', 'rock', 'accent', 'cap'];
const urbanColors = Object.fromEntries(environmentKeys.map(key => [key, `#${mat[key].color.getHexString()}`]));
const themes = {
  urban: { background: '#0b1118', ambient: '#c8ddff', sun: '#d7e6ff', colors: {} },
  forest: { background: '#081510', ambient: '#b4d5c8', sun: '#c8dfb9', colors: {
    ground: '#182d26', patch: '#213c2c', grass: '#3b533c', board: '#243d32', soil: '#233127', line: '#41624e',
    tree: '#23513b', treeLight: '#3e7550', trunk: '#4d4030', rock: '#405446', brick: '#65573e', brickLight: '#807251', water: '#143a35' } },
  desert: { background: '#17100e', ambient: '#cbbbac', sun: '#f2ce9d', colors: {
    ground: '#403025', patch: '#493626', grass: '#4e4630', board: '#46372e', soil: '#3a2c25', line: '#78634b',
    tree: '#4b6040', treeLight: '#6f784c', trunk: '#6e573e', rock: '#786048', brick: '#76523b', brickLight: '#986b44', water: '#294b4a', accent: '#967c56' } },
  snow: { background: '#0b1222', ambient: '#b9d6ff', sun: '#d5e8ff', colors: {
    ground: '#24394d', patch: '#304a60', grass: '#446277', board: '#263749', soil: '#354657', line: '#5c7990',
    tree: '#25494d', treeLight: '#44616d', trunk: '#39404b', rock: '#556b7d', cap: '#93a9bb', brick: '#4b637a', brickLight: '#68839a', water: '#29576c', ripple: '#789aab' } },
  harbor: { background: '#071622', ambient: '#afd3e5', sun: '#bce4ed', colors: {
    ground: '#183541', patch: '#1f3f4c', grass: '#325664', board: '#203e4c', soil: '#27383e', line: '#4f6a75',
    rock: '#455b64', brick: '#645045', brickLight: '#806659', steel: '#325966', metal: '#6a9199', water: '#123f59', ripple: '#4b879e', trunk: '#5c4a37', accent: '#9b753c', cap: '#47768b' } },
  factory: { background: '#111019', ambient: '#c7c4e0', sun: '#e3c0a3', colors: {
    ground: '#302831', patch: '#3b3037', grass: '#46404a', board: '#352e39', soil: '#2d2831', line: '#726157',
    rock: '#56505c', brick: '#614345', brickLight: '#84564f', steel: '#505260', metal: '#858491', accent: '#a87e3c', cap: '#62646c', water: '#313749' } },
  swamp: { background: '#10150d', ambient: '#c4d0ad', sun: '#d1d6aa', colors: {
    ground: '#2d3324', patch: '#374028', grass: '#56623c', board: '#333e2c', soil: '#3d3528', line: '#5f7047',
    tree: '#3f542f', treeLight: '#627047', trunk: '#5b503a', rock: '#555e40', brick: '#596042', brickLight: '#77815a', water: '#263e2b', ripple: '#566c40', accent: '#7f7047', cap: '#75805a' } },
  volcano: { background: '#190e0e', ambient: '#d2aeaa', sun: '#edb399', colors: {
    ground: '#382323', patch: '#452a27', grass: '#54322b', board: '#362529', soil: '#432b2a', line: '#754c3e',
    rock: '#3d323b', brick: '#663c35', brickLight: '#844d3e', steel: '#584249', metal: '#876968', water: '#593525', ripple: '#986344', accent: '#bc6235', cap: '#67483d' } },
  ruins: { background: '#15131b', ambient: '#cac2e3', sun: '#ddd0ba', colors: {
    ground: '#302e3a', patch: '#3b3746', grass: '#4a4b49', board: '#36333f', soil: '#35303b', line: '#6a6577',
    rock: '#747080', brick: '#665e68', brickLight: '#89818b', steel: '#5c626e', metal: '#939399', tree: '#414d49', treeLight: '#617165', accent: '#96917f', cap: '#8d8997' } },
  citadel: { background: '#101425', ambient: '#bbc7f5', sun: '#d2d8ff', colors: {
    ground: '#202a43', patch: '#29344f', grass: '#3c4869', board: '#2c3550', soil: '#2d3045', line: '#53648c',
    rock: '#555d7b', brick: '#4b5475', brickLight: '#6b769d', steel: '#485873', metal: '#8395b6', accent: '#9a7d53', cap: '#80515f', water: '#203c60', ripple: '#547fa1' } },
};

export function applyTheme(key = 'urban') {
  const theme = themes[Object.hasOwn(themes, key) ? key : 'urban'];
  for (const name of environmentKeys) mat[name].color.set(theme.colors[name] || urbanColors[name]);
  mat.glow.color.set(key === 'volcano' ? '#b94521' : '#795138');
  mat.glow.emissive.set(key === 'volcano' ? '#e75220' : '#a66b35');
  mat.glow.emissiveIntensity = key === 'volcano' ? 0.75 : 0.35;
  return { background: theme.background, ambient: theme.ambient, sun: theme.sun };
}

const hullShape = new THREE.Shape();
hullShape.moveTo(-0.43, -0.69);
hullShape.lineTo(0.43, -0.69);
hullShape.lineTo(0.56, -0.47);
hullShape.lineTo(0.56, 0.52);
hullShape.lineTo(0.39, 0.7);
hullShape.lineTo(-0.39, 0.7);
hullShape.lineTo(-0.56, 0.52);
hullShape.lineTo(-0.56, -0.47);
hullShape.closePath();
const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.065, bevelSegments: 1, steps: 1 });
hull.rotateX(-Math.PI / 2);

function mesh(parent, geometry, surface, x, y, z, sx = 1, sy = 1, sz = 1) {
  const part = new THREE.Mesh(geometry, surface);
  part.position.set(x, y, z);
  part.scale.set(sx, sy, sz);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

function instances(parent, geometry, surface, parts) {
  const group = new THREE.InstancedMesh(geometry, surface, parts.length);
  const transform = new THREE.Object3D();
  parts.forEach((p, index) => {
    transform.position.set(p[0], p[1], p[2]);
    transform.scale.set(p[3], p[4], p[5]);
    transform.rotation.set(p[6] || 0, p[7] || 0, p[8] || 0);
    transform.updateMatrix();
    group.setMatrixAt(index, transform.matrix);
  });
  group.castShadow = true;
  group.receiveShadow = true;
  parent.add(group);
  return group;
}

function colors(team) {
  const key = team === 'player' || team === 'enemy' ? team : 'neutral';
  return [mat[key], mat[`${key}Dark`], mat[`${key}Light`]];
}

export function tankModel(team, kind = 'tank') {
  if (!['tank', 'scout', 'heavy', 'apc', 'boss'].includes(kind)) kind = 'tank';
  const group = new THREE.Group();
  const [body, dark, light] = colors(team);
  group.userData.team = team;
  group.userData.kind = kind;
  group.userData.crewMarkers = [];
  if (kind === 'boss') {
    const wheels = [], tread = [], pods = [], mortars = [], stripes = [];
    for (const side of [-1, 1]) {
      mesh(group, box, mat.rubber, side * 1.03, 0.4, 0, 0.5, 0.65, 2.65);
      for (let i = 0; i < 5; i++) wheels.push([side * 1.22, 0.38, -1.0 + i * 0.5, 0.46, 0.12, 0.46, 0, 0, Math.PI / 2]);
      for (let i = 0; i < 12; i++) tread.push([side * 1.03, 0.745, -1.21 + i * 0.22, 0.52, 0.09, 0.12]);
      pods.push([side * 0.92, 1.23, -0.53, 0.47, 0.47, 0.84]);
      for (const z of [-0.76, -0.37]) mortars.push([side * 0.92, 1.57, z, 0.21, 0.52, 0.21, 0.22]);
      stripes.push([side * 0.63, 1.2, 0.97, 0.17, 0.035, 0.46, 0, side * 0.28]);
      stripes.push([side * 1.04, 0.805, 0.76, 0.42, 0.02, 0.12]);
    }
    instances(group, cylinder, mat.bossArmor, wheels);
    instances(group, box, mat.bossArmor, tread);
    mesh(group, box, mat.bossArmor, 0, 0.44, 0, 1.98, 0.3, 2.35);
    mesh(group, hull, mat.bossArmor, 0, 0.69, 0, 1.92, 1.55, 1.67);
    mesh(group, box, mat.bossRed, 0, 0.85, 1.15, 1.75, 0.35, 0.27);
    instances(group, box, mat.bossRed, pods);
    instances(group, cylinder, mat.rubber, mortars);
    instances(group, box, mat.cream, stripes);
    instances(group, box, mat.bossRed, [-0.51, -0.17, 0.17, 0.51].map(x => [x, 1.17, -1.06, 0.2, 0.045, 0.22]));
    const turret = new THREE.Group();
    turret.position.set(0, 1.29, 0.03);
    group.add(turret);
    mesh(turret, cylinder, mat.rubber, 0, -0.09, 0, 1.44, 0.2, 1.44);
    mesh(turret, hull, mat.bossRed, 0, 0, 0, 1.42, 1.3, 1.08);
    mesh(turret, box, mat.bossArmor, 0, 0.35, 0.05, 1.4, 0.14, 0.99);
    instances(turret, box, mat.bossArmor, [-0.34, 0.34].map(x => [x, 0.12, 0.69, 0.48, 0.4, 0.38]));
    instances(turret, cylinder, mat.bossArmor, [-0.34, 0.34].map(x => [x, 0.13, 1.23, 0.27, 1.2, 0.27, Math.PI / 2]));
    instances(turret, box, mat.bossRed, [-0.34, 0.34].map(x => [x, 0.13, 1.83, 0.4, 0.32, 0.31]));
    instances(turret, box, mat.rubber, [-0.34, 0.34].map(x => [x, 0.13, 1.991, 0.26, 0.18, 0.015]));
    instances(turret, box, mat.cream, [-0.34, 0.34].map(x => [x, 0.305, 1.82, 0.28, 0.025, 0.055]));
    // 核心以獨立群組縮放閃動；共享發光材質不可隨單一頭目修改。
    const core = new THREE.Group();
    core.position.set(0, 0.53, 0.04);
    turret.add(core);
    mesh(core, cylinder, mat.rubber, 0, -0.075, 0, 0.75, 0.17, 0.75);
    mesh(core, sphere, mat.bossCore, 0, 0.05, 0, 0.63, 0.4, 0.63);
    for (let i = 0; i < 6; i++) {
      const marker = mesh(turret, sphere, mat.enemyLight, (i % 3 - 1) * 0.32, 0.44, -0.45 - Math.floor(i / 3) * 0.22, 0.17, 0.14, 0.17);
      marker.visible = false;
      group.userData.crewMarkers.push(marker);
    }
    group.userData.turret = turret;
    group.userData.core = core;
    return group;
  }
  const heavy = kind === 'heavy', scout = kind === 'scout', apc = kind === 'apc';
  const wheels = [];
  const tread = [];
  for (const side of [-1, 1]) {
    if (scout || apc) {
      for (const z of apc ? [-0.49, 0, 0.49] : [-0.41, 0.41]) wheels.push([side * 0.55, 0.23, z, 0.32, 0.14, 0.32, 0, 0, Math.PI / 2]);
    } else {
      mesh(group, box, mat.track, side * (heavy ? 0.49 : 0.61), 0.28, 0, heavy ? 0.28 : 0.31, 0.4, heavy ? 1.25 : 1.73);
      for (let i = 0; i < 4; i++) wheels.push([side * (heavy ? 0.58 : 0.72), 0.28, (heavy ? -0.45 : -0.6) + i * (heavy ? 0.3 : 0.4), heavy ? 0.26 : 0.3, 0.12, heavy ? 0.26 : 0.3, 0, 0, Math.PI / 2]);
      for (let i = 0; i < 9; i++) tread.push([side * (heavy ? 0.49 : 0.62), 0.49, (heavy ? -0.56 : -0.76) + i * (heavy ? 0.14 : 0.19), heavy ? 0.29 : 0.34, 0.045, 0.085]);
    }
  }
  instances(group, cylinder, scout || apc ? mat.rubber : mat.rim, wheels);
  if (tread.length) instances(group, box, mat.rubber, tread);
  mesh(group, hull, body, 0, scout ? 0.39 : 0.49, 0, heavy ? 0.97 : scout ? 0.82 : apc ? 0.88 : 1, heavy ? 1.25 : scout ? 0.8 : 1, heavy ? 0.84 : scout ? 0.82 : apc ? 0.87 : 1);
  if (!apc) {
    mesh(group, box, dark, 0, scout ? 0.65 : 0.8, -0.41, 0.65, 0.045, 0.24);
    instances(group, box, mat.track, [-0.23, -0.08, 0.08, 0.23].map(x => [x, scout ? 0.68 : 0.83, -0.41, 0.06, 0.02, 0.2]));
  }
  mesh(group, box, mat.cream, -0.3, scout ? 0.67 : heavy ? 0.89 : 0.8, 0.43, 0.14, 0.024, 0.2);
  instances(group, box, mat.cream, [-1, 1].map(side => [side * 0.38, scout ? 0.55 : 0.65, kind === 'tank' ? 0.73 : 0.59, 0.13, 0.1, 0.06]));
  if (heavy) {
    instances(group, box, dark, [-1, 1].map(side => [side * 0.51, 0.71, 0, 0.14, 0.38, 1.05]));
    mesh(group, box, light, 0, 0.72, 0.59, 0.99, 0.22, 0.12);
  }
  const turret = new THREE.Group();
  if (apc) {
    mesh(group, box, dark, 0, 0.8, -0.28, 0.82, 0.13, 0.84);
    mesh(group, box, body, 0, 0.94, 0.36, 0.89, 0.44, 0.47);
    mesh(group, box, mat.gun, 0, 1, 0.605, 0.66, 0.15, 0.025);
    instances(group, box, body, [-1, 1].map(side => [side * 0.44, 0.95, -0.29, 0.1, 0.34, 0.85]));
    instances(group, box, light, [-1, 1].map(side => [side * 0.23, 0.88, -0.31, 0.21, 0.12, 0.76]));
    mesh(group, box, dark, 0, 0.69, -0.67, 0.82, 0.1, 0.13);
  } else {
    turret.position.set(0, scout ? 0.74 : heavy ? 1.01 : 0.91, 0.03);
    group.add(turret);
    mesh(turret, cylinder, dark, 0, -0.055, 0, heavy ? 0.8 : scout ? 0.48 : 0.68, 0.13, heavy ? 0.8 : scout ? 0.48 : 0.68);
    mesh(turret, hull, body, 0, 0, 0, heavy ? 0.93 : scout ? 0.47 : 0.65, heavy ? 1.2 : scout ? 0.65 : 0.85, heavy ? 0.66 : scout ? 0.42 : 0.57);
    mesh(turret, cylinder, light, -0.07, heavy ? 0.39 : scout ? 0.21 : 0.27, -0.04, 0.25, 0.055, 0.25);
    mesh(turret, box, mat.cream, scout ? 0.13 : 0.22, heavy ? 0.35 : scout ? 0.2 : 0.25, 0.08, 0.07, 0.03, 0.18);
    mesh(turret, box, dark, 0, 0.1, scout ? 0.28 : 0.38, heavy ? 0.38 : 0.22, heavy ? 0.31 : 0.2, 0.25);
    const barrel = mesh(turret, cylinder, dark, 0, 0.12, scout ? 0.66 : 0.89, heavy ? 0.17 : scout ? 0.075 : 0.11, scout ? 0.65 : 0.9, heavy ? 0.17 : scout ? 0.075 : 0.11);
    barrel.rotation.x = Math.PI / 2;
    mesh(turret, box, mat.gun, 0, 0.12, scout ? 0.99 : 1.34, heavy ? 0.27 : scout ? 0.12 : 0.19, heavy ? 0.24 : 0.16, 0.2);
    group.userData.turret = turret;
  }
  mesh(group, cylinder, dark, -0.38, apc ? 1.25 : 1.03, -0.57, 0.025, 0.69, 0.025);
  for (let i = 0; i < 6; i++) {
    const marker = mesh(apc ? group : turret, sphere, light,
      apc ? (i % 2 ? 0.23 : -0.23) : ((i % 3) - 1) * (scout ? 0.13 : 0.21),
      apc ? 1.09 : heavy ? 0.42 : scout ? 0.25 : 0.31,
      apc ? -0.13 - Math.floor(i / 2) * 0.23 : -0.15 - Math.floor(i / 3) * (scout ? 0.1 : 0.19),
      scout ? 0.12 : 0.17, 0.14, scout ? 0.12 : 0.17);
    marker.visible = false;
    group.userData.crewMarkers.push(marker);
  }
  return group;
}

export function soldierModel(team) {
  const group = new THREE.Group();
  const [body, dark, light] = colors(team);
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.11, 0.4, 0);
    mesh(leg, box, dark, 0, -0.16, 0, 0.15, 0.3, 0.17);
    mesh(leg, box, mat.gun, 0, -0.32, 0.055, 0.17, 0.13, 0.26);
    group.add(leg);
    legs.push(leg);
  }
  mesh(group, box, body, 0, 0.58, 0, 0.38, 0.37, 0.27);
  mesh(group, box, light, 0, 0.55, 0.155, 0.31, 0.19, 0.055);
  mesh(group, box, dark, 0, 0.59, -0.2, 0.29, 0.3, 0.15);
  mesh(group, box, mat.skin, 0, 0.87, 0.025, 0.23, 0.23, 0.22);
  mesh(group, sphere, body, 0, 1.005, 0, 0.45, 0.36, 0.43);
  mesh(group, cylinder, dark, 0, 0.965, 0.035, 0.44, 0.07, 0.4);
  mesh(group, box, mat.gun, 0, 0.88, 0.144, 0.17, 0.055, 0.025);
  const arm = mesh(group, box, body, 0.235, 0.63, 0.14, 0.13, 0.19, 0.37);
  arm.rotation.x = -0.2;
  mesh(group, box, body, -0.2, 0.66, 0.2, 0.14, 0.14, 0.37).rotation.y = 0.3;
  mesh(group, box, mat.gun, 0.16, 0.69, 0.41, 0.11, 0.13, 0.55);
  mesh(group, box, dark, 0.16, 0.59, 0.37, 0.11, 0.16, 0.14);
  const bandageMarker = new THREE.Group();
  bandageMarker.position.y = 1.58;
  group.add(bandageMarker);
  mesh(bandageMarker, box, mat.cream, 0, 0, 0, 0.34, 0.035, 0.09);
  mesh(bandageMarker, box, mat.cream, 0, 0, 0, 0.09, 0.035, 0.34);
  const bleedMarker = mesh(group, sphere, mat.bossRed, 0, 1.53, 0, 0.21, 0.36, 0.21);
  for (const marker of [...bandageMarker.children, bleedMarker]) marker.castShadow = marker.receiveShadow = false;
  bandageMarker.visible = bleedMarker.visible = false;
  group.userData.bandageMarker = bandageMarker;
  group.userData.bleedMarker = bleedMarker;
  group.userData.legs = legs;
  group.userData.team = team;
  return group;
}

export function wallModel(wall) {
  const group = new THREE.Group();
  const w = wall.w || 1.8;
  const d = wall.d || 1.8;
  if (wall.kind === 'water') {
    mesh(group, box, mat.water, 0, 0.015, 0, w, 0.03, d).castShadow = false;
    const ripples = [];
    for (let i = 0; i < 3; i++) ripples.push([(i % 2 ? 0.15 : -0.16) * w, 0.035, (i - 1) * d * 0.24, w * 0.31, 0.009, 0.025]);
    instances(group, box, mat.ripple, ripples).castShadow = false;
  } else if (wall.kind === 'steel') {
    mesh(group, box, mat.steel, 0, 0.48, 0, w, 0.96, d);
    mesh(group, box, mat.metal, 0, 0.99, 0, w * 0.96, 0.07, d * 0.96);
    const length = Math.hypot(w * 0.77, d * 0.77);
    const angle = Math.atan2(w, d);
    instances(group, box, mat.steel, [[0, 1.035, 0, 0.085, 0.035, length, 0, angle], [0, 1.035, 0, 0.085, 0.035, length, 0, -angle]]);
    const bolts = [];
    for (const x of [-1, 1]) for (const z of [-1, 1]) bolts.push([x * w * 0.39, 1.05, z * d * 0.39, 0.09, 0.04, 0.09]);
    instances(group, cylinder, mat.gun, bolts);
  } else {
    mesh(group, box, mat.mortar, 0, 0.515, 0, w - 0.055, 1.03, d - 0.055);
    const bricks = [[], []];
    const columns = Math.max(1, Math.ceil(w / 0.8));
    const rows = Math.max(1, Math.ceil(d / 0.75));
    const bw = w / columns;
    const bd = d / rows;
    for (let course = 0; course < 3; course++) {
      for (let row = 0; row < rows; row++) {
        const offset = (course + row) % 2 ? bw / 2 : 0;
        for (let col = offset ? -1 : 0; col < columns; col++) {
          const left = Math.max(-w / 2, -w / 2 + col * bw + offset);
          const right = Math.min(w / 2, -w / 2 + (col + 1) * bw + offset);
          if (right - left > 0.04) bricks[(course + row + col + 2) % 2].push([(left + right) / 2, 0.18 + course * 0.345, -d / 2 + (row + 0.5) * bd, right - left - 0.035, 0.31, bd - 0.035]);
        }
      }
    }
    if (bricks[0].length) instances(group, box, mat.brick, bricks[0]);
    if (bricks[1].length) instances(group, box, mat.brickLight, bricks[1]);
  }
  return group;
}

export function baseModel(team = 'player') {
  const group = new THREE.Group();
  group.userData.team = team;
  mesh(group, box, mat.board, 0, 0.12, 0, 2.1, 0.24, 1.9);
  if (team === 'enemy') {
    mesh(group, box, mat.enemyDark, 0, 0.59, 0, 1.66, 0.7, 1.42);
    mesh(group, hull, mat.enemy, 0, 0.95, 0, 1.35, 0.55, 1.03);
    mesh(group, box, mat.gun, 0, 0.61, 0.72, 0.91, 0.18, 0.025);
    instances(group, box, mat.enemyLight, [-1, 1].map(side => [side * 0.67, 0.58, 0.74, 0.16, 0.52, 0.055]));
    mesh(group, cylinder, mat.gun, -0.32, 1.32, -0.05, 0.07, 0.54, 0.07);
    mesh(group, cylinder, mat.neutralLight, -0.32, 1.61, -0.05, 0.69, 0.09, 0.69).rotation.z = Math.PI / 4;
    mesh(group, cylinder, mat.enemyLight, -0.06, 1.72, -0.05, 0.035, 0.44, 0.035).rotation.z = -Math.PI / 4;
    mesh(group, cylinder, mat.gun, 0.69, 1.45, -0.58, 0.045, 2.5, 0.045);
    mesh(group, box, mat.enemyFlag, 0.36, 2.45, -0.58, 0.66, 0.43, 0.025);
    mesh(group, box, mat.enemyLight, 0.24, 2.45, -0.56, 0.075, 0.26, 0.01);
    return group;
  }
  mesh(group, box, mat.cream, 0, 0.33, 0, 1.7, 0.18, 1.5);
  mesh(group, box, mat.gold, 0, 0.47, 0, 1.18, 0.13, 0.94);
  mesh(group, cylinder, mat.gold, 0, 0.84, 0, 0.48, 0.69, 0.48);
  for (const side of [-1, 1]) {
    const wing = mesh(group, box, mat.gold, side * 0.43, 1.06, 0, 0.71, 0.16, 0.37);
    wing.rotation.z = side * 0.37;
    mesh(group, box, mat.cream, side * 0.86, 0.6, 0.59, 0.19, 0.5, 0.2);
  }
  mesh(group, sphere, mat.cream, 0, 1.22, 0.06, 0.39, 0.42, 0.4);
  mesh(group, cone, mat.gold, 0, 1.21, 0.3, 0.24, 0.3, 0.24).rotation.x = Math.PI / 2;
  mesh(group, cylinder, mat.gun, 0.92, 1.26, -0.58, 0.045, 2.48, 0.045);
  mesh(group, sphere, mat.gold, 0.92, 2.52, -0.58, 0.12, 0.12, 0.12);
  mesh(group, box, mat.flag, 1.27, 2.16, -0.58, 0.7, 0.43, 0.025);
  mesh(group, box, mat.cream, 1.16, 2.16, -0.558, 0.075, 0.28, 0.01);
  return group;
}

export function grenadeModel() {
  const group = new THREE.Group();
  mesh(group, sphere, mat.playerDark, 0, 0, 0, 0.28, 0.34, 0.28);
  mesh(group, cylinder, mat.gun, 0, 0.17, 0, 0.1, 0.11, 0.1);
  mesh(group, box, mat.gold, 0.035, 0.23, 0, 0.18, 0.035, 0.07);
  return group;
}

export function droneModel() {
  const group = new THREE.Group();
  group.userData.team = 'player';
  group.userData.kind = 'drone';
  group.userData.rotors = [];
  mesh(group, hull, mat.neutral, 0, 0.015, 0, 0.35, 0.5, 0.32);
  mesh(group, box, mat.playerDark, 0, 0.16, 0, 0.24, 0.06, 0.27);
  for (const angle of [-Math.PI / 4, Math.PI / 4]) mesh(group, box, mat.playerDark, 0, 0.06, 0, 0.94, 0.065, 0.07).rotation.y = angle;
  const motors = [];
  for (const x of [-0.31, 0.31]) for (const z of [-0.31, 0.31]) {
    motors.push([x, 0.085, z, 0.105, 0.14, 0.105]);
    const rotor = new THREE.Group();
    rotor.position.set(x, 0.17, z);
    mesh(rotor, box, mat.neutralLight, 0, 0, 0, 0.34, 0.025, 0.055);
    group.add(rotor);
    group.userData.rotors.push(rotor);
  }
  instances(group, cylinder, mat.neutral, motors);
  mesh(group, sphere, mat.gun, 0, -0.055, 0.14, 0.16, 0.15, 0.18);
  mesh(group, cylinder, mat.gun, 0, -0.055, 0.27, 0.065, 0.18, 0.065).rotation.x = Math.PI / 2;
  mesh(group, box, mat.droneLight, 0, 0.105, 0.235, 0.19, 0.065, 0.035);
  instances(group, box, mat.droneLight, [-1, 1].map(side => [side * 0.13, 0.15, -0.17, 0.045, 0.04, 0.055]));
  return group;
}

const pickupLoader = new THREE.TextureLoader();
const pickupIcons = {};
const pickupColors = { repair: mat.playerLight, drone: mat.droneLight, missile: mat.gold, ammo: mat.enemyLight };

export function pickupModel(kind = 'repair', airdrop = false) {
  if (!Object.hasOwn(pickupColors, kind)) kind = 'repair';
  // 每種圖示只載入一次；載入失敗時保留實體箱，不顯示空白貼圖。
  if (!pickupIcons[kind]) {
    const icon = new THREE.SpriteMaterial({ toneMapped: false, depthWrite: false, alphaTest: 0.04 });
    icon.visible = false;
    pickupIcons[kind] = icon;
    icon.map = pickupLoader.load(new URL(`./assets/pickups/${kind}.${kind === 'ammo' ? 'svg' : 'png'}`, import.meta.url).href,
      () => { icon.visible = true; }, undefined,
      error => console.warn(`補給圖示 ${kind} 載入失敗，保留補給箱。`, error));
    icon.map.colorSpace = THREE.SRGBColorSpace;
  }
  const group = new THREE.Group();
  group.userData.kind = kind;
  mesh(group, cylinder, pickupColors[kind], 0, 0.025, 0, 0.68, 0.035, 0.68);
  mesh(group, box, mat.neutralDark, 0, 0.17, 0, 0.44, 0.3, 0.44);
  mesh(group, box, pickupColors[kind], 0, 0.34, 0, 0.48, 0.055, 0.48);
  const icon = new THREE.Sprite(pickupIcons[kind]);
  icon.position.y = 0.95;
  icon.scale.set(1.4, 1.4, 1);
  group.add(icon);
  if (airdrop) {
    const parachute = new THREE.Group();
    mesh(parachute, cone, mat.cream, 0, 2.12, 0, 1.25, 0.38, 1.25);
    for (const x of [-0.35, 0.35]) mesh(parachute, cylinder, mat.cream, x, 1.14, 0, 0.018, 1.58, 0.018);
    group.add(parachute);
    group.userData.parachute = parachute;
  }
  return group;
}

export function missileModel() {
  const group = new THREE.Group();
  group.userData.kind = 'missile';
  mesh(group, cylinder, mat.gold, 0, 0, -0.025, 0.13, 0.34, 0.13).rotation.x = Math.PI / 2;
  mesh(group, cone, mat.cream, 0, 0, 0.235, 0.14, 0.18, 0.14).rotation.x = Math.PI / 2;
  mesh(group, cylinder, mat.gun, 0, 0, 0.06, 0.14, 0.035, 0.14).rotation.x = Math.PI / 2;
  mesh(group, box, mat.gold, 0, 0, -0.14, 0.29, 0.025, 0.18);
  mesh(group, box, mat.gold, 0, 0, -0.14, 0.025, 0.29, 0.18);
  group.userData.flame = mesh(group, cone, mat.bossCore, 0, 0, -0.275, 0.11, 0.16, 0.11);
  group.userData.flame.rotation.x = -Math.PI / 2;
  return group;
}

export function terrainModel(theme = 'urban') {
  if (!Object.hasOwn(themes, theme)) theme = 'urban';
  applyTheme(theme);
  const group = new THREE.Group();
  group.userData.theme = theme;
  mesh(group, box, mat.edge, 0, -0.55, 0, 34, 0.38, 34);
  mesh(group, box, mat.board, 0, -0.32, 0, 33.55, 0.2, 33.55);
  mesh(group, box, mat.soil, 0, -0.19, 0, 33, 0.17, 33);
  mesh(group, box, mat.ground, 0, -0.065, 0, 32.65, 0.09, 32.65);
  const patches = [];
  const grass = [];
  // 固定分佈，重新開局時保持同一個場景。
  for (let i = 0; i < 100; i++) {
    const x = ((i * 73) % 307) / 10 - 15.3;
    const z = ((i * 137) % 307) / 10 - 15.3;
    patches.push([x, -0.012, z, 0.24 + (i % 7) * 0.17, 0.01, 0.12 + (i % 4) * 0.09]);
    grass.push([x + 0.3, 0.001, z + 0.24, 0.08, 0.008, 0.2]);
  }
  instances(group, box, mat.patch, patches).castShadow = false;
  instances(group, box, mat.grass, grass).castShadow = false;
  const lines = [];
  const posts = [];
  for (let i = -14; i <= 14; i += 2) {
    lines.push([i, 0.003, -15.2, 0.7, 0.012, 0.065], [i, 0.003, 15.2, 0.7, 0.012, 0.065]);
    lines.push([-15.2, 0.003, i, 0.065, 0.012, 0.7], [15.2, 0.003, i, 0.065, 0.012, 0.7]);
    if (i % 4 === 0) posts.push([i, 0.15, -15.75, 0.1, 0.3, 0.1], [i, 0.15, 15.75, 0.1, 0.3, 0.1]);
  }
  instances(group, box, mat.line, lines).castShadow = false;
  instances(group, box, mat.board, posts);
  // 道具全在邊界外；每組相同幾何與材質只送出一次繪製。
  const decoration = new THREE.Group();
  decoration.name = 'terrain-decoration';
  group.add(decoration);
  const batches = new Map();
  const add = (geometry, surface, ...part) => {
    const key = `${geometry.id}:${surface.id}`;
    if (!batches.has(key)) batches.set(key, { geometry, surface, parts: [] });
    batches.get(key).parts.push(part);
  };
  for (const side of [-1, 1]) {
    for (const [i, z] of [-12, -5, 5, 12].entries()) {
      const x = side * 16.2;
      switch (theme) {
        case 'urban': {
          const height = 1.6 + i % 3 * 0.7;
          add(box, mat.rock, x, height / 2, z, 1.4, height, 2.4);
          add(box, mat.brick, x + side * 0.35, height + 0.28, z - 0.65, 0.5, 0.56, 0.9);
          for (const floor of [0.55, 1.2]) for (const dz of [-0.7, 0.1, 0.7]) {
            add(box, mat.glow, x - side * 0.71, floor, z + dz, 0.025, 0.24, 0.3);
          }
          add(sphere, mat.brickLight, x, 0.15, z + 1.65, 0.8, 0.4, 0.65);
          break;
        }
        case 'forest':
          add(cylinder, mat.trunk, x, 0.75, z, 0.25, 1.5, 0.25);
          add(sphere, mat.tree, x, 1.7, z, 1.5, 1.8, 1.7);
          add(sphere, mat.treeLight, x - side * 0.1, 2.4, z, 1.1, 1.1, 1.2);
          add(cone, mat.tree, x + side * 0.05, 1.2, z + 1.8, 1.05, 2.2, 1.2);
          add(sphere, mat.rock, x, 0.15, z - 1.5, 0.75, 0.5, 0.85);
          break;
        case 'desert':
          add(cylinder, mat.tree, x, 1.05, z, 0.34, 2.1, 0.34);
          for (const dz of [-0.5, 0.5]) {
            add(box, mat.tree, x, 0.85, z + dz / 2, 0.23, 0.24, 0.65);
            add(cylinder, mat.treeLight, x, 1.19, z + dz, 0.24, 0.85, 0.24);
          }
          add(sphere, mat.rock, x, 0.3, z + 1.8, 1.2, 0.85, 1.4);
          add(sphere, mat.accent, x, 0.18, z - 1.6, 0.75, 0.5, 0.85);
          break;
        case 'snow':
          add(cylinder, mat.trunk, x, 0.6, z, 0.2, 1.2, 0.2);
          for (let tier = 0; tier < 3; tier++) {
            const width = 1.5 - tier * 0.32;
            add(cone, mat.tree, x, 1.1 + tier * 0.62, z, width, 1.4, width);
            add(cone, mat.cap, x, 1.43 + tier * 0.62, z, width * 0.6, 0.85, width * 0.6);
          }
          add(sphere, mat.rock, x, 0.22, z + 1.8, 1.1, 0.6, 1.25);
          add(sphere, mat.cap, x, 0.4, z + 1.8, 1.04, 0.3, 1.16);
          break;
        case 'harbor':
          add(box, mat.trunk, x, 0.12, z, 1.6, 0.24, 4.8);
          add(box, i % 2 ? mat.cap : mat.brick, x, 0.9, z + 0.4, 1.35, 1.3, 2.6);
          for (const dz of [-0.65, -0.05, 0.55, 1.15]) add(box, mat.metal, x - side * 0.69, 0.9, z + dz, 0.04, 1.14, 0.035);
          add(box, mat.accent, x, 1.75, z - 1.8, 0.24, 3.5, 0.24);
          add(box, mat.accent, x, 3.45, z - 0.8, 0.26, 0.22, 2.4);
          add(cylinder, mat.metal, x, 2.72, z + 0.25, 0.035, 1.3, 0.035);
          add(box, mat.accent, x, 2.05, z + 0.32, 0.15, 0.12, 0.3);
          break;
        case 'factory':
          add(box, mat.steel, x, 0.6, z, 1.4, 1.2, 2.8);
          add(cylinder, mat.brick, x, 2, z - 0.65, 0.72, 2.8 + i % 2 * 0.5, 0.72);
          add(cylinder, mat.accent, x, 2.8, z - 0.65, 0.76, 0.16, 0.76);
          add(cylinder, mat.metal, x, 0.7, z + 1.95, 0.46, 0.7, 0.46);
          add(cylinder, mat.metal, x, 1.02, z + 1.2, 0.34, 1.5, 0.34, Math.PI / 2);
          add(box, mat.glow, x - side * 0.71, 0.63, z, 0.025, 0.26, 1.2);
          break;
        case 'swamp':
          add(cylinder, mat.trunk, x, 1, z, 0.16, 2, 0.16);
          add(cylinder, mat.trunk, x, 1.45, z + 0.4, 0.12, 1.0, 0.12, 0.7);
          add(cylinder, mat.trunk, x, 1.85, z - 0.3, 0.11, 0.85, 0.11, -0.8);
          add(sphere, mat.water, x, 0.01, z + 1.8, 1.45, 0.06, 1.9);
          for (let reed = 0; reed < 6; reed++) {
            const dz = z + 1.1 + reed * 0.22;
            const height = 0.65 + reed % 3 * 0.19;
            add(cylinder, mat.treeLight, x + (reed % 2 - 0.5) * 0.45, height / 2, dz, 0.055, height, 0.055);
            add(cylinder, mat.accent, x + (reed % 2 - 0.5) * 0.45, height, dz, 0.1, 0.23, 0.1);
          }
          break;
        case 'volcano':
          add(sphere, mat.rock, x, 0.75, z, 1.5, 2.4, 2.0);
          add(sphere, mat.rock, x, 0.38, z + 1.9, 1.4, 1.0, 1.35);
          add(box, mat.glow, x - side * 0.48, 0.67, z, 0.11, 1.3, 0.22, 0.24);
          add(box, mat.glow, x, 0.025, z - 1.75, 1.1, 0.04, 1.5);
          add(sphere, mat.glow, x - side * 0.15, 0.17, z + 1.8, 0.42, 0.46, 0.5);
          add(sphere, mat.cap, x, 0.12, z - 2.35, 0.75, 0.35, 0.6);
          break;
        case 'ruins':
          add(box, mat.rock, x, 0.16, z, 1.4, 0.32, 1.7);
          if (i % 2 === 0) {
            add(cylinder, mat.cap, x, 1.2, z, 0.65, 1.85, 0.65);
            add(box, mat.accent, x, 2.18, z, 1.05, 0.24, 1.05);
            add(cylinder, mat.rock, x, 0.35, z + 1.8, 0.65, 1.2, 0.65, Math.PI / 2);
          } else {
            add(box, mat.cap, x, 1.07, z, 0.55, 1.5, 0.6);
            add(sphere, mat.accent, x, 2.0, z, 0.6, 0.7, 0.6);
            add(box, mat.rock, x, 1.6, z, 0.48, 0.28, 1.55);
          }
          add(sphere, mat.tree, x, 0.2, z - 1.35, 0.95, 0.45, 0.8);
          break;
        case 'citadel':
          add(box, mat.rock, x, 1.3, z, 1.5, 2.6, 1.7);
          add(box, mat.metal, x, 2.55, z, 1.58, 0.16, 1.78);
          for (const dz of [-0.65, 0, 0.65]) add(box, mat.rock, x, 2.83, z + dz, 1.5, 0.44, 0.33);
          add(box, mat.glow, x - side * 0.76, 1.5, z, 0.025, 0.7, 0.22);
          add(cylinder, mat.accent, x, 3.25, z, 0.065, 1.25, 0.065);
          add(box, mat.cap, x, 3.56, z + 0.43, 0.035, 0.45, 0.85);
          add(box, mat.accent, x - side * 0.023, 3.56, z + 0.18, 0.012, 0.32, 0.075);
          break;
      }
    }
  }
  for (const { geometry, surface, parts } of batches.values()) instances(decoration, geometry, surface, parts);
  return group;
}
