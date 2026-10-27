// G4 十五数码浏览器 E2E（CDP，移动端视口 390×844）。
// 运行：node tests/e2e_fifteen.mjs
// 也可指到本地 HTTP / live：FIFTEEN_URL=http://127.0.0.1:8080/puzzle/fifteen/ node tests/e2e_fifteen.mjs
import fs from 'node:fs';
import { launch, newTab, navigate, evalJs, shot, sleep } from 'file:///D:/DSHWorkspace/playtest/cdp.mjs';

const PAGE = process.env.FIFTEEN_URL || 'file:///D:/hermesWorkspace/projects/github-pages/puzzle/fifteen/index.html';
const OUT = 'D:/DSHWorkspace/playtest/shots-e2e';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' | ' + detail : ''}`);
};
const clickIndex = async (page, i) => {
  await evalJs(page, `document.querySelector('.tile[data-index="${i}"]').click()`);
  await sleep(40);
};
const state = (page) => evalJs(page, `({
  size: window.__fifteen.size,
  tiles: window.__fifteen.tiles.slice(),
  moves: window.__fifteen.moves,
  phase: window.__fifteen.phase,
  solvable: window.Fifteen.isSolvable(window.__fifteen.tiles, window.__fifteen.size),
  scrollW: document.documentElement.scrollWidth,
  innerW: innerWidth
})`);

const cdp = await launch({ port: 9381 });
const page = await newTab(cdp);
try {
  await navigate(page, PAGE, { width: 390, height: 844, mobile: true });
  await sleep(500);

  // --- 1. 首屏 ---
  const boot = await evalJs(page, `({
    tiles: document.querySelectorAll('.tile[data-index]').length,
    blanks: document.querySelectorAll('.tile.blank').length,
    badge: document.querySelector('.badge-parity')?.innerText || '',
    goalCells: document.querySelectorAll('.goal .gcell').length,
    parityOk: !!document.querySelector('.badge-parity.ok'),
    minTile: Math.min(...[...document.querySelectorAll('.tile[data-index]')].map(e => e.getBoundingClientRect().height)),
    scrollW: document.documentElement.scrollWidth,
    innerW: innerWidth,
    title: document.title,
    analytics: !!window.counters
  })`);
  check('3×3 首屏：8 块数字 + 1 个空格 + 目标态缩略图', boot.tiles === 8 && boot.blanks === 1 && boot.goalCells === 9, JSON.stringify({ tiles: boot.tiles, blanks: boot.blanks, goal: boot.goalCells }));
  check('首屏局面可解且徽标显示「可解」', boot.parityOk && boot.badge.includes('可解') && boot.badge.includes('逆序数'), boot.badge.replace(/\s+/g, ' '));
  check('移动端无横向溢出（390px）', boot.scrollW <= boot.innerW, `${boot.scrollW}/${boot.innerW}`);
  check('触控目标 ≥ 44px', boot.minTile >= 44, `${boot.minTile.toFixed(1)}px`);
  check('analytics.js 已加载', boot.analytics, String(boot.analytics));

  // --- 2. 非法点击不计数（不相邻的格子点了没反应） ---
  const before = await state(page);
  const farIndex = before.tiles.findIndex((v, i) => v !== 0 && !(i >= 0 && Math.abs(Math.floor(i / 3) - Math.floor(before.tiles.indexOf(0) / 3)) + Math.abs((i % 3) - (before.tiles.indexOf(0) % 3)) === 1));
  await clickIndex(page, farIndex);
  const afterFar = await state(page);
  check('点击不相邻的格子不计步、局面不变', afterFar.moves === 0 && JSON.stringify(afterFar.tiles) === JSON.stringify(before.tiles), `index=${farIndex} moves=${afterFar.moves}`);

  // --- 3. 走到完成态（2 步） ---
  await evalJs(page, `(() => { const g = window.__fifteen; g.tiles = [1,2,3,4,5,6,0,7,8]; g.initial = g.tiles.slice(); g.moves = 0; g.history = []; g.phase = 'playing'; render(); })()`);
  await sleep(80);
  await clickIndex(page, 7); // 7 滑进空格
  await clickIndex(page, 8); // 8 滑进空格 => 完成
  const win = await evalJs(page, `({
    phase: window.__fifteen.phase,
    moves: window.__fifteen.moves,
    tiles: window.__fifteen.tiles.slice(),
    heading: document.querySelector('.result h2')?.textContent || '',
    math: document.querySelector('.result .math')?.innerText || '',
    share: document.querySelector('.sharebox pre')?.innerText || '',
    best: window.__fifteen.best[3]
  })`);
  check('两次滑动后进入完成态且步数为 2', win.phase === 'win' && win.moves === 2 && JSON.stringify(win.tiles) === '[1,2,3,4,5,6,7,8,0]', JSON.stringify({ phase: win.phase, moves: win.moves, tiles: win.tiles }));
  check('结算面板显示步数与本机最佳', win.heading.includes('完成') && win.heading.includes('2 步') && win.best === 2, win.heading);
  check('结算解释给出开局逆序数与不变量', win.math.includes('逆序数') && win.math.includes('不变量'), win.math.split('\n')[0]);
  check('分享文案不含解法步骤、含可点链接（file:// 下兜底线上地址）', win.share.includes('十五数码') && /https:\/\//.test(win.share) && !win.share.includes('null'), win.share.split('\n')[0]);
  await shot(page, OUT + '\\g4-fifteen-win.png');

  // --- 4. 撤销 / 重置 ---
  await evalJs(page, 'newGame(3)');
  await sleep(120);
  const fresh = await state(page);
  const movable = fresh.tiles.findIndex((v, i) => {
    const b = fresh.tiles.indexOf(0);
    return v !== 0 && (Math.abs(i - b) === 1 || Math.abs(i - b) === 3) && !(Math.abs(i - b) === 1 && Math.floor(i / 3) !== Math.floor(b / 3));
  });
  await clickIndex(page, movable);
  const moved = await state(page);
  await evalJs(page, "document.getElementById('btnUndo').click()");
  await sleep(80);
  const undone = await state(page);
  check('走一步计 1 步，撤销后回到 0 步且局面还原', moved.moves === 1 && undone.moves === 0 && JSON.stringify(undone.tiles) === JSON.stringify(fresh.tiles), `moved=${moved.moves} undone=${undone.moves}`);

  await clickIndex(page, movable);
  await evalJs(page, "document.getElementById('btnReset').click()");
  await sleep(100);
  const reset = await state(page);
  check('重置回到本局起点（同一局面、0 步）', reset.moves === 0 && JSON.stringify(reset.tiles) === JSON.stringify(fresh.tiles), JSON.stringify(reset.tiles));

  // --- 5. 换 4×4 ---
  await evalJs(page, "const el=document.getElementById('size'); el.value='4'; el.dispatchEvent(new Event('change'))");
  await sleep(150);
  const big = await evalJs(page, `({
    size: window.__fifteen.size,
    tiles: document.querySelectorAll('.tile[data-index]').length,
    blanks: document.querySelectorAll('.tile.blank').length,
    solvable: window.Fifteen.isSolvable(window.__fifteen.tiles, 4),
    badge: document.querySelector('.badge-parity')?.innerText || '',
    minTile: Math.min(...[...document.querySelectorAll('.tile[data-index]')].map(e => e.getBoundingClientRect().height)),
    scrollW: document.documentElement.scrollWidth,
    innerW: innerWidth,
    goalCells: document.querySelectorAll('.goal .gcell').length
  })`);
  check('4×4：15 块数字 + 1 空格 + 16 格目标态', big.size === 4 && big.tiles === 15 && big.blanks === 1 && big.goalCells === 16, JSON.stringify({ tiles: big.tiles, blanks: big.blanks, goal: big.goalCells }));
  check('4×4 生成的局面可解，徽标含空格行判据', big.solvable && big.badge.includes('行') && big.badge.includes('可解'), big.badge.replace(/\s+/g, ' '));
  check('4×4 移动端无横向溢出、触控目标 ≥ 44px', big.scrollW <= big.innerW && big.minTile >= 44, `${big.scrollW}/${big.innerW}, tile=${big.minTile.toFixed(1)}px`);
  await shot(page, OUT + '\\g4-fifteen-4x4-mobile.png');

  // --- 6. 键盘方向键 ---
  await evalJs(page, 'newGame(3)');
  await sleep(120);
  const kbBefore = await state(page);
  const blankIdx = kbBefore.tiles.indexOf(0);
  const upPossible = Math.floor(blankIdx / 3) > 0;
  await evalJs(page, `document.dispatchEvent(new KeyboardEvent('keydown', { key: '${upPossible ? 'ArrowUp' : 'ArrowDown'}', bubbles: true }))`);
  await sleep(80);
  const kbAfter = await state(page);
  check('方向键可以滑动（空格上方/下方格子进场）', kbAfter.moves === 1, `moves=${kbAfter.moves}`);

  // --- 7. 无解演示 ---
  await evalJs(page, "document.getElementById('btnDemo').click()");
  await sleep(120);
  const demo = await evalJs(page, `({
    warn: document.querySelector('.warnbox')?.innerText || '',
    badge: document.querySelector('.badge-parity')?.innerText || '',
    bad: !!document.querySelector('.badge-parity.bad'),
    solvable: window.Fifteen.isSolvable(window.__fifteen.tiles, window.__fifteen.size)
  })`);
  check('无解演示：徽标转为「永远无解」并给出警示', demo.bad && demo.badge.includes('永远无解') && demo.warn.includes('逆序数'), demo.badge.replace(/\s+/g, ' '));
  check('演示局面确实不可解', demo.solvable === false, String(demo.solvable));

  await evalJs(page, "document.getElementById('btnReset').click()");
  await sleep(100);
  const back = await state(page);
  check('重置后回到可解局面、警示消失', back.solvable === true && !(await evalJs(page, "!!document.querySelector('.warnbox')")), String(back.solvable));
  await shot(page, OUT + '\\g4-fifteen-desktop.png');
} finally {
  await page.close();
  await cdp.close();
}
const fail = results.filter((r) => !r.ok);
console.log(JSON.stringify({ pass: results.length - fail.length, fail: fail.length, failed: fail }, null, 2));
process.exit(fail.length ? 1 : 0);
