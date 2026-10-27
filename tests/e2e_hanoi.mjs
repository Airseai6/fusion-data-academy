// G3 Hanoi browser E2E (CDP).
// Run: node tests/e2e_hanoi.mjs  (or HANOI_URL=http://... node tests/e2e_hanoi.mjs)
import fs from 'node:fs';
import { launch, newTab, navigate, evalJs, shot, sleep } from 'file:///D:/DSHWorkspace/playtest/cdp.mjs';

const PAGE = process.env.HANOI_URL || 'file:///D:/hermesWorkspace/projects/github-pages/puzzle/hanoi/index.html';
const OUT = 'D:/DSHWorkspace/playtest/shots-e2e';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' | ' + detail : ''}`);
};
const clickPeg = async (page, i) => {
  await evalJs(page, `document.querySelector('[data-peg="${i}"]').click()`);
  await sleep(45);
};

const cdp = await launch({ port: 9370 });
const page = await newTab(cdp);
try {
  await navigate(page, PAGE, { width: 390, height: 844, mobile: true });
  await sleep(400);
  const boot = await evalJs(page, `({
    n: window.__hanoi.n,
    moves: window.__hanoi.moves,
    min: window.Hanoi.minMoves(3),
    pegs: document.querySelectorAll('.peg').length,
    disks: document.querySelectorAll('.disk').length,
    scrollW: document.documentElement.scrollWidth,
    innerW: innerWidth
  })`);
  check('页面加载 3 层塔', boot.n === 3 && boot.min === 7 && boot.pegs === 3 && boot.disks === 3, JSON.stringify(boot));
  check('移动端无横向溢出', boot.scrollW <= boot.innerW, `${boot.scrollW}/${boot.innerW}`);

  // Illegal: move disk 1 A→B, then try disk 2 A→B.
  await clickPeg(page, 0);
  await clickPeg(page, 1);
  await clickPeg(page, 0);
  await clickPeg(page, 1);
  const illegal = await evalJs(page, "({warn:document.querySelector('.warnbox')?.innerText||'', moves:window.__hanoi.moves})");
  check('非法移动被拦截且不计数', illegal.warn.includes('大盘不能压在小盘上') && illegal.moves === 1, JSON.stringify(illegal));

  // Reset via UI and auto-play the optimal sequence.
  await evalJs(page, "document.getElementById('btnReset').click()");
  await sleep(80);
  const moves = await evalJs(page, "window.Hanoi.solveHanoi(3)");
  for (const move of moves) {
    await clickPeg(page, move.from);
    await clickPeg(page, move.to);
  }
  const win = await evalJs(page, "({phase:window.__hanoi.phase, moves:window.__hanoi.moves, result:!!document.querySelector('.result.win'), text:document.querySelector('.result h2')?.textContent})");
  check('按最优序列完成 3 层（7 步）', win.phase === 'win' && win.moves === 7 && win.result, JSON.stringify(win));
  await shot(page, OUT + '\\g3-hanoi-win.png');

  // Hint on a fresh game.
  await evalJs(page, "document.getElementById('btnReset').click()");
  await sleep(80);
  await evalJs(page, "document.getElementById('btnHint').click()");
  await sleep(100);
  const hint = await evalJs(page, "({shown:!!document.querySelector('.hintbox'), text:document.querySelector('.hintbox')?.innerText||''})");
  check('提示给出下一步和剩余最优步数', hint.shown && hint.text.includes('A → C') && hint.text.includes('还需 7 步'), JSON.stringify(hint));

  // Level change 4: 15 moves, 4 disks.
  await evalJs(page, "const el=document.getElementById('level'); el.value='4'; el.dispatchEvent(new Event('change'))");
  await sleep(120);
  const lvl4 = await evalJs(page, "({n:window.__hanoi.n, disks:document.querySelectorAll('.disk').length, min:window.Hanoi.minMoves(4)})");
  check('切换到 4 层显示 15 步最少步数', lvl4.n === 4 && lvl4.disks === 4 && lvl4.min === 15, JSON.stringify(lvl4));
  await shot(page, OUT + '\\g3-hanoi-mobile.png');
} finally {
  await page.close();
  await cdp.close();
}
const fail = results.filter((r) => !r.ok);
console.log(JSON.stringify({ pass: results.length - fail.length, fail: fail.length, failed: fail }, null, 2));
process.exit(fail.length ? 1 : 0);
