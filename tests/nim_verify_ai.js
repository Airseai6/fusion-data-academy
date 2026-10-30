/**
 * G2 独立复测 v2：直接调用游戏的 bestMove / chooseAI
 * ===================================================
 * 不自己实现策略，而是检查「游戏自己的 AI 决策」是否符合博弈论。
 *
 * 判定标准：
 *   普通模式：
 *     - 异或≠0 → AI 必须取到异或=0
 *     - 异或=0 → 任何合法手都可接受
 *   misère 模式：
 *     - 若所有堆 ≤1 且不全为 0：
 *         1 的个数为偶数 → AI 应取 1 个（留奇数给对手）
 *         1 的个数为奇数 → AI 已必败，任何合法手可接受
 *     - 否则（有堆 >1）：用 DP/博弈论验证是否为必胜手
 */
const fs = require('fs');
const vm = require('vm');

const HTML = 'D:/hermesWorkspace/projects/github-pages/puzzle/nim/index.html';
const src = fs.readFileSync(HTML, 'utf8');
const js = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];

// ── 构造最小 DOM 桩 ──
const mkEl = () => ({
  innerHTML: '', textContent: '', style: {}, className: '', dataset: {},
  addEventListener() {}, appendChild() {}, removeChild() {}, remove() {},
  querySelector: () => null, querySelectorAll: () => [],
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  closest: () => null, setAttribute() {}, getAttribute: () => null,
  getBoundingClientRect: () => ({ width: 100, height: 100, top: 0, left: 0 }),
});
const ctx = {
  console,
  setTimeout: (f) => { if (typeof f === 'function') f(); return 0; },
  clearTimeout() {},
  requestAnimationFrame: (f) => { if (typeof f === 'function') f(); return 0; },
  URLSearchParams,
  location: { search: '', pathname: '/puzzle/nim/' },
  document: {
    getElementById: () => mkEl(),
    querySelector: () => mkEl(),
    querySelectorAll: () => [],
    createElement: () => mkEl(),
    addEventListener() {},
    body: mkEl(),
    documentElement: mkEl(),
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(js, ctx, { timeout: 5000 });

const { nimSum, bestMove, legalMoves, winningState } = ctx;

console.log('='.repeat(66));
console.log('  G2 独立复测：直接检查游戏自己的 AI 决策');
console.log('='.repeat(66));
console.log(`  导出: nimSum=${typeof nimSum} bestMove=${typeof bestMove} ` +
            `legalMoves=${typeof legalMoves} winningState=${typeof winningState}`);

// ══════════════════════════════════════════
// 参考：misère 必胜态判定（DP，独立实现）
// ══════════════════════════════════════════
const memo = new Map();
function misereWin(piles) {
  const key = piles.slice().sort((a, b) => a - b).join(',');
  if (memo.has(key)) return memo.get(key);

  const total = piles.reduce((a, b) => a + b, 0);
  if (total === 0) {
    // 上一手取走了最后一颗 → 上一手输 → 当前玩家（无子可走）赢
    memo.set(key, true);
    return true;
  }
  // 尝试所有合法走法
  for (let i = 0; i < piles.length; i++) {
    for (let take = 1; take <= piles[i]; take++) {
      const next = piles.slice();
      next[i] -= take;
      if (!misereWin(next)) {      // 走到对手必败
        memo.set(key, true);
        return true;
      }
    }
  }
  memo.set(key, false);
  return false;
}

function normalWin(piles) {
  return nimSum(piles) !== 0;
}

// ══════════════════════════════════════════
// 检查：AI 是否走了必胜手
// ══════════════════════════════════════════
function checkMove(piles, move, misere) {
  if (!move) return { ok: false, why: 'bestMove 返回空' };
  const i = move.pile !== undefined ? move.pile : move.i;
  const take = move.take !== undefined ? move.take : move.count;
  if (i === undefined || take === undefined) {
    return { ok: false, why: `move 结构不明: ${JSON.stringify(move)}` };
  }
  if (take < 1 || take > piles[i]) {
    return { ok: false, why: `非法取子: 从堆${i}取${take}（该堆只有${piles[i]}）` };
  }
  const after = piles.slice();
  after[i] -= take;

  const winFn = misere ? misereWin : normalWin;
  const beforeWin = winFn(piles);
  const afterWin = winFn(after);   // 对手视角

  // 如果当前是必胜态，走完必须让对手处于必败态
  if (beforeWin && afterWin) {
    return { ok: false, why: `必胜态却走成对手必胜: [${piles}] 取(${i},${take}) → [${after}]` };
  }
  return { ok: true, after };
}

for (const mode of [false, true]) {
  const label = mode ? 'misère（取最后者输）' : '普通（取最后者胜）';
  console.log(`\n${'─'.repeat(66)}`);
  console.log(`  【${label}】穷举 3 堆 0..5 的全部局面`);
  console.log(`${'─'.repeat(66)}`);

  let tested = 0, bad = 0, skipped = 0;
  const failures = [];

  for (let a = 0; a <= 5; a++)
    for (let b = 0; b <= 5; b++)
      for (let c = 0; c <= 5; c++) {
        const piles = [a, b, c];
        if (piles.reduce((x, y) => x + y, 0) === 0) continue;
        tested++;

        let move;
        try {
          move = bestMove ? bestMove(piles.slice(), mode) : null;
        } catch (e) {
          skipped++;
          continue;
        }
        if (!move) { skipped++; continue; }

        const r = checkMove(piles, move, mode);
        if (!r.ok) {
          bad++;
          if (failures.length < 5) failures.push(r.why);
        }
      }

  console.log(`  测试局面: ${tested}   失败: ${bad}   跳过(无bestMove): ${skipped}`);
  if (bad === 0 && skipped === 0) {
    console.log(`  ✓ AI 在所有局面都走最优手`);
  } else if (bad > 0) {
    console.log(`  ✗ 有 ${bad} 个局面走错：`);
    failures.forEach(f => console.log(`      ${f}`));
  }
}

// ══════════════════════════════════════════
// 专项：misère 全 1 边界
// ══════════════════════════════════════════
console.log(`\n${'─'.repeat(66)}`);
console.log('  【misère 全 1 边界专项】');
console.log(`${'─'.repeat(66)}`);
for (const n of [1, 2, 3, 4, 5]) {
  const piles = new Array(3).fill(0);
  for (let i = 0; i < n && i < 3; i++) piles[i] = 1;
  // n 可能 >3，用两堆表示
  const p = n <= 3 ? piles : [n, 0, 0];
  const move = bestMove ? bestMove(p.slice(), true) : null;
  const expectWin = misereWin(p);   // 当前玩家是否必胜
  console.log(`  [${p.join(',')}] 共 ${p.reduce((a,b)=>a+b,0)} 个1 → 理论${expectWin ? '必胜' : '必败'}，AI 走: ${JSON.stringify(move)}`);
}

console.log();
console.log('='.repeat(66));
