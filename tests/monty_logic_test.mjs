/** 三门问题 · 逻辑单测（真实执行页面内联 JS） */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(ROOT, 'puzzle', 'monty', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
const sandbox = { window: {}, console };
createContext(sandbox);
runInContext(scripts[0], sandbox, { filename: 'monty-inline.js' });
const T = sandbox.window.__monty;
if (!T) throw new Error('missing __monty');

let ok = 0;
function check(cond, msg) { if (!cond) throw new Error(msg); ok++; }

for (let i = 0; i < 200; i++) {
  const car = Math.floor(Math.random() * 3);
  const picked = Math.floor(Math.random() * 3);
  const opened = T.hostOpen(car, picked);
  check(opened >= 0 && opened < 3, 'host door valid');
  check(opened !== car, 'host never opens car');
  check(opened !== picked, 'host never opens picked');
  const switched = T.switchTarget(picked, opened);
  check(switched >= 0 && switched < 3, 'switch target valid');
  check(switched !== picked && switched !== opened, 'switch target distinct');
}

let s = T.newRound();
s = T.choose(s, s.car);
check(s.phase === 'decide', 'phase decide');
s = T.decide(s, true);
check(s.phase === 'result', 'phase result');
check(s.won === false, 'switching after picking car loses');
s = T.newRound();
s = T.choose(s, (s.car + 1) % 3);
s = T.decide(s, true);
check(s.won === true, 'switch wins when first pick is goat');

const sim = T.simulate(4000);
check(sim.switchRate > 0.62 && sim.switchRate < 0.72, 'switch rate near 2/3: ' + sim.switchRate);
check(sim.stayRate > 0.28 && sim.stayRate < 0.38, 'stay rate near 1/3: ' + sim.stayRate);
console.log(`monty: ${ok} assertions, switch=${(sim.switchRate * 100).toFixed(1)}% stay=${(sim.stayRate * 100).toFixed(1)}% — PASS`);
