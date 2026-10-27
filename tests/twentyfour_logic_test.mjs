// G5 24点逻辑测试。从单文件页面里抽出 TWENTYFOUR CORE 代码块在 VM 里跑，测的是真正上线的那份代码。
// 运行：node --test tests/twentyfour_logic_test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../puzzle/24/index.html', import.meta.url), 'utf8');
const start = html.indexOf('/* === TWENTYFOUR CORE START === */');
const end = html.indexOf('/* === TWENTYFOUR CORE END === */');
assert.ok(start >= 0 && end > start, 'TWENTYFOUR CORE 标记缺失');

const context = vm.createContext({ console });
vm.runInContext(html.slice(start, end), context);
// 顶层 const 不会挂到 globalThis 上，得在同一 context 里再求值一次才拿得到
const F = vm.runInContext(`({
  TARGET24, gcd, rat, ratAdd, ratSub, ratMul, ratDiv, ratIsInt, ratToString,
  solve24, hasSolution, bestSolution, bestSolutionInfo, trimParens, normalizeExpr, tokenize, evalTokens,
  evaluateExpression, numbersIn, sameMultiset, checkAnswer, poolFor, generateHand, handKey
})`, context);

const sorted = (a) => Array.from(a).slice().sort((x, y) => x - y);

// ---------- 独立参考实现（不 import 页面任何代码） ----------
function gcd2(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }
function R(n, d) {
  const den = d === undefined ? 1 : d;
  if (den === 0) return null;
  const s = den < 0 ? -1 : 1;
  const g = gcd2(n, den);
  return { n: (s * n) / g, d: (s * den) / g };
}
const rkey = (r) => `${r.n}/${r.d}`;
const REF_OPS = [
  (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d),
  (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d),
  (a, b) => R(a.n * b.n, a.d * b.d),
  (a, b) => (b.n === 0 ? null : R(a.n * b.d, a.d * b.n)),
];

/** 位集 DP：values[mask] = 用 mask 里的数能算出的全部精确值。与页面「两两合并」是不同算法。 */
function refSolvable(nums) {
  const n = nums.length;
  const values = new Array(1 << n).fill(null);
  for (let i = 0; i < n; i++) values[1 << i] = new Map([[rkey(R(nums[i])), R(nums[i])]]);
  for (let mask = 1; mask < (1 << n); mask++) {
    if (values[mask]) continue;
    const acc = new Map();
    for (let a = (mask - 1) & mask; a > 0; a = (a - 1) & mask) {
      const b = mask ^ a;
      if (!b || !values[a] || !values[b]) continue;
      for (const va of values[a].values()) {
        for (const vb of values[b].values()) {
          for (const op of REF_OPS) {
            const v = op(va, vb);
            if (v && !acc.has(rkey(v))) acc.set(rkey(v), v);
          }
        }
      }
    }
    values[mask] = acc;
  }
  return values[(1 << n) - 1].has('24/1');
}

function allMultisets(max, size) {
  const out = [];
  const cur = [];
  (function rec(start) {
    if (cur.length === size) { out.push(cur.slice()); return; }
    for (let v = start; v <= max; v++) { cur.push(v); rec(v); cur.pop(); }
  })(1);
  return out;
}

/** 页面返回的表达式必须：算出正好 24，且 4 个数字各用一次。 */
function assertValidSolution(expr, nums, label) {
  assert.ok(typeof expr === 'string' && expr.length, `${label} 没返回表达式`);
  const r = F.evaluateExpression(expr);
  assert.ok(!r.error, `${label} 表达式无法求值: ${expr} (${r.error})`);
  assert.equal(r.value.n, 24, `${label} 结果分子不是 24: ${expr}`);
  assert.equal(r.value.d, 1, `${label} 结果不是整数 24: ${expr}`);
  assert.deepEqual(sorted(F.numbersIn(expr)), sorted(nums), `${label} 用数不符: ${expr} vs ${nums}`);
}

// ---------- 分数层 ----------
test('gcd / rat：约分、分母规整为正、除以 0 返回 null', () => {
  assert.equal(F.gcd(12, 18), 6);
  assert.equal(F.gcd(0, 7), 7);
  const half = F.rat(6, 4);
  assert.equal(half.n, 3);
  assert.equal(half.d, 2);
  const neg = F.rat(1, -3);
  assert.equal(neg.n, -1);
  assert.equal(neg.d, 3);
  const zero = F.rat(0, 5);
  assert.equal(zero.n, 0);
  assert.equal(zero.d, 1);
  assert.equal(F.rat(1, 0), null);
});

test('分数四则精确：8 ÷ (3 − 8 ÷ 3) 正好等于 24，不是 23.999999', () => {
  const three = F.rat(3);
  const eight = F.rat(8);
  const inner = F.ratSub(three, F.ratDiv(eight, three));
  assert.equal(inner.n, 1);
  assert.equal(inner.d, 3, '8/3 用浮点算不出 1/3');
  const total = F.ratDiv(eight, inner);
  assert.equal(total.n, 24);
  assert.equal(total.d, 1);
  assert.equal(F.ratToString(total), '24');
  assert.equal(F.ratToString(inner), '1/3');
  assert.equal(F.ratDiv(F.rat(5), F.rat(0)), null, '除以 0 必须返回 null');
});

// ---------- 表达式解析 ----------
test('evaluateExpression：优先级、括号、别名符号、结果精确', () => {
  const cases = [
    ['1+2×3', 7],
    ['(1+2)×3', 9],
    ['1+2*3', 7],
    ['8/(3-8/3)', 24],
    ['8÷(3−8÷3)', 24],
    ['6/(1-3/4)', 24],
    ['(10*10-4)/4', 24],
    ['  2  ×  ( 3 + 9 )  ', 24],
    ['（1+2）×3', 9],
    ['8x3', 24],
  ];
  for (const [text, want] of cases) {
    const r = F.evaluateExpression(text);
    assert.ok(!r.error, `${text} 求值失败: ${r.error}`);
    assert.equal(r.value.n, want, `${text} 得到 ${F.ratToString(r.value)}`);
    assert.equal(r.value.d, 1);
  }
});

test('evaluateExpression：错误要给出人能看懂的原因', () => {
  assert.match(F.evaluateExpression('').error, /先写下算式/);
  assert.match(F.evaluateExpression('1÷0').error, /不能除以 0/);
  assert.match(F.evaluateExpression('8÷(3−3)').error, /不能除以 0/);
  assert.match(F.evaluateExpression('(1+2').error, /括号不配对/);
  assert.match(F.evaluateExpression('1+2)').error, /括号不配对/);
  assert.match(F.evaluateExpression('1+').error, /算式不完整/);
  assert.match(F.evaluateExpression('1a2').error, /不认识/);
  assert.match(F.evaluateExpression('(1+2)×').error, /算式不完整/);
});

// ---------- 求解器 ----------
test('solve24：经典题都能解出来，且返回的表达式自证正确', () => {
  const hands = [[3, 3, 8, 8], [1, 3, 4, 6], [4, 4, 10, 10], [1, 5, 5, 5], [5, 5, 5, 1], [2, 3, 4, 6]];
  for (const nums of hands) {
    const expr = F.bestSolution(nums);
    assertValidSolution(expr, nums, `bestSolution(${nums})`);
    const [first] = F.solve24(nums, 1);
    assert.ok(first, `${nums} 应有解`);
    assertValidSolution(first.expr, nums, `solve24(${nums})`);
  }
});

test('solve24：无解手牌返回空（1,1,1,1 这类）', () => {
  for (const nums of [[1, 1, 1, 1], [1, 1, 2, 3]]) {
    assert.equal(refSolvable(nums), false, `参考实现认为 ${nums} 可解，测试前提不对`);
    assert.equal(F.hasSolution(nums), false, `${nums} 不应有解`);
    assert.equal(F.bestSolution(nums), null);
    assert.deepEqual(Array.from(F.solve24(nums, 5)), []);
  }
});

test('solve24(nums, limit) 尊重上限，返回多条时全部自证正确', () => {
  const nums = [1, 5, 5, 5];
  const many = F.solve24(nums, 40);
  assert.ok(many.length > 1, '这手牌应有多条解');
  assert.ok(many.length <= 40, `超出上限：${many.length}`);
  for (const item of many) assertValidSolution(item.expr, nums, 'solve24 批量');
  assert.equal(F.solve24(nums, 1).length, 1);
});

test('trimParens：剥掉多余外层括号，但不破坏必需的括号', () => {
  assert.equal(F.trimParens('((1+2))'), '1+2');
  assert.equal(F.trimParens('(1+(2×3))'), '1+(2×3)');
  assert.equal(F.trimParens('(1+2)×(3+4)'), '(1+2)×(3+4)');
  assert.equal(F.trimParens('24'), '24');
});

// ---------- 与独立实现全量交叉验证 ----------
test('1–13 全部 1820 种手牌：页面判据与独立位集 DP 完全一致，且每个解都能自证', () => {
  const sets = allMultisets(13, 4);
  assert.equal(sets.length, 1820, '多重集合枚举数量不对');
  let solvable = 0;
  for (const nums of sets) {
    const ref = refSolvable(nums);
    const mine = F.hasSolution(nums);
    assert.equal(mine, ref, `${nums} 页面判 ${mine}，独立实现判 ${ref}`);
    if (ref) {
      solvable++;
      assertValidSolution(F.bestSolution(nums), nums, `bestSolution(${nums})`);
    } else {
      assert.equal(F.bestSolution(nums), null, `${nums} 无解却给了答案`);
    }
  }
  assert.equal(solvable, 1362, `1–13 可解手牌数应为 1362，实测 ${solvable}`);
});

test('1–9 全部 495 种手牌同样一致，可解 404 种', () => {
  const sets = allMultisets(9, 4);
  assert.equal(sets.length, 495);
  let solvable = 0;
  for (const nums of sets) {
    assert.equal(F.hasSolution(nums), refSolvable(nums), `${nums} 判据不一致`);
    if (refSolvable(nums)) solvable++;
  }
  assert.equal(solvable, 404, `1–9 可解手牌数应为 404，实测 ${solvable}`);
});

test('页面里写的统计数字与穷举结果一致（防止文案过期）', () => {
  assert.match(html, /1820/, '规则文案应写明 1–13 共 1820 种手牌');
  assert.match(html, /1362/, '规则文案应写明 1–13 有 1362 种可解');
  assert.match(html, /458/, '规则文案应写明 458 种无解');
  assert.match(html, /all: 495/, '简单档的手牌总数常量应为 495');
  assert.match(html, /solvable: 404/, '简单档的可解数常量应为 404');
});

// ---------- 出题 ----------
test('generateHand：两档难度都只出有解手牌，数值在池内，且不重复', () => {
  for (const difficulty of ['easy', 'classic']) {
    const pool = F.poolFor(difficulty);
    const seen = new Set();
    let prev = null;
    for (let i = 0; i < 120; i++) {
      const hand = F.generateHand(difficulty, Math.random, seen);
      assert.equal(hand.length, 4, '手牌必须 4 张');
      for (const v of hand) assert.ok(pool.includes(v), `${difficulty} 出了池外数字 ${v}: ${hand}`);
      assert.equal(F.hasSolution(hand), true, `出了无解手牌 ${hand}`);
      const key = F.handKey(hand);
      assert.notEqual(key, prev, '连续两次出同一手牌');
      prev = key;
      seen.add(key);
    }
    assert.deepEqual(sorted(F.poolFor('easy')), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(F.poolFor('classic').length, 13);
    assert.equal(F.poolFor('classic')[12], 13);
  }
});

test('generateHand：用固定 rng 可复现，且跳过 seen 里已有的手牌', () => {
  let seed = 20261027;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const a = F.generateHand('easy', rnd, new Set());
  seed = 20261027;
  const b = F.generateHand('easy', rnd, new Set());
  assert.deepEqual(Array.from(a), Array.from(b), '同一 rng 应出同一手牌');
  const skip = new Set([F.handKey(a)]);
  const c = F.generateHand('easy', rnd, skip);
  assert.notEqual(F.handKey(c), F.handKey(a), 'seen 里的手牌不应再出');
});

// ---------- 提交判定 ----------
test('checkAnswer：正确算式通过（含分数中间步与不同记法）', () => {
  assert.equal(F.checkAnswer('8/(3-8/3)', [3, 3, 8, 8]).ok, true);
  assert.equal(F.checkAnswer('6÷(1−3÷4)', [1, 3, 4, 6]).ok, true);
  assert.equal(F.checkAnswer('(10*10-4)/4', [4, 4, 10, 10]).ok, true);
  assert.equal(F.checkAnswer('5*(5-1/5)', [1, 5, 5, 5]).ok, true);
});

test('checkAnswer：少用、重复、添数、值不对、除零都要拦住并说清', () => {
  const hands = [[3, 3, 8, 8]];
  const miss = F.checkAnswer('8*3', hands[0]);
  assert.equal(miss.ok, false);
  assert.match(miss.error, /必须每个正好用一次/);

  // 这手牌里 8 只有两张，用三张必须被拦
  const over = F.checkAnswer('8+8+8-3', hands[0]);
  assert.equal(over.ok, false);
  assert.match(over.error, /必须每个正好用一次/);

  // 手里没有 6，凭空添数也要拦
  const bogus = F.checkAnswer('6+6+6+6', hands[0]);
  assert.equal(bogus.ok, false);
  assert.match(bogus.error, /必须每个正好用一次/);

  const wrong = F.checkAnswer('8+3+3+8', hands[0]);
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /不是 24/);

  const divZero = F.checkAnswer('8/(3-3)+8', hands[0]);
  assert.equal(divZero.ok, false);
  assert.match(divZero.error, /不能除以 0/);

  const empty = F.checkAnswer('', hands[0]);
  assert.equal(empty.ok, false);
  assert.match(empty.error, /先写下算式/);
});

test('checkAnswer：同值手牌里的重复使用是合法的', () => {
  // 手上有两张 8，算式里就该能出现两次 8；8+8+3+5 = 24
  const ok = F.checkAnswer('8+8+3+5', [8, 8, 3, 5]);
  assert.equal(ok.ok, true, ok.error);
  // 但第三张 8 是凭空添的，必须拦住
  const over = F.checkAnswer('8+8+8+5-5', [8, 8, 3, 5]);
  assert.equal(over.ok, false, '多出来的 8 不该通过');
  assert.match(over.error, /必须每个正好用一次/);
});

test('bestSolutionInfo：分数步数要如实统计（决定结算文案说不说「必须用分数」）', () => {
  const needFrac = F.bestSolutionInfo([3, 3, 8, 8]);
  assert.ok(needFrac.fracs >= 1, `8÷(3−8÷3) 必然经过分数，实测 fracs=${needFrac.fracs}`);
  assertValidSolution(needFrac.expr, [3, 3, 8, 8], 'bestSolutionInfo(3,3,8,8)');

  // (5+5)+(6+8) 一步分数都不用，文案里就不能说「只用整数走不通」
  const noFrac = F.bestSolutionInfo([5, 5, 6, 8]);
  assert.equal(noFrac.fracs, 0, `这手牌有纯整数解，不应统计出分数步：${noFrac.expr}`);
  assert.equal(noFrac.divs, 0);
  assertValidSolution(noFrac.expr, [5, 5, 6, 8], 'bestSolutionInfo(5,5,6,8)');

  // 优先挑除法最少的解：手上有纯整数解时不该挑出带除法的
  const mixed = F.bestSolutionInfo([4, 4, 10, 10]);
  assert.ok(mixed.divs >= 1, '(10×10−4)÷4 需要一次除法');
  assert.equal(F.solve24([5, 5, 6, 8], 40).every((s) => typeof s.fracs === 'number'), true, 'solve24 每条解都要带 fracs');
});

test('numbersIn / sameMultiset / normalizeExpr：取数不计运算符与括号', () => {
  assert.deepEqual(sorted(F.numbersIn('8÷(3−8÷3)')), [3, 3, 8, 8]);
  assert.deepEqual(sorted(F.numbersIn('(10×10−4)÷4')), [4, 4, 10, 10]);
  assert.deepEqual(sorted(F.numbersIn('12+12')), [12, 12]);
  assert.equal(F.sameMultiset([3, 8, 8, 3], [8, 3, 8, 3]), true);
  assert.equal(F.sameMultiset([3, 3, 8, 8], [3, 8, 8, 8]), false);
  assert.equal(F.normalizeExpr('8 / (3 - 8 / 3) ='), '8÷(3−8÷3)');
  assert.equal(F.normalizeExpr('2*3x4'), '2×3×4');
});
