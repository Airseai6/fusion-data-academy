// G6 过河逻辑测试。从单文件页面里抽出 RIVER CORE 代码块在 VM 里跑，测的是真正上线的那份代码。
// 运行：node --test tests/river_logic_test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../puzzle/river/index.html', import.meta.url), 'utf8');
const start = html.indexOf('/* === RIVER CORE START === */');
const end = html.indexOf('/* === RIVER CORE END === */');
assert.ok(start >= 0 && end > start, 'RIVER CORE 标记缺失');

const context = vm.createContext({ console });
vm.runInContext(html.slice(start, end), context);
const F = vm.runInContext(`({
  LEVELS, levelById, startState, goalState, stateKey, countsOn, unsafeReason,
  loadCombos, stepState, legalMoves, loadTotal, trimLoad, sameLoad,
  bfsFrom, layerWidths, allSafeStates, levelGraph, shortestDistance, shortestPath,
  hintNext, hintText, freeBoatDistance, rulePredator, ruleMissionary
})`, context);

const WGC = F.levelById('wgc');
const MC = F.levelById('mc');
const kOf = (level, s) => F.stateKey(level, s);
const goalKey = (level) => kOf(level, F.goalState(level));

/* ────────── 独立参考实现 1：狼羊菜（集合编码 + 手工规则，不复用页面代码） ────────── */
const WGC_ITEMS = ['wolf', 'sheep', 'cabbage'];

function wgcBankOk(items) {
  const has = (x) => items.indexOf(x) >= 0;
  if (has('wolf') && has('sheep')) return false;        // 狼吃羊
  if (has('sheep') && has('cabbage')) return false;     // 羊吃菜
  return true;
}
/** 船所在的一岸有人看守；只检查没人看守的那一岸。 */
function wgcSafe(left, boat) {
  const right = WGC_ITEMS.filter((x) => left.indexOf(x) < 0);
  return boat === 'L' ? wgcBankOk(right) : wgcBankOk(left);
}
function wgcNext(node) {
  const here = node.boat === 'L' ? node.left : WGC_ITEMS.filter((x) => node.left.indexOf(x) < 0);
  const loads = [[]].concat(here.map((x) => [x]));      // 空船 + 带一样
  const out = [];
  for (const load of loads) {
    const left = node.boat === 'L'
      ? node.left.filter((x) => load.indexOf(x) < 0)
      : node.left.concat(load);
    const boat = node.boat === 'L' ? 'R' : 'L';
    if (wgcSafe(left, boat)) out.push({ left, boat });
  }
  return out;
}

/* ────────── 独立参考实现 2：传教士野人（二元组编码 + 手工规则） ────────── */
function mcBankOk(m, c) { return !(m > 0 && c > m); }
function mcSafe(m, c) { return mcBankOk(m, c) && mcBankOk(3 - m, 3 - c); }
function mcNext(node) {
  const here = node.boat === 'L' ? { m: node.m, c: node.c } : { m: 3 - node.m, c: 3 - node.c };
  const sign = node.boat === 'L' ? -1 : 1;
  const out = [];
  for (let dm = 0; dm <= here.m; dm++) {
    for (let dc = 0; dc <= here.c; dc++) {
      const n = dm + dc;
      if (n < 1 || n > 2) continue;                     // 船容 2，且不允许空船
      const m = node.m + sign * dm;
      const c = node.c + sign * dc;
      if (!mcSafe(m, c)) continue;
      out.push({ m, c, boat: node.boat === 'L' ? 'R' : 'L' });
    }
  }
  return out;
}

/* ────────── 独立最短路：迭代加深 DFS（不用 BFS，也不读页面的 dist） ────────── */
function depthSearch(node, depth, seen, keyFn, nextFn, isGoal) {
  if (isGoal(node)) return true;
  if (depth <= 0) return false;
  for (const nx of nextFn(node)) {
    const k = keyFn(nx);
    if (seen.has(k)) continue;                          // 最短路径不会重复状态
    seen.add(k);
    if (depthSearch(nx, depth - 1, seen, keyFn, nextFn, isGoal)) return true;
    seen.delete(k);
  }
  return false;
}
function minStepsIddfs(startNode, keyFn, nextFn, isGoal, maxDepth) {
  for (let limit = 0; limit <= maxDepth; limit++) {
    const seen = new Set([keyFn(startNode)]);
    if (depthSearch(startNode, limit, seen, keyFn, nextFn, isGoal)) return limit;
  }
  return -1;
}

const wgcKey = (n) => n.boat + '|' + WGC_ITEMS.map((x) => (n.left.indexOf(x) >= 0 ? 1 : 0)).join('');
const mcKey = (n) => n.boat + '|' + n.m + ',' + n.c;

/* ══════════════════════ 测试 ══════════════════════ */

test('CORE 导出齐全，两关都能建图', () => {
  for (const fn of ['startState', 'goalState', 'legalMoves', 'levelGraph', 'shortestPath', 'hintNext', 'allSafeStates']) {
    assert.equal(typeof F[fn], 'function', `${fn} 缺失`);
  }
  assert.equal(F.LEVELS.length, 2);
  assert.equal(F.LEVELS.map((l) => l.id).join(','), 'wgc,mc');
  for (const level of F.LEVELS) {
    const g = F.levelGraph(level);
    assert.ok(g.nodes > 0, `${level.id} 状态图为空`);
    assert.equal(typeof g.distance, 'number', `${level.id} 不可达终点`);
  }
});

test('经典最短步数：狼羊菜 7 步、传教士野人 11 步', () => {
  assert.equal(F.shortestDistance(WGC), 7);
  assert.equal(F.shortestDistance(MC), 11);
});

test('独立 IDDFS 复核：7 步可达、6 步不可达；11 步可达、10 步不可达', () => {
  const wgcSteps = minStepsIddfs(
    { left: WGC_ITEMS.slice(), boat: 'L' }, wgcKey, wgcNext,
    (n) => n.left.length === 0 && n.boat === 'R', 9,
  );
  assert.equal(wgcSteps, 7, '狼羊菜独立搜索应得 7 步');
  const mcSteps = minStepsIddfs(
    { m: 3, c: 3, boat: 'L' }, mcKey, mcNext,
    (n) => n.m === 0 && n.c === 0 && n.boat === 'R', 13,
  );
  assert.equal(mcSteps, 11, '传教士野人独立搜索应得 11 步');
  // 页面 BFS 与独立搜索必须一致
  assert.equal(F.shortestDistance(WGC), wgcSteps);
  assert.equal(F.shortestDistance(MC), mcSteps);
});

test('安全状态数与经典结论一致，且与独立枚举相符', () => {
  // 狼羊菜：8 种摆法 × 2 船位，只有 10 个安全
  assert.equal(F.allSafeStates(WGC).length, 10);
  // 传教士：4×4 种 (m,c) × 2 船位，安全 20 个
  assert.equal(F.allSafeStates(MC).length, 20);
  const ids = F.allSafeStates(WGC).map((s) => kOf(WGC, s));
  assert.equal(new Set(ids).size, ids.length, '安全状态有重复');
  // 独立复核狼羊菜：逐个数
  let refCount = 0;
  for (const bits of [0, 1, 2, 3, 4, 5, 6, 7]) {
    const left = WGC_ITEMS.filter((_, i) => (bits >> i) & 1);
    for (const boat of ['L', 'R']) if (wgcSafe(left, boat)) refCount += 1;
  }
  assert.equal(refCount, 10);
});

test('合法移动的终点一定安全；非法移动确实会被规则挡掉', () => {
  for (const level of F.LEVELS) {
    const g = F.levelGraph(level);
    for (const key of g.front.dist.keys()) {
      const s = g.front.keys.get(key);
      for (const mv of F.legalMoves(level, s)) {
        assert.equal(F.unsafeReason(level, mv.next), null, `${level.id} 出现了不安全的合法移动`);
      }
    }
  }
  // 狼羊菜开局：只有「带羊过」合法 —— 带狼/带菜会让无人看守的左岸出现狼+羊 / 羊+菜；
  // 空船过去也不行（农夫一走，狼和羊就单独在一起了）
  const s0 = F.startState(WGC);
  const moves0 = F.legalMoves(WGC, s0);
  const loads0 = moves0.map((m) => JSON.stringify(m.load)).sort().join(' ');
  assert.equal(loads0, JSON.stringify({ sheep: 1 }));
  // 传教士开局（船必须有人划）：1M1C 合法（右岸 1M1C，左岸 2M2C，两岸都平衡）
  const mc0 = F.legalMoves(MC, F.startState(MC));
  assert.ok(mc0.some((m) => m.load.m === 1 && m.load.c === 1), '1M1C 应该合法');
  // 带 2 传教士非法：左岸剩 1M3C，野人多于传教士
  assert.ok(!mc0.some((m) => m.load.m === 2), '带 2 传教士应被规则拒绝');
  // 带 1 传教士非法：左岸 2M3C 野人多于传教士
  assert.ok(!mc0.some((m) => m.load.m === 1 && !m.load.c), '带 1 传教士应被规则拒绝');
  // 带 2 野人合法（右岸 0M2C，左岸 3M1C）
  assert.ok(mc0.some((m) => m.load.c === 2), '带 2 野人应合法');
  // 船必须有人划：传教士关任何状态都不允许空船移动
  for (const level of [MC]) {
    const g = F.levelGraph(level);
    for (const key of g.front.dist.keys()) {
      const s = g.front.keys.get(key);
      for (const mv of F.legalMoves(level, s)) assert.ok(F.loadTotal(mv.load) >= 1, '出现了空船移动');
    }
  }
  // 狼羊菜允许空船（否则 7 步解不成立）：羊到了对岸之后，农夫可以独自划回来
  const afterSheep = moves0.filter((m) => m.load.sheep === 1)[0].next;
  assert.ok(F.legalMoves(WGC, afterSheep).some((m) => F.loadTotal(m.load) === 0), '狼羊菜应允许空船');
});

test('装载组合受「船容」与「岸上数量」双重约束', () => {
  for (const level of F.LEVELS) {
    const g = F.levelGraph(level);
    for (const key of g.front.dist.keys()) {
      const s = g.front.keys.get(key);
      const side = F.countsOn(level, s, s.boat);
      for (const combo of F.loadCombos(level, side)) {
        assert.ok(F.loadTotal(combo) <= level.cap, '装载超过船容');
        for (const grp of level.groups) {
          assert.ok((combo[grp.id] || 0) <= (side[grp.id] || 0), '装了岸上没有的东西');
        }
      }
    }
  }
});

test('状态图是无向图：每条边都可原路返回', () => {
  for (const level of F.LEVELS) {
    const g = F.levelGraph(level);
    for (const key of g.front.dist.keys()) {
      const s = g.front.keys.get(key);
      for (const mv of F.legalMoves(level, s)) {
        const back = F.legalMoves(level, mv.next).filter((m) => m.key === key);
        assert.equal(back.length, 1, `${level.id} 边不可逆：${key} → ${mv.key}`);
        assert.ok(F.sameLoad(level, back[0].load, mv.load), '往返装的东西不一致');
      }
    }
  }
});

test('最短路径逐步合法，长度等于 BFS 距离', () => {
  for (const level of F.LEVELS) {
    const path = F.shortestPath(level);
    assert.equal(path.length, F.shortestDistance(level), `${level.id} 路径长度不对`);
    let s = F.startState(level);
    for (const step of path) {
      const ok = F.legalMoves(level, s).some((m) => F.sameLoad(level, m.load, step.load));
      assert.ok(ok, `${level.id} 路径里出现非法一步`);
      s = F.stepState(level, s, step.load);
    }
    assert.equal(kOf(level, s), goalKey(level), `${level.id} 走完没到目标态`);
  }
});

test('狼羊菜 7 步解含 2 次空船回（农夫独自划回）', () => {
  const path = F.shortestPath(WGC);
  const emptyLegs = path.filter((p) => F.loadTotal(p.load) === 0).length;
  assert.equal(emptyLegs, 2, `应恰有 2 次空船，实际 ${emptyLegs}`);
});

test('提示逐步递减且一定能走到终点', () => {
  for (const level of F.LEVELS) {
    let s = F.startState(level);
    const total = F.shortestDistance(level);
    let guard = 0;
    while (kOf(level, s) !== goalKey(level)) {
      const h = F.hintNext(level, s);
      assert.ok(h, `${level.id} 在 ${kOf(level, s)} 给不出提示`);
      assert.equal(h.remaining, total - guard - 1, '提示的剩余步数不递减');
      assert.ok(F.legalMoves(level, s).some((m) => F.sameLoad(level, m.load, h.move.load)), '提示的走法不合法');
      assert.equal(F.unsafeReason(level, h.move.next), null);
      s = h.move.next;
      guard += 1;
      assert.ok(guard <= 20, '提示链没有收敛');
    }
    assert.equal(guard, total, '提示链长度应等于最短步数');
  }
});

test('提示文案只说这一步，且空船/载物分别有说法', () => {
  const emptyMove = { load: {} };
  assert.match(F.hintText(WGC, F.startState(WGC), emptyMove), /空船过去/);
  const ls = F.shortestPath(WGC)[0].to;
  assert.match(F.hintText(WGC, ls, emptyMove), /空船回来/);
  const carry = F.legalMoves(WGC, F.startState(WGC)).filter((m) => m.load.sheep === 1)[0];
  assert.match(F.hintText(WGC, F.startState(WGC), carry), /把 羊 过去/);
});

test('BFS 层宽自洽：覆盖到最远层，之和等于可达状态数，第 0 层只有出发点', () => {
  for (const level of F.LEVELS) {
    const g = F.levelGraph(level);
    assert.equal(g.layers.length, g.maxDist + 1);
    assert.ok(g.maxDist >= g.distance, '最远层不可能比目标层更浅');
    assert.equal(g.layers[0], 1);
    assert.equal(g.layers.reduce((a, b) => a + b, 0), g.nodes, '层宽之和应等于可达状态数');
    assert.ok(g.layers.every((w) => w >= 1), '中间层不应该出现 0 宽');
    assert.ok(g.distance <= g.layers.length - 1);
  }
  // 目标点必然在最后一层
  const gw = F.levelGraph(WGC);
  assert.equal(gw.front.dist.get(gw.goalKey), gw.distance);
});

test('从目标点反搜得到同一个连通分量（提示用的距离场是对的）', () => {
  for (const level of F.LEVELS) {
    const g = F.levelGraph(level);
    assert.equal(g.sameComponent, true, `${level.id} 正反搜索分量不一致`);
    assert.equal(g.back.dist.get(g.goalKey), 0);
    assert.equal(g.back.dist.get(g.startKey), g.distance, '反向距离与正向距离不等');
  }
});

test('最短路径条数与独立搜索计数一致（小规模可精确验证）', () => {
  // 传教士野人 11 步，状态少，用独立 BFS 计数
  const dist = new Map([[mcKey({ m: 3, c: 3, boat: 'L' }), 0]]);
  const ways = new Map([[mcKey({ m: 3, c: 3, boat: 'L' }), 1]]);
  const queue = [{ m: 3, c: 3, boat: 'L' }];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    const ck = mcKey(cur);
    for (const nx of mcNext(cur)) {
      const nk = mcKey(nx);
      const d = dist.get(ck) + 1;
      if (!dist.has(nk)) { dist.set(nk, d); ways.set(nk, ways.get(ck)); queue.push(nx); }
      else if (dist.get(nk) === d) ways.set(nk, ways.get(nk) + ways.get(ck));
    }
  }
  const g = F.levelGraph(MC);
  assert.equal(g.paths, ways.get('R|0,0'), '最短路径条数与独立 BFS 不一致');
  assert.equal(g.nodes, dist.size, '可达状态数与独立 BFS 不一致');
});

test('环数统计自洽：边 − 顶点 + 1 = 独立环数', () => {
  for (const level of F.LEVELS) {
    const g = F.levelGraph(level);
    assert.equal(g.cycles, g.edges - g.nodes + 1);
    assert.ok(g.cycles >= 1, `${level.id} 至少应有一个环（会出现「绕回来」的走法）`);
    assert.ok(g.nodes <= g.safeStates, '可达状态不可能多于安全状态');
  }
});

test('图论数据：狼羊菜 10 个安全状态全部可达、7 步最短、10 条边 1 个环', () => {
  const g = F.levelGraph(WGC);
  assert.equal(g.nodes, 10);
  assert.equal(g.safeStates, 10);
  assert.equal(g.distance, 7);
  assert.equal(g.edges, 10);
  assert.equal(g.cycles, 1);
});

test('规则差异检验：允许空船时传教士关只要 5 步（页面结算用的就是这个反事实）', () => {
  assert.equal(F.freeBoatDistance(MC), 5);
  assert.equal(F.freeBoatDistance(WGC), 7, '狼羊菜本来就允许空船，反事实结果不变');
});
