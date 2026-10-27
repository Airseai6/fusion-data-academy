// G8 聚变堆叠逻辑测试。从单文件页面里抽出 FUSION CORE 在 VM 里跑 —— 测的是真正上线的那份代码。
// 运行：node --test tests/fusion_logic_test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../puzzle/fusion-stack/index.html', import.meta.url), 'utf8');
const start = html.indexOf('/* === FUSION CORE START === */');
const end = html.indexOf('/* === FUSION CORE END === */');
assert.ok(start >= 0 && end > start, 'FUSION CORE 标记缺失');

const context = vm.createContext({ console, Math, Number, Array, JSON });
vm.runInContext(html.slice(start, end), context);
const C = vm.runInContext(`({
  SIZE, LADDER, MAX_LEVEL, TARGET_EV, GOALS_EV, SEMF,
  semfBinding, fusionQ, beyondTopQ, mostBoundZ, bindingCurve, laddersBinding,
  emptyBoard, linesOf, collapseLine, moveBoard, canMove, emptyCells, spawnTile,
  initialBoard, formatEnergy, formatMev, progressPct, topLevel, goalLabel, nextGoal
})`, context);

/* ═════════ 1. 物理：Q 值与实验锚点 ═════════ */
test('聚变链 Q 值与已知反应一致（2D→⁴He = 23.85 MeV）', () => {
  const q = level => Number(C.fusionQ(level).toFixed(4));
  assert.equal(q(1), 23.8465, '2D → ⁴He 应为 23.85 MeV');
  // 质量数 8 空档：⁸Be 比两个 α 高 0.0918 MeV
  assert.ok(Math.abs(q(2) - (-0.0919)) < 0.01, `2α → ⁸Be 应≈ −0.09，实际 ${q(2)}`);
  assert.ok(Math.abs(q(3) - 14.6203) < 0.05, `2 ⁸Be → ¹⁶O ≈ 14.62，实际 ${q(3)}`);
  assert.ok(Math.abs(q(4) - 16.5424) < 0.05, `2 ¹⁶O → ³²S ≈ 16.54，实际 ${q(4)}`);
  // 顶牌那一步没有实验值，用半经验公式，但必须落在合理区间
  assert.ok(q(5) > 15 && q(5) < 30, `2 ³²S → ⁶⁴Ni 应在 15–30 MeV，实际 ${q(5)}`);
  assert.equal(C.fusionQ(0), null);
  assert.equal(C.fusionQ(C.MAX_LEVEL), null, '顶牌不能再融合');
});

test('每一步合并的 Q 都等于结合能差（账本自洽）', () => {
  for (let lv = 1; lv < C.MAX_LEVEL; lv++) {
    const a = C.LADDER[lv - 1], b = C.LADDER[lv];
    assert.ok(Math.abs(C.fusionQ(lv) - (b.B - 2 * a.B)) < 1e-9, `level ${lv} Q 与 B 不一致`);
  }
});

test('半经验公式在实验锚点上误差可控（<6 MeV）', () => {
  const anchors = [
    { A: 4, Z: 2, B: 28.2957 },
    { A: 16, Z: 8, B: 127.6193 },
    { A: 32, Z: 16, B: 271.7810 },
  ];
  const rows = [];
  for (const a of anchors) {
    const calc = C.semfBinding(a.A, a.Z);
    rows.push(`${a.A}: 公式 ${calc.toFixed(2)} / 实验 ${a.B}`);
    assert.ok(Math.abs(calc - a.B) < 6, `${a.A} 号核偏差过大：${calc.toFixed(2)} vs ${a.B}`);
  }
  // 小核上公式很差是已知事实，这里只记录，不作硬断言
  console.log('    SEMF vs 实验:', rows.join(' | '));
});

test('铁峰：过了顶牌就是吸能，且曲线峰值落在铁/镍区', () => {
  const beyond = C.beyondTopQ();
  assert.ok(beyond.q < -20, `2 ⁶⁴Ni 融合应明显吸能，实际 ${beyond.q.toFixed(2)} MeV`);
  const curve = C.bindingCurve(2, 130);
  const peak = curve.reduce((m, p) => (p.per > m.per ? p : m), curve[0]);
  assert.ok(peak.A >= 50 && peak.A <= 72, `每核子结合能峰值应在 A≈56–64，实际 A=${peak.A}`);
  // 稳定谷：A=56 最稳定同量异位素是 Fe（Z=26）
  assert.equal(C.mostBoundZ(56), 26, 'A=56 的稳定谷应落在 Z=26（铁）');
});

/* ═════════ 2. 滑动合并：与独立实现逐一对比 ═════════ */
const DIRS = ['left', 'right', 'up', 'down'];

/** 独立参考实现：先重力压缩到底，再单次相邻合并，再重力压缩。不复用页面任何函数。 */
function refMove(board, dir, n) {
  const b = board.slice();
  const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
  const [dr, dc] = delta;
  const gravity = () => {
    let moved = false, again = true;
    while (again) {
      again = false;
      for (let r = n - 1; r >= 0; r--) {
        for (let c = n - 1; c >= 0; c--) {
          const i = r * n + c;
          if (!b[i]) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          const t = nr * n + nc;
          if (b[t] === 0) { b[t] = b[i]; b[i] = 0; moved = true; again = true; }
        }
      }
    }
    return moved;
  };
  // 合并：从移动方向的「远端」往回扫，避免一个核连续吃两次
  const order = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) order.push([r, c]);
  if (dr === 1) order.sort((x, y) => y[0] - x[0]);
  if (dr === -1) order.sort((x, y) => x[0] - y[0]);
  if (dc === 1) order.sort((x, y) => y[1] - x[1]);
  if (dc === -1) order.sort((x, y) => x[1] - y[1]);

  let moved = gravity();
  const merged = new Set();
  const merges = [];
  let blockedPair = 0;
  for (const [r, c] of order) {
    const i = r * n + c;
    if (!b[i] || merged.has(i)) continue;
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
    const t = nr * n + nc;
    if (b[t] !== b[i]) continue;
    if (b[i] >= C.MAX_LEVEL) { blockedPair++; continue; }
    merges.push({ from: b[i], to: b[i] + 1, q: C.fusionQ(b[i]) });
    b[t] = b[i] + 1;
    b[i] = 0;
    merged.add(t);
  }
  gravity();
  return { board: b, merges, blockedPair };
}

function randBoard(rng) {
  const b = C.emptyBoard(4);
  for (let i = 0; i < b.length; i++) {
    const r = rng();
    b[i] = r < 0.28 ? 0 : Math.min(C.MAX_LEVEL, 1 + Math.floor(rng() * C.MAX_LEVEL));
  }
  return b;
}
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

test('随机棋盘 4 方向 × 800 局：棋盘结果与独立实现完全一致', () => {
  const rng = lcg(20261027);
  for (let t = 0; t < 800; t++) {
    const board = randBoard(rng);
    for (const dir of DIRS) {
      const got = C.moveBoard(board, dir, 4);
      const ref = refMove(board, dir, 4);
      assert.deepEqual(got.board, ref.board, `dir=${dir} board=${board.join(',')}`);
      assert.equal(got.merges.length, ref.merges.length, `dir=${dir} 合并次数`);
      assert.equal(got.moved, JSON.stringify(got.board) !== JSON.stringify(board));
    }
  }
});

test('边界：同一步里一个核不会被合并两次', () => {
  const L = (arr) => arr; // 便于阅读
  const run = (row, dir = 'left') => {
    const b = C.emptyBoard(4);
    L(row).forEach((v, i) => { b[i] = v; });
    return C.moveBoard(b, dir, 4);
  };
  // [1,1,1,1] → [2,2]
  assert.deepEqual(run([1, 1, 1, 1]).board.slice(0, 4), [2, 2, 0, 0]);
  // [1,1,1] → [2,1]
  assert.deepEqual(run([1, 1, 1, 0]).board.slice(0, 4), [2, 1, 0, 0]);
  // [1,2,2] → [1,3]（先到先合，不能跳位）
  assert.deepEqual(run([1, 2, 2, 0]).board.slice(0, 4), [1, 3, 0, 0]);
  // [2,1,1] → [2,2]
  assert.deepEqual(run([2, 1, 1, 0]).board.slice(0, 4), [2, 2, 0, 0]);
  // 不同级不合并
  assert.deepEqual(run([1, 2, 3, 4]).board.slice(0, 4), [1, 2, 3, 4]);
  assert.equal(run([1, 2, 3, 4]).moved, false, '满行无同级时不该算移动');
});

test('顶牌不融合：两个 ⁶⁴Ni 只会并排，并上报 blockedPair', () => {
  const b = C.emptyBoard(4);
  b[0] = C.MAX_LEVEL; b[1] = C.MAX_LEVEL;
  const res = C.moveBoard(b, 'left', 4);
  assert.deepEqual(res.board.slice(0, 4), [C.MAX_LEVEL, C.MAX_LEVEL, 0, 0]);
  assert.equal(res.merges.length, 0);
  assert.equal(res.q, 0);
  assert.equal(res.blockedPair, 1);
});

test('一次移动的能量 = 各次合并 Q 之和（eV 账要能对上）', () => {
  const b = [1, 1, 2, 2, 3, 3, 0, 0, 4, 4, 0, 0, 5, 5, 0, 0];
  const res = C.moveBoard(b, 'left', 4);
  const manual = res.merges.reduce((s, m) => s + C.fusionQ(m.from), 0);
  assert.ok(Math.abs(res.q - manual) < 1e-9);
  // 四行各有一对同级核：1+1、2+2、3+3、5+5（5 级仍可融合到顶牌 6 级）
  assert.equal(res.merges.length, 5);
});

/* ═════════ 3. 终局判定 ═════════ */
function refCanMove(board, n) {
  for (const dir of DIRS) if (refMove(board, dir, n).merges.length) return true;
  if (board.some(v => v === 0)) return true;
  return false;
}

test('canMove 与「穷举四方向是否产生合并」的独立判定一致', () => {
  const rng = lcg(7);
  for (let t = 0; t < 600; t++) {
    const board = randBoard(rng);
    const filled = rng() < 0.5 ? board.map(v => v || 1 + Math.floor(rng() * C.MAX_LEVEL)) : board;
    assert.equal(C.canMove(filled, 4), refCanMove(filled, 4), `board=${filled.join(',')}`);
  }
  const full = new Array(16).fill(0).map((_, i) => 1 + (i % 6));
  // 交替满盘没有任何相邻同级 → 死局
  const checker = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) checker.push(((r + c) % 2) ? 1 : 2);
  assert.equal(C.canMove(checker, 4), false, '交替盘应为死局');
  assert.ok(full.length === 16);
});

/* ═════════ 4. 生成与初始盘 ═════════ */
test('补核只补 1/2 级，且只落在空位', () => {
  const rng = lcg(99);
  for (let t = 0; t < 300; t++) {
    const board = C.emptyBoard(4);
    for (let i = 0; i < 16; i++) board[i] = rng() < 0.5 ? 0 : 1 + Math.floor(rng() * 3);
    const before = C.emptyCells(board);
    if (!before.length) continue;
    const res = C.spawnTile(board, rng);
    assert.ok([1, 2].includes(res.level), '只允许氘(1)或氦灰(2)');
    assert.equal(board[res.at], 0, '必须落在空位');
    assert.equal(res.board[res.at], res.level);
    assert.equal(C.emptyCells(res.board).length, before.length - 1);
  }
  // 满盘不补
  const full = new Array(16).fill(1);
  const res = C.spawnTile(full, rng);
  assert.equal(res.at, -1);
  assert.deepEqual(res.board, full);
});

test('初始棋盘恰好两个核，且一定有走法', () => {
  const rng = lcg(2026);
  for (let t = 0; t < 100; t++) {
    const b = C.initialBoard(rng);
    assert.equal(b.filter(v => v).length, 2);
    assert.ok(C.canMove(b, 4));
  }
});

/* ═════════ 5. 读数格式 ═════════ */
test('能量读数用 SI 前缀（1.00 GeV 而不是 1000 MeV）', () => {
  assert.equal(C.formatEnergy(0), '0 eV');
  assert.equal(C.formatEnergy(2.3846e7), '23.85 MeV');
  assert.equal(C.formatEnergy(1e9), '1.00 GeV');
  assert.equal(C.formatEnergy(9.99e8), '999.00 MeV');
  assert.equal(C.formatEnergy(-9e4), '−90.0 keV');
  assert.equal(C.formatMev(-0.0919), '−0.09 MeV');
  assert.equal(C.formatMev(23.8461), '+23.85 MeV');
  assert.equal(C.progressPct(5e8), 50);
  assert.equal(C.progressPct(2e9), 100);
  assert.equal(C.progressPct(-5), 0);
  assert.equal(C.progressPct(5e8, 2e9), 25, '换档后进度按新目标算');
});

test('目标档位：1 GeV 通关后只抬到 2 GeV（不虚标 10 GeV）', () => {
  assert.equal(C.GOALS_EV.length, 2, '只设两档目标');
  assert.equal(C.GOALS_EV[0], 1e9);
  assert.equal(C.GOALS_EV[1], 2e9);
  assert.equal(C.nextGoal(1e9), 2e9);
  assert.equal(C.nextGoal(2e9), null, '最后一档没有下一档');
  assert.equal(C.goalLabel(1e9), '目标 1.00 GeV（10⁹ eV）');
  assert.equal(C.goalLabel(2e9), '目标 2.00 GeV（2×10⁹ eV）');
});

/* ═════════ 6. 难度：目标 10⁹ eV 到底几步能到 ═════════ */
const SNAKE = [
  [15, 14, 13, 12],
  [8, 9, 10, 11],
  [7, 6, 5, 4],
  [0, 1, 2, 3],
];

function heuristic(board, n) {
  let s = 0, empties = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = board[r * n + c];
      if (!v) { empties++; continue; }
      s += Math.pow(v, 2.4) * (1 + SNAKE[r][c] / 40);
    }
  }
  return s + empties * 22;
}

function botGame(seed) {
  const rng = lcg(seed);
  let board = C.initialBoard(rng);
  let energy = 0, moves = 0;
  while (moves < 4000) {
    let best = null;
    for (const dir of DIRS) {
      const res = C.moveBoard(board, dir, 4);
      if (!res.moved) continue;
      const s = heuristic(res.board, 4) + res.q * 0.4;
      if (!best || s > best.s) best = { s, res };
    }
    if (!best) return { energy, moves, top: C.topLevel(board), dead: true };
    board = best.res.board;
    energy += best.res.q * 1e6;
    moves++;
    if (energy >= C.TARGET_EV) return { energy, moves, top: C.topLevel(board), dead: false };
    board = C.spawnTile(board, rng).board;
  }
  return { energy, moves, top: C.topLevel(board), dead: false };
}

test('难度：贪心 bot 能稳定摸到 10⁹ eV，但不是白给', () => {
  const runs = [];
  for (let s = 1; s <= 120; s++) runs.push(botGame(s * 7919));
  const wins = runs.filter(r => r.energy >= C.TARGET_EV);
  const movesOfWins = wins.map(r => r.moves).sort((a, b) => a - b);
  const median = movesOfWins.length ? movesOfWins[Math.floor(movesOfWins.length / 2)] : null;
  const winRate = wins.length / runs.length;
  const tops = runs.map(r => r.top);
  console.log(`    bot 通关率 ${(winRate * 100).toFixed(0)}% · 通关步数中位数 ${median} · ` +
    `步数区间 ${movesOfWins[0]}–${movesOfWins[movesOfWins.length - 1]} · 最高牌分布 ${JSON.stringify(countBy(tops))}`);
  assert.ok(winRate >= 0.6, `通关率过低（${(winRate * 100).toFixed(0)}%），目标可能不可达`);
  assert.ok(median >= 40, `中位 ${median} 步就到目标，太容易，目标该上调`);
  assert.ok(median <= 400, `中位 ${median} 步太漫长，难度不合理`);
});

function countBy(arr) {
  const m = {};
  for (const v of arr) m[v] = (m[v] || 0) + 1;
  return m;
}

/* ═════════ 7. 一局完整对局：能量必须逐笔等于账本 ═════════ */
test('整局跑完，累计能量 = 所有合并 Q 之和（无漂移）', () => {
  const rng = lcg(424242);
  let board = C.initialBoard(rng);
  let energyEv = 0, ledger = 0, steps = 0;
  while (steps < 600 && C.canMove(board, 4)) {
    const dir = DIRS[Math.floor(rng() * 4)];
    const res = C.moveBoard(board, dir, 4);
    if (!res.moved) { steps++; continue; }
    energyEv += res.q * 1e6;
    ledger += res.merges.reduce((s, m) => s + m.q, 0) * 1e6;
    board = C.spawnTile(res.board, rng).board;
    steps++;
  }
  assert.ok(Math.abs(energyEv - ledger) < 1e-6, `能量漂移：${energyEv} vs ${ledger}`);
  assert.ok(steps > 0);
});
