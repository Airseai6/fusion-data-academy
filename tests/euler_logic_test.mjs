/** 一笔画 / 七桥 · 逻辑单测 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(ROOT, 'puzzle', 'euler', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
const sandbox = { window: {}, console };
createContext(sandbox);
runInContext(scripts[0], sandbox, { filename: 'euler-inline.js' });
const T = sandbox.window.__euler;
if (!T) throw new Error('missing __euler');
let ok = 0;
const check = (c, m) => { if (!c) throw new Error(m); ok++; };

const ring = T.levelById('ring');
const bridges = T.levelById('bridges');
check(!!ring && !!bridges, 'levels exist');
check(T.hasEulerPath(ring), 'ring has Euler path');
check(!T.hasEulerPath(bridges), 'seven bridges cannot be drawn');

const deg = T.degrees(bridges);
check(deg[2] % 2 === 1 && T.oddNodes(bridges).length === 4, 'seven bridges has 4 odd vertices');

let s = T.newState(ring);
const first = ring.edges.findIndex(([a, b]) => a === s.current || b === s.current);
check(first >= 0, 'edge from start');
const r = T.traverse(s, first);
check(r.ok && r.state.used.length === 1, 'traverse one edge');
check(r.state.current !== s.current, 'current moved');
check(T.undo(r.state).used.length === 0, 'undo restores');

let all = T.newState(ring);
check(T.canTraverse(all, first), 'first edge can traverse');
// 走一条合法欧拉路径：反复找与当前点相连的未用边
let guard = 0;
while (!all.done && guard++ < 30) {
  const idx = ring.edges.findIndex(([a, b], i) => !all.used.includes(i) && (a === all.current || b === all.current));
  if (idx < 0) break;
  const rr = T.traverse(all, idx);
  if (!rr.ok) break;
  all = rr.state;
}
check(all.done, 'ring can be fully traversed by greedy search');
console.log(`euler: ${ok} assertions — PASS`);
