// G8 聚变堆叠浏览器 E2E（CDP，移动端 390×844 + 桌面 1280）。
// 运行：node tests/e2e_fusion.mjs
// 指到 live：FS_URL=https://airseai6.github.io/fusion-data-academy/puzzle/fusion-stack/ node tests/e2e_fusion.mjs
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { launch, newTab, navigate, evalJs, shot, sleep } from 'file:///D:/DSHWorkspace/playtest/cdp.mjs';

const ROOT = 'D:/hermesWorkspace/projects/github-pages';
const PAGE = process.env.FS_URL || 'file:///' + ROOT + '/puzzle/fusion-stack/index.html';
const OUT = 'D:/DSHWorkspace/playtest/shots-e2e';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' | ' + detail : ''}`);
};

const cdp = await launch({ port: 9388 });
const page = await newTab(cdp);

const state = () => evalJs(page, `(() => {
  const G = window.__fusion || {};
  const tiles = [...document.querySelectorAll('#board .tile')];
  const overlay = document.getElementById('overlay');
  return {
    board: (G.board || []).slice(),
    tiles: tiles.length,
    cells: document.querySelectorAll('#board .cell').length,
    energy: (document.getElementById('energy') || {}).textContent || '',
    pct: (document.getElementById('pct') || {}).textContent || '',
    goal: (document.getElementById('goallab') || {}).textContent || '',
    top: (document.getElementById('top') || {}).textContent || '',
    moves: G.moves === undefined ? -1 : G.moves,
    energyEv: G.energyEv || 0,
    status: G.status || '?',
    overlayHidden: overlay ? overlay.classList.contains('hidden') : true,
    overlayText: overlay ? overlay.innerText : '',
    share: (document.getElementById('sharetext') || {}).textContent || '',
    chain: (document.getElementById('chain') || {}).innerText || '',
    tableRows: document.querySelectorAll('#qtable tr').length,
    curvePath: !!document.querySelector('#curve path'),
    tableShown: (document.getElementById('tablepanel') || {}).style.display !== 'none',
    scrollW: document.documentElement.scrollWidth,
    innerW: innerWidth,
    boardW: (document.getElementById('board') || {}).clientWidth,
    msg: (document.getElementById('msg') || {}).textContent || '',
    events: (() => { try { return Object.keys(window.counters.summary()); } catch (e) { return ['__no_ls__']; } })(),
  };
})()`);

const clickBtn = async (id) => {
  await evalJs(page, `(() => { const b = document.getElementById('${id}'); if (b) b.click(); return !!b; })()`);
  await sleep(120);
};

const pressDir = async (dir, times = 1) => {
  for (let i = 0; i < times; i++) {
    await evalJs(page, `document.querySelector('.dpad button[data-dir="${dir}"]').click()`);
    await sleep(35);
  }
};

const swipe = async (dx, dy) => {
  // 页面用 touchstart/touchend 判断手势；这里直接派发合成的 Touch 事件
  await evalJs(page, `(() => {
    const board = document.getElementById('board');
    const mk = (type, x, y) => new TouchEvent(type, {
      bubbles: true, cancelable: true,
      changedTouches: [new Touch({ identifier: 1, target: board, clientX: x, clientY: y })],
    });
    const r = board.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    board.dispatchEvent(mk('touchstart', cx, cy));
    board.dispatchEvent(mk('touchend', cx + ${dx}, cy + ${dy}));
    return true;
  })()`);
  await sleep(150);
};

try {
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
      window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection:' + e.reason));`,
  });

  // ---------- 1. 移动端启动 ----------
  await navigate(page, PAGE, { width: 390, height: 844, mobile: true });
  await sleep(450);
  const boot = await state();
  check('页面加载后有 4×4 棋盘与 2 个初始核', boot.cells === 16 && boot.tiles === 2, `cells=${boot.cells} tiles=${boot.tiles}`);
  check('初始能量 0 eV、步数 0、目标 1.00 GeV', /^0 eV$/.test(boot.energy.trim()) && boot.moves === 0 && /1\.00 GeV/.test(boot.goal), `${boot.energy} | ${boot.goal}`);
  check('聚变链面板显示 2D→⁴He 的 +23.85 MeV', /23\.85/.test(boot.chain) && /He-4/.test(boot.chain), boot.chain.replace(/\n/g, ' ').slice(0, 80));
  check('聚变链面板标出 ⁻Be 那一步≈0 的坑（−0.09 MeV）', /−0\.09/.test(boot.chain), '');
  const chainNote = await evalJs(page, `document.getElementById('chainnote').innerText`);
  // 曾经在这句话里取错下标，把 +14.62 说成「⁸Be 那一步」，这里钉住
  check('链说明里的「⁸Be 那一步」取的是 −0.09 而不是 +14.62', /那一步只有\s*−0\.09/.test(chainNote), chainNote.slice(0, 34));
  check('移动端 390px 无横向溢出', boot.scrollW <= boot.innerW, `${boot.scrollW}/${boot.innerW}`);
  await shot(page, OUT + '/g8-fusion-boot-mobile.png');

  // ---------- 2. 操作：按钮 / 键盘 / 滑动 ----------
  await pressDir('left');
  const afterBtn = await state();
  // 第一步如果正好把两个初始核合了，棋盘上是「合成 1 + 补 1 = 2」块，否则 3 块
  check('点方向按钮能走一步并补核', afterBtn.moves === 1 && (afterBtn.tiles === 3 || afterBtn.tiles === 2),
    `moves=${afterBtn.moves} tiles=${afterBtn.tiles} energy=${afterBtn.energy}`);

  await evalJs(page, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`);
  await sleep(80);
  const afterKey = await state();
  check('方向键能走一步', afterKey.moves === 2, `moves=${afterKey.moves}`);

  const beforeSwipe = (await state()).moves;
  await swipe(0, -140);
  const afterSwipe = await state();
  check('上滑手势能触发移动', afterSwipe.moves > beforeSwipe, `moves=${beforeSwipe}→${afterSwipe.moves}`);

  // ---------- 3. 连续对局：能量累积 / 升级 / 无溢出 ----------
  const dirs = ['left', 'up', 'right', 'down'];
  for (let i = 0; i < 40; i++) await pressDir(dirs[i % 4], 1);
  const mid = await state();
  check('40 步后能量在涨（> 10 MeV）', mid.energyEv > 1e7, `${mid.energy}`);
  check('棋盘上出现了更重的核（最高牌不是氘）', mid.top !== '氘' && mid.top !== '—', mid.top);
  check('连续操作后仍无横向溢出', mid.scrollW <= mid.innerW, `${mid.scrollW}/${mid.innerW}`);
  // 3 次单步 + 40 次按钮；其中无效移动不计步，所以只设下界
  check('步数统计与实际操作一致（无效移动不计步）', mid.moves >= 40, `moves=${mid.moves}`);
  check('能量读数用 SI 前缀写法', /(GeV|MeV|keV|eV)$/.test(mid.energy.trim()), mid.energy);
  await shot(page, OUT + '/g8-fusion-mid-mobile.png');

  // ---------- 4. 撤销 ----------
  const beforeUndo = await state();
  await clickBtn('btn-undo');
  const afterUndo = await state();
  check('撤销回退一步：步数减 1', afterUndo.moves === beforeUndo.moves - 1,
    `${beforeUndo.moves}→${afterUndo.moves}, ${beforeUndo.energy}→${afterUndo.energy}`);
  // 精确版：摆一个只有一次「2D→⁴He」的局面，撤销后能量必须一分不差地回到原值
  await evalJs(page, `(() => {
    const b = new Array(16).fill(0);
    b[0] = 1; b[1] = 1; b[8] = 3;
    window.__fusionApi.loadState(b, 5e7);
    return true;
  })()`);
  await sleep(80);
  await pressDir('left');
  const merged = await state();
  await clickBtn('btn-undo');
  const unmerged = await state();
  check('撤销能精确还原能量（合并 → 撤销 = 原值）',
    Math.abs(merged.energyEv - (5e7 + 23.8465e6)) < 1e4 && Math.abs(unmerged.energyEv - 5e7) < 1,
    `${merged.energy} → ${unmerged.energy}`);

  // ---------- 5. 重开 ----------
  await clickBtn('btn-restart');
  const restarted = await state();
  check('重开：能量归零、步数归零、回到 2 个核', restarted.energyEv === 0 && restarted.moves === 0 && restarted.tiles === 2,
    `${restarted.energy} moves=${restarted.moves} tiles=${restarted.tiles}`);
  check('重开后撤销按钮不可用', await evalJs(page, `document.getElementById('btn-undo').disabled`) === true, '');

  // ---------- 6. 聚变表 + 能量曲线 ----------
  await clickBtn('btn-table');
  const table = await state();
  // 1 行表头 + 5 个聚变步 + 1 行终止
  check('聚变表展开后有 7 行账（表头 + 5 步 + 终止）', table.tableRows === 7, `rows=${table.tableRows}`);
  check('聚变表画出了每核子结合能曲线', table.curvePath === true, '');
  await shot(page, OUT + '/g8-fusion-table-mobile.png');
  await clickBtn('btn-table');

  // ---------- 7. 通关流程（摆一个差一步的局面） ----------
  await evalJs(page, `(() => {
    const b = new Array(16).fill(0);
    b[0] = 5; b[1] = 5;                       // 两块 ³²S 相邻，一步就能合到 ⁶⁴Ni
    b[4] = 1; b[5] = 2; b[6] = 3;
    window.__fusionApi.loadState(b, 9.9e8);
    return true;
  })()`);
  await sleep(120);
  const nearly = await state();
  check('摆局后能量读数 990.00 MeV、未通关', /990\.00 MeV/.test(nearly.energy) && nearly.overlayHidden, nearly.energy);
  await pressDir('left');
  const won = await state();
  check('合并后跨过 10⁹ eV 触发通关面板', won.status === 'win' && !won.overlayHidden, `status=${won.status}`);
  check('通关标题写目标值而不是硬编码', /目标达成：1\.00 GeV/.test(won.overlayText), won.overlayText.split('\n')[0]);
  check('通关文案说明铁峰之后要吸能', /吸能|铁峰/.test(won.overlayText), '');
  check('分享文案含成绩且不含棋盘解法', /GeV|MeV/.test(won.share) && !/^[0-9, ]+$/.test(won.share), won.share.split('\n')[0]);
  check('通关后按钮是「继续冲击 2.00 GeV」', /继续冲击 2\.00 GeV/.test(won.overlayText), '');
  await shot(page, OUT + '/g8-fusion-win-mobile.png');

  // ---------- 8. 继续冲档 ----------
  const boardBefore = won.board.join(',');
  await clickBtn('btn-again');
  const cont = await state();
  check('继续冲档：棋盘不动、状态回到 playing', cont.status === 'playing' && cont.board.join(',') === boardBefore, `status=${cont.status}`);
  check('继续冲档：目标抬到 2.00 GeV', /2\.00 GeV/.test(cont.goal), cont.goal);

  // ---------- 9. 死局 ----------
  await evalJs(page, `(() => {
    const b = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) b.push((r + c) % 2 ? 1 : 2);
    window.__fusionApi.loadState(b, 4e8);
    return true;
  })()`);
  await sleep(120);
  const dead = await state();
  check('交替满盘判为死局并弹出结算', dead.status === 'lose' && !dead.overlayHidden, `status=${dead.status}`);
  check('熄火面板给出可执行提示', /提示|镍|Ni/.test(dead.overlayText), dead.overlayText.split('\n').slice(-2).join(' ').slice(0, 60));
  await shot(page, OUT + '/g8-fusion-lose-mobile.png');

  // ---------- 10. 埋点 & 错误 ----------
  const events = dead.events;
  const wanted = ['fusion_start', 'fusion_merge', 'fusion_target', 'fusion_gameover', 'fusion_undo'];
  const missing = wanted.filter(e => events.indexOf(e) < 0);
  check('埋点覆盖启动/合并/通关/熄火/撤销', missing.length === 0, missing.length ? '缺 ' + missing.join(',') : JSON.stringify(events));
  const errors = await evalJs(page, 'window.__errors');
  check('整场无未捕获 JS 错误', Array.isArray(errors) && errors.length === 0, JSON.stringify(errors));

  // ---------- 11. 桌面视口 ----------
  await navigate(page, PAGE, { width: 1280, height: 900 });
  await sleep(450);
  const desk = await state();
  check('桌面 1280px 无溢出、棋盘未撑爆', desk.scrollW <= desk.innerW && desk.boardW <= 560, `${desk.scrollW}/${desk.innerW} board=${desk.boardW}`);
  await shot(page, OUT + '/g8-fusion-desktop.png');

  // ---------- 12. 相对资源（analytics 走的是 ../../analytics.js） ----------
  const countersOk = await evalJs(page, `typeof window.counters === 'object' && typeof window.counters.track === 'function'`);
  check('analytics.js 相对路径可用', countersOk === true, '');
  const backLink = await evalJs(page, `!!document.querySelector('.topbar a[href="../"]')`);
  check('返回谜题目录的入口存在', backLink === true, '');

  // ---------- 13. 两个入口卡片 ----------
  await navigate(page, 'file:///' + ROOT + '/puzzle/index.html', { width: 390, height: 900, mobile: true });
  await sleep(350);
  const hubCard = await evalJs(page, `(() => {
    const a = document.querySelector('a[href="./fusion-stack/"]');
    return a ? a.innerText.replace(/\s+/g, ' ').trim() : '';
  })()`);
  check('谜题目录有第九关入口卡片且文案正确', /第九关/.test(hubCard) && /聚变堆叠/.test(hubCard), hubCard.slice(0, 46));

  await navigate(page, 'file:///' + ROOT + '/brain/index.html', { width: 390, height: 900, mobile: true });
  await sleep(350);
  const brainCard = await evalJs(page, `(() => {
    const a = document.querySelector('a[href="../puzzle/fusion-stack/"]');
    const n = document.getElementById('stat-games');
    return { text: a ? a.innerText.replace(/\s+/g, ' ').trim() : '', games: n ? n.textContent : '' };
  })()`);
  check('大脑保健操有聚变堆叠卡片', /聚变堆叠/.test(brainCard.text) && brainCard.text.length > 10, brainCard.text.slice(0, 40));
  // hub 上原有 8 张游戏卡（含最早的「抓狐狸」），加 G8 后自动变成 9
  check('大脑保健操的游戏计数自动同步（8 → 9）', brainCard.games === '9', brainCard.games);
} catch (err) {
  check('E2E 执行异常', false, String(err && err.message ? err.message : err));
} finally {
  const pass = results.filter(r => r.ok).length;
  console.log(`\n=== ${pass}/${results.length} PASS ===`);
  fs.writeFileSync(OUT + '/g8-fusion-e2e.json', JSON.stringify(results, null, 2));
  await cdp.close();
  process.exit(pass === results.length ? 0 : 1);
}
