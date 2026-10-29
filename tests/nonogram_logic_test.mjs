/** 数织 · 逻辑单测 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(ROOT, 'puzzle', 'nonogram', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
const sandbox = { window: {}, console };
createContext(sandbox);
runInContext(scripts[0], sandbox, { filename: 'nonogram-inline.js' });
const T = sandbox.window.__nonogram;
if (!T) throw new Error('missing __nonogram');
let ok = 0;
const check = (c, m) => { if (!c) throw new Error(m); ok++; };

check(T.lineClue([1, 1, 0, 1]) .join(',') === '2,1', 'clue runs');
check(T.lineClue([0, 0, 0, 0, 0]).join(',') === '0', 'empty clue');
check(T.lineClue([1, 0, 1, 0, 1]).join(',') === '1,1,1', 'separated clue');

for (const p of T.PUZZLES) {
  check(p.grid.length === 5 && p.grid.every((r) => r.length === 5), 'grid shape ' + p.name);
  const clue = T.cluesOf(p.grid);
  check(clue.rows.length === 5 && clue.cols.length === 5, 'clues shape');
  check(T.isSolved(p.grid, p.grid), 'solution solves itself');
  check(!T.isSolved(T.emptyGrid(), p.grid), 'empty not solved');
}

const g = T.emptyGrid();
const next = T.toggle(g, 0, 0);
check(next[0][0] === 1 && g[0][0] === 0, 'toggle immutable');
check(T.toggle(next, 0, 0)[0][0] === 0, 'toggle back');
console.log(`nonogram: ${ok} assertions — PASS`);
