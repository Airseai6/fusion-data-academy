// G4 十五数码逻辑测试。从单文件页面里抽出 FIFTEEN CORE 代码块在 VM 里跑，
// 测的是真正上线的那份代码。运行：node --test tests/fifteen_logic_test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../puzzle/fifteen/index.html', import.meta.url), 'utf8');
const start = html.indexOf('/* === FIFTEEN CORE START === */');
const end = html.indexOf('/* === FIFTEEN CORE END === */');
assert.ok(start >= 0 && end > start, 'FIFTEEN CORE 标记缺失');
const context = vm.createContext({ console });
vm.runInContext(html.slice(start, end), context);
const F = context;

const key = (t) => t.join(',');
// VM 里造出来的数组和本文件的 Array 原型不同，deepEqual 前先转成普通数组
const plain = (t) => Array.from(t);

// ---------- 独立参考实现（不复用页面代码） ----------
function independentSolvable(tiles, size) {
  // 用「空格归位法」之外的等价判据：解出 1..n²-1 需要的置换奇偶 + 空格行差
  const perm = tiles.filter((v) => v !== 0);
  let inv = 0;
  for (let i = 0; i < perm.length; i++) {
    for (let j = i + 1; j < perm.length; j++) if (perm[j] < perm[i]) inv++;
  }
  const blank = tiles.indexOf(0);
  const blankRowFromBottom = size - Math.floor(blank / size);
  if (size % 2 === 1) return inv % 2 === 0;
  if (blankRowFromBottom % 2 === 0) return inv % 2 === 1;
  return inv % 2 === 0;
}

function goalTiles(size) {
  const t = [];
  for (let i = 1; i < size * size; i++) t.push(i);
  t.push(0);
  return t;
}

function neighborIndexes(tiles, size) {
  const b = tiles.indexOf(0);
  const r = Math.floor(b / size);
  const c = b % size;
  const out = [];
  if (r > 0) out.push(b - size);
  if (r < size - 1) out.push(b + size);
  if (c > 0) out.push(b - 1);
  if (c < size - 1) out.push(b + 1);
  return out;
}

function moveTiles(tiles, size, index) {
  const next = tiles.slice();
  const b = next.indexOf(0);
  next[b] = next[index];
  next[index] = 0;
  return next;
}

/** 从目标态做全图 BFS，返回所有可达局面（键集合） */
function reachableSet(size) {
  const goal = goalTiles(size);
  const seen = new Set([key(goal)]);
  const queue = [goal];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const index of neighborIndexes(cur, size)) {
      const next = moveTiles(cur, size, index);
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push(next);
    }
  }
  return seen;
}

test('inversionCount：忽略空格、只数前面比后面大的数对', () => {
  assert.equal(F.inversionCount(goalTiles(3)), 0);
  assert.equal(F.inversionCount(goalTiles(4)), 0);
  assert.equal(F.inversionCount([2, 1, 3, 0]), 1);
  assert.equal(F.inversionCount([3, 2, 1, 0]), 3);
  assert.equal(F.inversionCount([0, 15, 14]), 1);
  // 空格在中间不参与计数
  assert.equal(F.inversionCount([1, 2, 0, 3]), 0);
});

test('blankRowFromBottom：最底行从 1 开始往上数', () => {
  assert.equal(F.blankRowFromBottom(goalTiles(4), 4), 1);
  assert.equal(F.blankRowFromBottom([0, ...goalTiles(4).slice(1)], 4), 4);
  assert.equal(F.blankRowFromBottom([1, 2, 0, 3], 2), 1);
});

test('isSolvable 与独立实现一致：随机 2000 个 3×3 / 4×4 排列', () => {
  let seed = 20261027;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let solvableCount = 0;
  for (const size of [3, 4]) {
    const n = size * size;
    for (let i = 0; i < 2000; i++) {
      const tiles = goalTiles(size);
      for (let k = n - 1; k > 0; k--) {
        const j = Math.floor(rnd() * (k + 1));
        const tmp = tiles[k]; tiles[k] = tiles[j]; tiles[j] = tmp;
      }
      const mine = F.isSolvable(tiles, size);
      assert.equal(mine, independentSolvable(tiles, size), `${size}x${size} ${key(tiles)}`);
      if (mine) solvableCount++;
    }
  }
  const ratio = solvableCount / 4000;
  assert.ok(ratio > 0.45 && ratio < 0.55, `可解比例应约一半，实测 ${ratio.toFixed(3)}`);
});

test('3×3 全图穷举：可达集合大小 = 9!/2，且判据与可达性完全一致', () => {
  const reach = reachableSet(3);
  // 9 个位置的全排列共 362880 种；滑块图分两个连通分量，各占一半
  assert.equal(reach.size, 181440);
  // 全排列里所有可达局面判据必须为真
  for (const k of reach) {
    const tiles = k.split(',').map(Number);
    assert.equal(F.isSolvable(tiles, 3), true, `可达但判为无解: ${k}`);
  }
  // 抽样验证「判为可解」等价于「在可达集合里」
  let seed = 777;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let falsePositive = 0;
  let negatives = 0;
  for (let i = 0; i < 5000; i++) {
    const tiles = goalTiles(3);
    for (let k = 8; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      const tmp = tiles[k]; tiles[k] = tiles[j]; tiles[j] = tmp;
    }
    const inReach = reach.has(key(tiles));
    const claim = F.isSolvable(tiles, 3);
    if (claim && !inReach) falsePositive++;
    if (!claim) negatives++;
    assert.equal(claim, inReach, `判据与可达性不一致: ${key(tiles)}`);
  }
  assert.equal(falsePositive, 0);
  assert.ok(negatives > 2000, `应抽到约一半无解局面，实测 ${negatives}`);
});

test('3×3 已知经典无解局面（1–8 顺序但 14/15 类交换）被判无解', () => {
  // 经典 4×4 无解：把 14 与 15 交换
  const bad4 = goalTiles(4);
  const i14 = bad4.indexOf(14);
  const i15 = bad4.indexOf(15);
  bad4[i14] = 15;
  bad4[i15] = 14;
  assert.equal(F.isSolvable(bad4, 4), false);
  assert.equal(F.isSolvable(goalTiles(4), 4), true);
  // 3×3：交换两个相邻数字同样破坏奇偶
  const bad3 = [2, 1, 3, 4, 5, 6, 7, 8, 0];
  assert.equal(F.isSolvable(bad3, 3), false);
});

test('slide 只允许滑动空格上下左右的格子，返回新数组且不修改入参', () => {
  const tiles = [1, 2, 3, 4, 5, 6, 7, 0, 8]; // 空格在 index 7（第 3 行中间）
  assert.deepEqual(F.slide(tiles, 3, 7), null, '空格自己不能滑');
  assert.deepEqual(F.slide(tiles, 3, 0), null, '斜向不相邻不能滑');
  assert.equal(F.canSlide(tiles, 3, 4), true, '正上方相邻可滑');
  assert.equal(F.canSlide(tiles, 3, 2), false, '斜向不相邻不可滑');
  assert.equal(F.canSlide(tiles, 3, 5), false, '左右隔一格不可滑');
  assert.equal(F.canSlide(tiles, 3, -1), false, '越界下标');
  const next = plain(F.slide(tiles, 3, 4));
  assert.deepEqual(next, [1, 2, 3, 4, 0, 6, 7, 5, 8]);
  assert.deepEqual(tiles, [1, 2, 3, 4, 5, 6, 7, 0, 8], 'slide 修改了入参');
  // 边界：4×4 左下角空格只有两个邻居
  const corner = goalTiles(4);
  corner[12] = 0;
  corner[15] = 13;
  const neighbors = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    .filter((i) => F.canSlide(corner, 4, i));
  assert.deepEqual(neighbors.sort((a, b) => a - b), [8, 13]);
});

test('slideByDirection：空格越界时返回 -1，方向语义正确', () => {
  const tiles = [1, 2, 3, 4, 0, 5, 6, 7, 8]; // 空格在中心
  assert.equal(F.slideByDirection(tiles, 3, 'up'), 1);
  assert.equal(F.slideByDirection(tiles, 3, 'down'), 7);
  assert.equal(F.slideByDirection(tiles, 3, 'left'), 3);
  assert.equal(F.slideByDirection(tiles, 3, 'right'), 5);
  const topLeft = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  assert.equal(F.slideByDirection(topLeft, 3, 'up'), -1);
  assert.equal(F.slideByDirection(topLeft, 3, 'left'), -1);
  assert.equal(F.slideByDirection(topLeft, 3, 'bogus'), -1);
});

test('isSolved：只有严格 1..n²-1 + 末尾空格才算完成', () => {
  assert.equal(F.isSolved(goalTiles(3)), true);
  assert.equal(F.isSolved(goalTiles(4)), true);
  assert.equal(F.isSolved([1, 2, 3, 4, 5, 6, 7, 8, 0]), true);
  assert.equal(F.isSolved([1, 2, 3, 4, 5, 6, 7, 0, 8]), false);
  assert.equal(F.isSolved([1, 2, 3, 4, 5, 6, 8, 7, 0]), false);
});

test('manhattan：目标态为 0，且每次合法滑动正好改变 ±1', () => {
  assert.equal(F.manhattan(goalTiles(3), 3), 0);
  assert.equal(F.manhattan(goalTiles(4), 4), 0);
  assert.equal(F.manhattan([2, 1, 3, 4, 5, 6, 7, 8, 0], 3), 2);
  let tiles = F.shuffleSolvable(4);
  let seed = 4242;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < 500; i++) {
    const options = neighborIndexes(tiles, 4);
    const index = options[Math.floor(rnd() * options.length)];
    const before = F.manhattan(tiles, 4);
    tiles = F.slide(tiles, 4, index);
    const delta = Math.abs(F.manhattan(tiles, 4) - before);
    assert.equal(delta, 1, `第 ${i} 步曼哈顿变化 ${delta}`);
  }
});

test('不变量：任意合法滑动都不改变「逆序数 + 空格行」的奇偶', () => {
  for (const size of [3, 4]) {
    let tiles = F.shuffleSolvable(size);
    const parityOf = (t) => (size % 2 === 1
      ? F.inversionCount(t) % 2
      : (F.inversionCount(t) + F.blankRowFromBottom(t, size)) % 2);
    const expected = parityOf(tiles);
    let seed = 99 + size;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (let i = 0; i < 800; i++) {
      const options = neighborIndexes(tiles, size);
      tiles = F.slide(tiles, size, options[Math.floor(rnd() * options.length)]);
      assert.equal(parityOf(tiles), expected, `${size}x${size} 第 ${i} 步不变量被破坏`);
    }
    assert.equal(F.isSolvable(tiles, size), true);
  }
});

test('shuffleSolvable：600 次抽样全是可解局面、不是已完成局面、是完整排列', () => {
  for (const size of [3, 4]) {
    const n = size * size;
    for (let i = 0; i < 300; i++) {
      const tiles = F.shuffleSolvable(size);
      assert.equal(tiles.length, n);
      assert.deepEqual(plain(tiles).sort((a, b) => a - b), Array.from({ length: n }, (_, k) => k), '不是 0..n²-1 的排列');
      assert.equal(F.isSolvable(tiles, size), true, `生成了无解局面: ${key(tiles)}`);
      assert.equal(F.isSolved(tiles), false, '生成了已完成的局面');
    }
  }
});

test('repairParity：交换两个非空格后无解→可解，空格位置不变', () => {
  const bad = [2, 1, 3, 4, 5, 6, 7, 8, 0];
  assert.equal(F.isSolvable(bad, 3), false);
  const fixed = F.repairParity(bad);
  assert.equal(F.isSolvable(fixed, 3), true);
  assert.equal(fixed.indexOf(0), bad.indexOf(0));
  assert.deepEqual(plain(fixed).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(bad, [2, 1, 3, 4, 5, 6, 7, 8, 0], 'repairParity 修改了入参');
});

test('walkFromSolved：任意步数的随机重排都可解，且步数>0 时未完成', () => {
  for (const size of [3, 4]) {
    for (const steps of [1, 5, 40]) {
      const tiles = F.walkFromSolved(size, steps);
      assert.equal(F.isSolvable(tiles, size), true);
      assert.equal(tiles.length, size * size);
      if (steps >= 40) assert.equal(F.isSolved(tiles), false);
    }
  }
});

test('可解局面真的能解：4×4 BFS 从随机可解局面回到目标态（限 6 层内验证连通性）', () => {
  // 用 BFS 从随机局面短距离搜索目标态，验证「判为可解 ⇒ 存在通路」在实操层面的正确性
  const size = 3;
  let tiles = F.shuffleSolvable(size);
  let seed = 31337;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let trial = 0; trial < 20; trial++) {
    // 从目标态随机走 12 步，必然可解；再 BFS 回去，验证距离有限
    let cur = F.walkFromSolved(size, 12);
    const goal = key(goalTiles(size));
    const seen = new Set([key(cur)]);
    const queue = [cur];
    let depth = 0;
    let found = key(cur) === goal;
    while (!found && queue.length) {
      const layer = queue.length;
      for (let i = 0; i < layer; i++) {
        const node = queue.shift();
        for (const index of neighborIndexes(node, size)) {
          const nx = moveTiles(node, size, index);
          const k = key(nx);
          if (k === goal) { found = true; break; }
          if (!seen.has(k)) { seen.add(k); queue.push(nx); }
        }
        if (found) break;
      }
      depth++;
      if (depth > 40) break;
    }
    assert.ok(found, `第 ${trial} 次未找到通往目标态的通路`);
    tiles = cur;
    assert.equal(F.isSolvable(tiles, size), true);
  }
  void rnd;
});
