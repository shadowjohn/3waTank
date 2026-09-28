// 每張配置圖由北往南排列；外環道路保留坦克寬度，磚牆可另闢捷徑。
const regions = [
  ['urban', '廢墟城區', [
    ['街角初火', '', '先守住中央道路，留意跳車的敵軍。'],
    ['長街交鋒', 'bh.b/.vh./b..h', '沿長街推進，利用橫牆擋住側面火力。'],
    ['十字封鎖', 'h.h./.v.v/h.bh', '十字路口暴露，先清出一條退路。'],
    ['市政廣場', 'h..h/v..v/hhh.', '廣場兩翼有掩體，別讓敵軍繞到基地。'],
    ['舊城突破', 'vbvh/h..h/vhbv', '擊破薄磚牆，從側翼切進防線。'],
  ]],
  ['forest', '針葉森林', [
    ['林間哨站', 'q.bq/.v../bq.b', '林間掩體交錯，下車步兵更容易穿梭。'],
    ['溪谷伏擊', 'r.br/b.q./qr.q', '溪流不能穿越，先確認橋口的位置。'],
    ['雙林夾道', 'v..v/q..q/vbbv', '中央隔板交錯，從兩翼繞行切入。'],
    ['伐木營地', '.qhb/h.v./b.hq', '炸開木障，再進入營地搶車。'],
    ['深林追獵', 'qvrq/r..b/vqqv', '濃密障礙讓步兵接近，別只盯著坦克。'],
  ]],
  ['desert', '黃金沙海', [
    ['沙丘前線', 'h..b/.h.h/b.h.', '沙丘間空地寬，移動射擊避免被集火。'],
    ['乾河渡口', 'r.hr/h..b/.h.q', '乾河橫切戰場，優先控制兩側渡口。'],
    ['砂岩迷陣', 'q.v./v.qv/.vq.', '轉角很多，炮塔先瞄準再露出車身。'],
    ['綠洲防衛', 'bwr./q..w/hr.b', '水池會擋路，防守時留出撤退方向。'],
    ['烈日碉堡', 'Hq.H/vh.v/qHqh', '鋼板無法炸穿，沿碉堡外側繞行。'],
  ]],
  ['snow', '極地雪境', [
    ['雪原接敵', 'v.bv/b..v/.v.b', '隔板切斷長射線，利用掩體分隔敵群。'],
    ['冰湖缺口', 'w.hw/v..r/q.w.', '冰湖只有缺口能通行，別把車困住。'],
    ['凍土壕溝', 'hvh./.H.H/v.hv', '壕溝分成數段，先打通相鄰兩段。'],
    ['白夜營區', 'q.Hq/vb.v/.qhq', '營區內射線短，下車機槍適合清兵。'],
    ['北境堡壘', 'VqHV/r..r/qHvq', '左右兩路都能進攻，留意基地側門。'],
  ]],
  ['harbor', '海港防線', [
    ['碼頭登陸', 'r..r/vh.v/b.rb', '港池切開道路，從岸邊交叉射擊。'],
    ['貨櫃走廊', 'vV.v/v.vV/h..h', '貨櫃之間能繞行，別停在走廊出口。'],
    ['雙閘水道', 'rwr./h..h/.rwr', '兩條水道夾擊，守住中央轉運區。'],
    ['船塢突圍', 'q.rq/V..v/qh.r', '船塢轉角易遭伏擊，先破壞近處磚牆。'],
    ['防波堤決戰', 'Hr.r/w..w/r.rH', '海堤隔斷炮線，繞到缺口再開火。'],
  ]],
  ['factory', '工業廠區', [
    ['熄火車間', 'H.bH/vq.v/h.b.', '機台鋼板能擋炮，利用它切斷追擊。'],
    ['輸送帶防線', 'hHhH/.v.v/Hh.H', '橫向防線很多，從邊緣逐段突破。'],
    ['反應爐外環', 'qH.q/V..V/q.Hq', '反應爐外環可繞行，別讓敵人包夾。'],
    ['倉庫交叉火', 'qvqv/h..H/vqvq', '倉庫缺口交錯，機槍步兵會利用死角。'],
    ['重工核心', 'VHVq/q..H/hVVh', '先清除步兵，再奪取受損的重裝坦克。'],
  ]],
  ['swamp', '迷霧沼澤', [
    ['蘆葦淺灘', 'w.br/.q.w/r.b.', '沼澤無法行車，沿乾地交替前進。'],
    ['曲水岔路', 'r.wr/w..b/.rw.', '河汊有多個缺口，選一側集中突破。'],
    ['沉沒哨所', 'qw.q/r..w/q.br', '半沉掩體能擋射線，別被逼到水邊。'],
    ['濕地長堤', 'a..a/hrrh/a.ba', '長堤狹窄，邊射擊邊保留後退空間。'],
    ['黑水圍城', 'wrqw/r..r/qwwq', '外圍仍有道路，別執著從水面直攻。'],
  ]],
  ['volcano', '熔岩地帶', [
    ['火山山麓', 'a.ha/.q.r/h.bb', '熔岩不可跨越，跟著岩地缺口推進。'],
    ['熔河兩岸', 'rarr/v..v/ra.r', '兩岸射線被截斷，沿缺口逐段壓制敵軍。'],
    ['黑曜石陣', 'Vq.V/q.rq/.VqH', '黑曜石鋼障擋炮，找磚牆打開缺口。'],
    ['灼熱裂谷', 'ar.a/H..H/a.ra', '裂谷分割戰場，注意兩側繞路的敵軍。'],
    ['火口封鎖', 'qwaq/r..w/aqwq', '火口只留下外環，別讓基地側翼失守。'],
  ]],
  ['ruins', '古城遺跡', [
    ['斷柱大道', 'bvbv/.h../vbvb', '斷柱提供短暫掩護，快速切換射擊位置。'],
    ['神殿前庭', 'qHHq/v..v/qhhq', '隔牆分開前庭，從柱廊缺口交叉射擊。'],
    ['地下城入口', 'qv.q/h..v/q.qh', '入口轉角密集，保留坦克供步兵撤回。'],
    ['石環迷宮', 'Vqhq/q..q/qhVq', '石環有多條岔路，清兵比追車更重要。'],
    ['失落王城', 'qHqq/r..a/qqHq', '古牆可炸開，讓重裝車輛失去掩護。'],
  ]],
  ['citadel', '鋼鐵要塞', [
    ['外郭攻堅', 'VHHV/hq.q/VhhV', '外郭炮火密集，利用鋼牆分批交戰。'],
    ['雙翼堡門', 'qVVq/H..H/qhhV', '兩翼堡門都能進入，隨時回防基地。'],
    ['鋼牆縱深', 'VHVH/.q.q/HVHV', '每層鋼牆都有側路，別在正面硬拚。'],
    ['指揮中樞', 'qHVq/ra.r/qVHq', '先拿下外環，再追擊跳車的指揮兵。'],
    ['最後防線', 'qVHV/H..H/VHqq', '三波最後攻勢，利用棄車維持裝甲戰力。'],
  ]],
];

function wallsFor(plan) {
  const walls = [];
  const add = (x, z, w, d, kind = 'brick') => walls.push({ x, z, w, d, kind });
  if (!plan) {
    for (const z of [-7, -1, 5]) for (const x of [-9, -3, 3, 9]) {
      if ((x === -3 && z === -1) || (x === 9 && z === 5)) continue;
      add(x, z, 2.2, 2.2, (x === 9 && z === -7) || (x === -9 && z === -1) ? 'steel' : 'brick');
    }
    add(-5.8, 4.8, 2.2, 3, 'water');
    add(5.8, -1, 2.2, 3, 'water');
  } else {
    const shapes = { b: [2.2, 2.2, 'brick'], h: [4, 1.2, 'brick'], v: [1.2, 4, 'brick'],
      H: [4, 1.2, 'steel'], V: [1.2, 4, 'steel'], w: [3.8, 3.8, 'water'],
      r: [4, 2, 'water'], a: [2, 4, 'water'] };
    plan.split('/').forEach((row, zi) => [...row].forEach((shape, xi) => {
      const x = -9 + xi * 6, z = -7 + zi * 6;
      if (shape === 'q') {
        add(x - 1.4, z, 0.8, 3.6);
        add(x, z + 1.4, 3.6, 0.8);
      } else if (shapes[shape]) add(x, z, ...shapes[shape]);
    }));
  }
  // 錯位鋼牆切斷南北直射；中央北口及 x = ±12 外環保留坦克繞行空間。
  add(0, 2, 7.2, 0.8, 'steel');
  add(-7, -4, 7.2, 0.8, 'steel');
  add(7, -4, 7.2, 0.8, 'steel');
  add(0, 10.4, 2, 0.55);
  add(-1.8, 12.2, 0.55, 2.4);
  add(1.8, 12.2, 0.55, 2.4);
  return walls;
}

export const LEVELS = regions.flatMap(([theme, region, stages], regionIndex) => stages.map(([name, plan, briefing], index) => {
  const id = regionIndex * 5 + index + 1, progress = (id - 1) / 49;
  const extra = Math.floor(progress * 3);
  return { id, name, region, theme, walls: wallsFor(plan), waves: [3 + extra, 4 + extra, 5 + extra],
    enemyHp: Math.round(80 + 32 * progress), enemySpeed: +(2.3 + 0.6 * progress).toFixed(3),
    fireScale: +(1 - 0.18 * progress).toFixed(3), enemyBaseCount: 1 + Math.floor((id - 1) / 10), briefing };
}));

export function getLevel(number) {
  const value = typeof number === 'number' || typeof number === 'string' ? Number(number) : NaN;
  const id = Number.isFinite(value) ? Math.max(1, Math.min(50, Math.trunc(value))) : 1;
  return LEVELS[id - 1];
}
