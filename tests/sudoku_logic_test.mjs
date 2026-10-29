/** 迷你数独 · 逻辑单测 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(ROOT, 'puzzle', 'sudoku', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
const sandbox = { window: {}, console };
createContext(sandbox);
runInContext(scripts[0], sandbox, { filename: 'sudoku-inline.js' });
const T = sandbox.window.__sudoku;
if (!T) throw new Error('missing __sudoku');
let ok = 0;
const check = (c, m) => { if (!c) throw new Error(m); ok++; };

const sol = T.makeSolution();
check(sol.length === 4 && sol.every((r) => r.length === 4), 'solution shape');
check(T.isSolved(sol), 'solution valid');
check(T.solveCount(sol, 2) === 1, 'full grid has one solution');

for (let i = 0; i < 10; i++) {
  const p = T.makePuzzle();
  check(T.isSolved(p.solution), 'puzzle solution valid');
  check(p.puzzle.flat().filter((v) => !v).length >= 6, 'puzzle has blanks');
  check(T.solveCount(p.puzzle, 2) === 1, 'puzzle unique');
  check(!T.isSolved(p.puzzle), 'puzzle not solved');
  const copy = T.clone(p.puzzle);
  const empty = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!copy[r][c]) empty.push([r, c]);
  const [r, c] = empty[0];
  check(T.canPlace(copy, r, c, p.solution[r][c]), 'solution value placeable');
}
console.log(`sudoku: ${ok} assertions — PASS`);
