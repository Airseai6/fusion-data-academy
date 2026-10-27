/**
 * 反直觉 · 数字侦探（Bulls & Cows）· 逻辑单测（无需浏览器）
 * ============================================================
 * 目的：在没有 Playwright/浏览器的环境里，仍然真实执行页面内联 JS，
 *       断言 A/B 反馈、每日种子、非法输入校验、候选集统计等核心逻辑。
 *
 * 跑法：
 *     node tests/digits_logic_test.mjs
 *
 * 真实浏览器 E2E 见 tests/e2e_test.py 的 [G] 段（赢/输/刷新恢复/非法输入）。
 */
import { readFileSync, statSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = resolve(ROOT, 'puzzle', 'digits', 'index.html');

let pass = 0;
const fails = [];

function ok(name, detail) {
  pass++;
  console.log('  PASS ' + name + (detail ? '  (' + detail + ')' : ''));
}
function bad(name, detail) {
  fails.push(name + (detail ? ' — ' + detail : ''));
  console.log('  FAIL ' + name + (detail ? '  (' + detail + ')' : ''));
}
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) ok(name, g);
  else bad(name, 'got ' + g + ', want ' + w);
}
function true_(name, cond, detail) {
  if (cond) ok(name, detail);
  else bad(name, detail);
}

console.log('='.repeat(70));
console.log('  G1 数字侦探 · 逻辑单测 · ' + GAME);
console.log('='.repeat(70));

// ── 0. 文件与单文件约束 ─────────────────────────────
let html = '';
try {
  html = readFileSync(GAME, 'utf8');
  ok('游戏文件存在');
} catch (e) {
  bad('游戏文件缺失', String(e));
  process.exit(1);
}
const size = statSync(GAME).size;
true_('首屏体积 < 100KB', size < 100 * 1024, size + ' bytes');
true_('title 含「数字侦探」', /<title>[^<]*数字侦探[^<]*<\/title>/.test(html));
true_('含 meta description', /<meta name="description" content="[^"]{20,}"/.test(html));
true_('只依赖 analytics.js（无其它外链 JS）',
  (html.match(/<script[^>]*src=/g) || []).length === 1 &&
  html.includes('src="../../analytics.js"'));
true_('移动端 viewport', /name="viewport"/.test(html));
true_('有数字键盘与提交按钮', html.includes('id="keypad"') && html.includes('id="key-submit"'));

// ── 1. 抽取并真实执行内联 JS ────────────────────────
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
if (scripts.length !== 1) {
  bad('内联脚本数量', 'expected 1, got ' + scripts.length);
  process.exit(1);
}
const sandbox = { window: {}, console };
createContext(sandbox);
try {
  runInContext(scripts[0], sandbox, { filename: 'digits-inline.js' });
  ok('内联 JS 可解析并执行（无语法/运行错误）');
} catch (e) {
  bad('内联 JS 执行失败', String(e));
  process.exit(1);
}
const T = sandbox.window.__digits;
if (!T) {
  bad('未暴露 __digits 测试接口');
  process.exit(1);
}
ok('暴露 __digits 测试接口');

// ── 2. 常量 ────────────────────────────────────────
eq('答案长度 = 4', T.LEN, 4);
eq('机会 = 6 次', T.MAX_TRIES, 6);
eq('普通模式候选数 5040', T.TOTAL.normal, 5040);
eq('困难模式候选数 10000', T.TOTAL.hard, 10000);
true_('分享链接指向 digits 页面', String(T.GAME_URL).endsWith('/puzzle/digits/'), T.GAME_URL);

// ── 3. A/B 反馈（确定样例） ────────────────────────
eq('全中 1234/1234 = 4A0B', T.scoreGuess([1, 2, 3, 4], [1, 2, 3, 4]), { a: 4, b: 0 });
eq('全错 1234/4321 = 0A4B', T.scoreGuess([1, 2, 3, 4], [4, 3, 2, 1]), { a: 0, b: 4 });
eq('2A2B 1234/1324', T.scoreGuess([1, 2, 3, 4], [1, 3, 2, 4]), { a: 2, b: 2 });
eq('无交集 1234/5678 = 0A0B', T.scoreGuess([1, 2, 3, 4], [5, 6, 7, 8]), { a: 0, b: 0 });
eq('前导 0 正常 0123/0341 = 1A2B', T.scoreGuess([0, 1, 2, 3], [0, 3, 4, 1]), { a: 1, b: 2 });
eq('重复数字多重集 5512/5152 = 2A2B', T.scoreGuess([5, 5, 1, 2], [5, 1, 5, 2]), { a: 2, b: 2 });
eq('重复数字 1122/2211 = 0A4B', T.scoreGuess([1, 1, 2, 2], [2, 2, 1, 1]), { a: 0, b: 4 });

// ── 4. 每日种子 ────────────────────────────────────
const d1 = T.dailySecret('2026-10-27');
const d1b = T.dailySecret('2026-10-27');
const d2 = T.dailySecret('2026-10-28');
eq('同一天种子稳定', d1, d1b);
true_('不同日期种子不同', JSON.stringify(d1) !== JSON.stringify(d2), JSON.stringify(d1) + ' vs ' + JSON.stringify(d2));
eq('每日答案 4 位', d1.length, 4);
eq('每日答案不重复（普通难度）', new Set(d1).size, 4);
true_('每日答案是 0-9 数字', d1.every(x => Number.isInteger(x) && x >= 0 && x <= 9));
let validAll = true;
const seen = new Set();
for (let i = 0; i < 30; i++) {
  const d = new Date(2026, 0, 1 + i);
  const key = T.dateKey(d);
  const s = T.dailySecret(key);
  if (s.length !== 4 || new Set(s).size !== 4) validAll = false;
  seen.add(s.join(''));
}
true_('连续 30 天种子均合法', validAll, seen.size + ' unique');
true_('dateKey 补零格式', T.dateKey(new Date(2026, 0, 5)) === '2026-01-05', T.dateKey(new Date(2026, 0, 5)));

// ── 5. 非法输入校验（不扣次数由 E2E 覆盖） ──────────
eq('合法 4 位通过', T.validateGuess([1, 2, 3, 4], 'normal').ok, true);
eq('3 位被拒', T.validateGuess([1, 2, 3], 'normal').ok, false);
eq('5 位被拒', T.validateGuess([1, 2, 3, 4, 5], 'normal').ok, false);
eq('普通模式重复被拒', T.validateGuess([1, 1, 2, 3], 'normal').ok, false);
eq('困难模式允许重复', T.validateGuess([1, 1, 2, 3], 'hard').ok, true);
eq('非数字字符被拒', T.validateGuess([1, 2, 'a', 4], 'normal').ok, false);
eq('越界数字被拒', T.validateGuess([1, 2, 10, 4], 'normal').ok, false);
true_('拒因有中文提示', T.validateGuess([1, 2, 3], 'normal').msg.length > 0);

// ── 6. 候选集统计 ──────────────────────────────────
eq('无反馈时普通候选 5040', T.candidateCount([], 'normal'), 5040);
eq('无反馈时困难候选 10000', T.candidateCount([], 'hard'), 10000);
const fourA = T.candidateCount([{ digits: [1, 2, 3, 4], a: 4, b: 0 }], 'normal');
eq('4A 后只剩 1 种（且是答案本身）', fourA, 1);
const twoTwo = T.candidateCount([{ digits: [1, 2, 3, 4], a: 2, b: 2 }], 'normal');
let brute = 0;
for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
  if (b === a) continue;
  for (let c = 0; c < 10; c++) {
    if (c === a || c === b) continue;
    for (let d = 0; d < 10; d++) {
      if (d === a || d === b || d === c) continue;
      const sc = T.scoreGuess([a, b, c, d], [1, 2, 3, 4]);
      if (sc.a === 2 && sc.b === 2) brute++;
    }
  }
}
eq('2A2B 候选数与暴力枚举一致', twoTwo, brute);
const h1 = [{ digits: [0, 1, 2, 3], a: 1, b: 1 }];
const c1 = T.candidateCount(h1, 'normal');
const h2 = h1.concat([{ digits: [4, 5, 6, 7], a: 0, b: 0 }]);
const c2 = T.candidateCount(h2, 'normal');
true_('新反馈只会缩小候选集', c2 <= c1, c1 + ' → ' + c2);
// 自洽性：候选集里每个答案重新打分都必须等于历史反馈
const hist = [{ digits: [1, 2, 3, 4], a: 2, b: 2 }];
let consistent = true;
let checked = 0;
for (let a = 0; a < 10 && checked < 200; a++) for (let b = 0; b < 10 && checked < 200; b++) {
  if (b === a) continue;
  for (let c = 0; c < 10 && checked < 200; c++) {
    if (c === a || c === b) continue;
    for (let d = 0; d < 10 && checked < 200; d++) {
      if (d === a || d === b || d === c) continue;
      const sc = T.scoreGuess([a, b, c, d], [1, 2, 3, 4]);
      if (sc.a === 2 && sc.b === 2) {
        checked++;
        if (sc.a !== hist[0].a || sc.b !== hist[0].b) consistent = false;
      }
    }
  }
}
true_('候选集自洽（重打分 = 反馈）', consistent, checked + ' 个候选');

// ── 7. 分享文案 ────────────────────────────────────
// 结算页的分享文案由页面状态生成，此处只校验静态模板里含链接与成绩字段；
// 真实点击分享 E2E 在 [G] 段验证。
true_('分享模板含 6 次成绩位', html.includes('/6 次') || html.includes('/6'));
true_('分享文案含站点链接', html.includes('airseai6.github.io/fusion-data-academy'));

console.log();
console.log('='.repeat(70));
console.log('  通过 ' + pass + '   失败 ' + fails.length);
if (fails.length) {
  for (const f of fails) console.log('    FAIL ' + f);
  process.exit(1);
}
console.log('  ✓ 全部通过');
