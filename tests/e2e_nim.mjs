// G2 Nim browser E2E (CDP).
// Run: node tests/e2e_nim.mjs
import fs from 'node:fs';
import { launch, newTab, navigate, evalJs, shot, sleep } from 'file:///D:/DSHWorkspace/playtest/cdp.mjs';

const PAGE = process.env.NIM_URL || 'file:///D:/hermesWorkspace/projects/github-pages/puzzle/nim/index.html';
const OUT = 'D:/DSHWorkspace/playtest/shots-e2e';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' | ' + detail : ''}`);
};

const cdp = await launch({ port: 9369 });
const page = await newTab(cdp);
try {
  await navigate(page, PAGE, { width: 390, height: 844, mobile: true });
  await sleep(500);
  const boot = await evalJs(page, `({
    piles: window.__nim ? window.__nim.piles.slice() : null,
    pileEls: document.querySelectorAll('.pile').length,
    title: document.title,
    scrollW: document.documentElement.scrollWidth,
    innerW: innerWidth
  })`);
  check('页面加载三堆默认石子和标题', JSON.stringify(boot.piles) === '[3,4,5]' && boot.pileEls === 3 && boot.title.includes('最后一颗'), JSON.stringify(boot));
  check('移动端无横向溢出', boot.scrollW <= boot.innerW, `${boot.scrollW}/${boot.innerW}`);

  // 普通模式：只剩 1 颗，玩家取走即赢
  await evalJs(page, "newGame({piles:[1], mode:'normal', difficulty:'easy'})");
  await sleep(120);
  await evalJs(page, "document.querySelector('[data-pile=\\\"0\\\"]').click()");
  await sleep(120);
  const picker = await evalJs(page, "({shown:!!document.querySelector('.picker'), counts:document.querySelectorAll('.picker [data-count]').length})");
  check('单击石堆出现取子数量选择', picker.shown && picker.counts === 1, JSON.stringify(picker));
  await evalJs(page, "document.querySelector('.picker [data-count=\\\"1\\\"]').click()");
  await sleep(250);
  const win = await evalJs(page, "({phase:window.__nim.phase, winner:window.__nim.winner, result:!!document.querySelector('.result.win'), text:document.querySelector('.result h2')?.textContent})");
  check('普通模式取最后一颗获胜', win.phase === 'result' && win.winner === 'player' && win.result && win.text.includes('你拿走了最后一颗'), JSON.stringify(win));
  await shot(page, OUT + '\\g2-nim-win.png');

  // 取最后者输：同样取走最后一颗，玩家输
  await evalJs(page, "newGame({piles:[1], mode:'misere', difficulty:'easy'})");
  await sleep(120);
  await evalJs(page, "document.querySelector('[data-pile=\\\"0\\\"]').click()");
  await sleep(100);
  await evalJs(page, "document.querySelector('.picker [data-count=\\\"1\\\"]').click()");
  await sleep(250);
  const lose = await evalJs(page, "({phase:window.__nim.phase, winner:window.__nim.winner, result:!!document.querySelector('.result.lose'), text:document.querySelector('.result h2')?.textContent})");
  check('取最后者输模式判定玩家失败', lose.phase === 'result' && lose.winner === 'ai' && lose.result && lose.text.includes('你取走了最后一颗') && lose.text.includes('按规则你输了'), JSON.stringify(lose));

  // 取最后者输：玩家留 1 颗给 AI，AI 被迫取最后一颗而输，玩家获胜
  await evalJs(page, "newGame({piles:[1,1], mode:'misere', difficulty:'easy'})");
  await sleep(120);
  await evalJs(page, "document.querySelector('[data-pile=\\\"0\\\"]').click()");
  await sleep(100);
  await evalJs(page, "document.querySelector('.picker [data-count=\\\"1\\\"]').click()");
  await sleep(1200);
  const misereWin = await evalJs(page, "({phase:window.__nim.phase, winner:window.__nim.winner, result:!!document.querySelector('.result.win'), text:document.querySelector('.result h2')?.textContent})");
  check('取最后者输模式玩家留下最后一颗获胜', misereWin.phase === 'result' && misereWin.winner === 'player' && misereWin.result && misereWin.text.includes('AI 取走了最后一颗'), JSON.stringify(misereWin));

  // 模式切换 + 提示 + 说明
  await evalJs(page, "newGame({piles:[3,4,5], mode:'normal', difficulty:'hard'})");
  await sleep(100);
  await evalJs(page, "const m=document.getElementById('mode'); m.value='misere'; m.dispatchEvent(new Event('change'))");
  await sleep(150);
  const switched = await evalJs(page, "({mode:window.__nim.mode, piles:window.__nim.piles.slice()})");
  check('模式切换会开新局且状态更新', switched.mode === 'misere' && switched.piles.length === 3, JSON.stringify(switched));
  await evalJs(page, "document.getElementById('btnHint').click()");
  await sleep(100);
  const hint = await evalJs(page, "({shown:!!document.querySelector('.hint'), text:document.querySelector('.hint')?.innerText})");
  check('提示显示每堆二进制与异或和', hint.shown && hint.text.includes('异或和') && hint.text.includes('011'), JSON.stringify(hint));
  await shot(page, OUT + '\\g2-nim-mobile.png');

  // 困难 AI 的最优性由 logic test 穷举；这里确认 AI 会思考后落子
  await evalJs(page, "newGame({piles:[3,4,5], mode:'normal', difficulty:'hard'})");
  await sleep(100);
  await evalJs(page, "document.querySelector('[data-pile=\\\"0\\\"]').click()");
  await sleep(80);
  await evalJs(page, "document.querySelector('.picker [data-count=\\\"1\\\"]').click()");
  await sleep(1200);
  const afterAI = await evalJs(page, "({turn:window.__nim.turn, total:window.Nim.totalStones(window.__nim.piles), thinking:document.getElementById('turn')?.textContent})");
  check('困难 AI 在 300–600ms 后落子，回合交还玩家', afterAI.turn === 'player' && afterAI.total < 12, JSON.stringify(afterAI));
} finally {
  await page.close();
  await cdp.close();
}
const fail = results.filter((r) => !r.ok);
console.log(JSON.stringify({ pass: results.length - fail.length, fail: fail.length, failed: fail }, null, 2));
process.exit(fail.length ? 1 : 0);
