/**
 * 大脑保健操 hub · 每日一练/随机体验 逻辑单测
 * 真实执行 brain/index.html 的内联脚本；不依赖浏览器。
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(ROOT, 'brain', 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
if (scripts.length !== 1) throw new Error('expected 1 inline script, got ' + scripts.length);

const sandbox = { window: {}, console };
createContext(sandbox);
runInContext(scripts[0], sandbox, { filename: 'brain-hub-inline.js' });
const T = sandbox.window.__brainHub;
if (!T) throw new Error('missing window.__brainHub');

const games = T.HUB_GAMES;
if (games.length !== 14) throw new Error('expected 14 games, got ' + games.length);
if (!games.every((g) => g.name && g.href && g.icon)) throw new Error('bad game item');

const a = T.dailyPicks('2026-10-29', 3);
const b = T.dailyPicks('2026-10-29', 3);
if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('daily picks not deterministic');
if (a.length !== 3) throw new Error('expected 3 daily picks');
if (new Set(a.map((g) => g.name)).size !== 3) throw new Error('daily picks not distinct');
if (!a.every((g) => games.includes(g))) throw new Error('daily pick outside game list');

const d = T.hubDateKey(new Date(2026, 9, 29));
if (d !== '2026-10-29') throw new Error('date key ' + d);
for (let i = 0; i < 20; i++) {
  const r = T.randomPick();
  if (!games.includes(r)) throw new Error('random pick outside game list');
}

console.log('brain hub: 9 games, daily 3 deterministic, random valid — PASS');
