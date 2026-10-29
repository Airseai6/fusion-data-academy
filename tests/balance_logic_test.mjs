/** 天平称币 · 逻辑单测 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(ROOT, 'puzzle', 'balance', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
const sandbox = { window: {}, console };
createContext(sandbox);
runInContext(scripts[0], sandbox, { filename: 'balance-inline.js' });
const T = sandbox.window.__balance;
if (!T) throw new Error('missing __balance');
let ok = 0;
const check = (c, m) => { if (!c) throw new Error(m); ok++; };

check(T.initialCandidates().length === 24, '24 candidates');
const known = { coin: 5, heavy: true };
check(T.compare(known, [5], [6]) === 'left', 'heavy coin makes left heavier');
check(T.compare(known, [6], [5]) === 'right', 'heavy coin makes right lighter');
check(T.compare({ coin: 5, heavy: false }, [5], [6]) === 'right', 'light coin makes left lighter');
check(T.compare(known, [1, 2], [3, 4]) === 'balance', 'normal pairs balance');
check(T.validateWeigh([1], [2]).ok, 'valid weigh');
check(T.validateWeigh([1], [1, 2]).ok === false, 'unequal sides rejected');
check(T.validateWeigh([1], [2, 1]).ok === false, 'same coin both sides rejected');

let g = T.newGame({ coin: 7, heavy: false });
check(g.candidates.length === 24, 'game starts with 24');
let r = T.weigh(g, [1, 2, 3, 4], [5, 6, 7, 8]);
check(r.ok, 'first weigh accepted');
g = r.state;
check(g.weighings.length === 1, 'history one');
check(g.candidates.length < 24 && g.candidates.length > 0, 'candidates reduced');
check(g.candidates.every((c) => T.compare(c, [1, 2, 3, 4], [5, 6, 7, 8]) === g.outcome), 'filter consistent');

// 用二分/三分策略走完 3 次，最后候选应只剩 1 个
let state = T.newGame({ coin: 9, heavy: true });
const plan = [[[1, 2, 3, 4], [5, 6, 7, 8]], [[1, 2, 3, 9], [5, 6, 7, 10]], [[1, 2, 9, 11], [3, 4, 5, 12]]];
for (const [l, rr] of plan) {
  const x = T.weigh(state, l, rr);
  if (!x.ok) break;
  state = x.state;
}
check(state.weighings.length === 3, '3 weighings');
check(state.phase === 'guess', 'phase guess');
const guess = T.makeGuess(state, 9, true);
check(guess.ok && guess.state.won === true, 'correct guess wins');
console.log(`balance: ${ok} assertions — PASS`);
