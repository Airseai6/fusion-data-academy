// G6 过河浏览器 E2E（CDP，移动端视口 390×844）。
// 运行：node tests/e2e_river.mjs
// 指到本地 HTTP / live：RV_URL=https://airseai6.github.io/fusion-data-academy/puzzle/river/ node tests/e2e_river.mjs
import fs from 'node:fs';
import { launch, newTab, navigate, evalJs, shot, sleep } from 'file:///D:/DSHWorkspace/playtest/cdp.mjs';

const PAGE = process.env.RV_URL || 'file:///D:/hermesWorkspace/projects/github-pages/puzzle/river/index.html';
const OUT = 'D:/DSHWorkspace/playtest/shots-e2e';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' | ' + detail : ''}`);
};

const cdp = await launch({ port: 9383 });
const page = await newTab(cdp);

const state = () => evalJs(page, `({
  levelId: window.__river.levelId,
  steps: window.__river.steps,
  hints: window.__river.hints,
  illegal: window.__river.illegal,
  phase: window.__river.phase,
  boat: window.__river.state.boat,
  left: Object.assign({}, window.__river.state.left),
  load: Object.assign({}, window.__river.load),
  msg: (document.getElementById('msg') || {}).innerText || '',
  rightCount: document.querySelectorAll('#bank-right .piece').length,
  leftCount: document.querySelectorAll('#bank-left .piece').length,
  boatCount: document.querySelectorAll('.boat .piece').length,
  cap: (document.getElementById('boatcap') || {}).innerText || '',
  result: !!document.getElementById('result'),
  hintbox: !!document.getElementById('hintbox'),
  shortest: (document.getElementById('shortest') || {}).innerText || '',
  scrollW: document.documentElement.scrollWidth,
  innerW: innerWidth,
})`);

const clickPiece = async (side, pid) => {
  await evalJs(page, `document.querySelector('#bank-${side === 1 ? 'right' : 'left'} .piece[data-pid="${pid}"]').click()`);
  await sleep(50);
};
const clickBoat = async (pid) => {
  await evalJs(page, `document.querySelector('.boat .piece[data-boat="${pid}"]').click()`);
  await sleep(50);
};
const sail = async () => {
  await evalJs(page, "document.getElementById('btnSail').click()");
  await sleep(70);
};
const levelTab = async (id) => {
  await evalJs(page, `document.querySelector('.levelbar button[data-level="${id}"]').click()`);
  await sleep(120);
};
/** 按最短路径的装载序列点完整局 UI。 */
const playPath = async (levelId) => {
  const plan = await evalJs(page, `window.River.shortestPath(window.River.levelById('${levelId}')).map(s => s.load)`);
  for (const load of plan) {
    for (const [pid, n] of Object.entries(load)) {
      for (let i = 0; i < n; i++) {
        const side = await evalJs(page, 'window.__river.state.boat');
        await clickPiece(side, pid);
      }
    }
    await sail();
  }
  return plan.length;
};

try {
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
      window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection:' + e.reason));`,
  });
  await navigate(page, PAGE, { width: 390, height: 844, mobile: true });
  await sleep(500);

  // ---------- 1. 首屏 ----------
  const boot = await state();
  const bootUi = await evalJs(page, `({
    tabs: document.querySelectorAll('.levelbar button').length,
    sail: !!document.getElementById('btnSail'),
    hint: !!document.getElementById('btnHint'),
    undo: !!document.getElementById('btnUndo'),
    reset: !!document.getElementById('btnReset'),
    share: !!document.getElementById('btnShare'),
    minPiece: Math.min(...[...document.querySelectorAll('.piecess, .piece')].map(e => e.getBoundingClientRect().height)),
    minBtn: Math.min(...[...document.querySelectorAll('.actions button, .sail')].map(e => e.getBoundingClientRect().height)),
    analytics: !!window.counters,
    title: document.title,
  })`);
  check('首屏：两关 tab + 开船/提示/撤销/重置/分享', bootUi.tabs === 2 && bootUi.sail && bootUi.hint && bootUi.undo && bootUi.reset && bootUi.share, JSON.stringify({ tabs: bootUi.tabs }));
  check('初始状态：狼羊菜 3 样都在出发岸、船在出发岸、步数 0', boot.leftCount === 3 && boot.rightCount === 0 && boot.boat === 0 && boot.steps === 0, JSON.stringify({ l: boot.leftCount, r: boot.rightCount }));
  check('船容量显示 0/1', boot.cap.replace(/\s/g, '') === '0/1', boot.cap);
  check('移动端 390px 无横向溢出', boot.scrollW <= boot.innerW, `${boot.scrollW}/${boot.innerW}`);
  check('物品与按钮触控目标 ≥ 44px', bootUi.minPiece >= 44 && bootUi.minBtn >= 44, `${bootUi.minPiece.toFixed(1)} / ${bootUi.minBtn.toFixed(1)}`);
  check('analytics.js 已加载', bootUi.analytics, String(bootUi.analytics));
  await shot(page, OUT + '/g6-river-boot-mobile.png');

  // ---------- 2. 装船 / 容量 ----------
  await clickPiece(0, 'sheep');
  const loaded = await state();
  check('点「羊」上船：船 1/1，出发岸只剩 2 个', loaded.boatCount === 1 && loaded.leftCount === 2 && loaded.cap.replace(/\s/g, '') === '1/1', JSON.stringify(loaded.load));
  await clickPiece(0, 'wolf');
  const full = await state();
  check('船满时再装会被拦下并说明容量', full.boatCount === 1 && full.msg.indexOf('最多载') >= 0, full.msg);

  // 点船上的物品可以卸回岸上
  await clickBoat('sheep');
  const unloaded = await state();
  check('点船上的物品能卸回岸上', unloaded.boatCount === 0 && unloaded.leftCount === 3, `${unloaded.boatCount}/${unloaded.leftCount}`);

  // ---------- 3. 非法移动必须被拒绝 ----------
  // 开局直接带狼走：农夫一走，出发岸就剩羊 + 菜，羊会把菜吃掉
  await clickPiece(0, 'wolf'); await sail();
  const bad = await state();
  check('非法一步被拒绝：提示羊和菜会出事，步数不增加', bad.steps === 0 && bad.illegal === 1 && /羊和菜单独/.test(bad.msg), `steps=${bad.steps} illegal=${bad.illegal} msg=${bad.msg}`);
  check('被拒绝后船仍停在出发岸', bad.boat === 0, String(bad.boat));

  // ---------- 4. 撤销 / 重置 ----------
  await evalJs(page, "document.getElementById('btnReset').click()");
  await sleep(120);
  const reset0 = await state();
  check('重置回到初始状态（步数 0、物品回出发岸）', reset0.steps === 0 && reset0.leftCount === 3 && reset0.boat === 0, JSON.stringify({ steps: reset0.steps }));
  await clickPiece(0, 'sheep'); await sail();
  await sail();
  const twoSteps = await state();
  await evalJs(page, "document.getElementById('btnUndo').click()");
  await sleep(120);
  const undone = await state();
  // 两步是「羊过 + 空船回」，撤销一步应回到「羊已在对岸（船也在对岸）」的第 1 步
  check('撤销一步：步数 −1、回到上一步的船位', twoSteps.steps === 2 && undone.steps === 1 && undone.boat === 1, `${twoSteps.steps} → ${undone.steps} boat=${undone.boat}`);

  // ---------- 5. 提示 ----------
  await evalJs(page, "document.getElementById('btnHint').click()");
  await sleep(120);
  const hinted = await state();
  const hintText = await evalJs(page, "(document.getElementById('hintbox') || {}).innerText || ''");
  check('提示出现、计入提示次数、且只描述这一步', hinted.hintbox && hinted.hints === 1 && /这一步/.test(hintText), hintText.replace(/\n/g, ' '));
  check('提示不说「答案」两个字', !/答案/.test(hintText), hintText.slice(0, 40));
  await shot(page, OUT + '/g6-river-hint-mobile.png');

  // ---------- 6. 按最优解走完（7 步） ----------
  await evalJs(page, "document.getElementById('btnReset').click()");
  await sleep(120);
  const wgcLen = await playPath('wgc');
  const won = await state();
  const winText = await evalJs(page, "(document.getElementById('result') || {}).innerText || ''");
  check('狼羊菜按最优解 7 步通关，出现结算面板', won.phase === 'win' && won.result && won.steps === 7 && wgcLen === 7, `steps=${won.steps} plan=${wgcLen}`);
  check('结算写明最优步数并给出图论数字', /最优解/.test(winText) && /10/.test(winText) && /7/.test(winText), winText.split('\n').slice(0, 2).join(' / '));
  check('结算解释「更短的解不存在」', /不存在/.test(winText), String(/不存在/.test(winText)));
  await shot(page, OUT + '/g6-river-win-mobile.png');

  // ---------- 7. 分享 ----------
  await evalJs(page, `Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });`);
  await evalJs(page, "document.getElementById('btnShare2').click()");
  await sleep(150);
  const shareMsg = await evalJs(page, "(document.querySelector('.sharebox .share-msg') || {}).innerText || ''");
  const shareTxt = await evalJs(page, "document.getElementById('sharetext').innerText");
  const shareHead = shareTxt.split('来试')[0];
  check('分享文案能复制，且不含具体走法', /已复制/.test(shareMsg) && !/这一步|把 .{1,4} ?(过去|回来)/.test(shareHead), `${shareMsg} | ${shareHead.replace(/\n/g, ' ')}`);
  check('分享文案带线上地址兜底', /https:\/\/airseai6\.github\.io/.test(shareTxt), shareTxt.split('\n').pop());

  // ---------- 8. 换关：传教士野人 ----------
  await levelTab('mc');
  const mcBoot = await state();
  const mcCap = await evalJs(page, "(document.getElementById('boatcap') || {}).innerText || ''");
  const mcTabs = await evalJs(page, "document.querySelector('.levelbar button.on').dataset.level");
  check('切到传教士关：6 个乘客、船容 2、步数归零', mcBoot.levelId === 'mc' && mcBoot.leftCount === 6 && mcCap.replace(/\s/g, '') === '0/2' && mcBoot.steps === 0, `${mcBoot.leftCount} / ${mcCap}`);
  check('当前 tab 高亮为传教士关', mcTabs === 'mc', mcTabs);
  check('传教士关移动端仍无溢出', mcBoot.scrollW <= mcBoot.innerW, `${mcBoot.scrollW}/${mcBoot.innerW}`);

  // 空船开船必须被拒绝（船得有人划）
  await evalJs(page, "document.getElementById('btnSail').click()");
  await sleep(120);
  const emptySail = await state();
  check('传教士关空船开船被拒绝（船必须有人划）', emptySail.steps === 0 && emptySail.illegal === 1 && /有人划/.test(emptySail.msg), `steps=${emptySail.steps} illegal=${emptySail.illegal} msg=${emptySail.msg}`);

  // 带 2 个传教士过去 → 左岸 1M3C，野人多于传教士 → 非法
  await clickPiece(0, 'm'); await clickPiece(0, 'm');
  await sail();
  const badMc = await state();
  check('带 2 传教士被拒绝：野人多于传教士', badMc.steps === 0 && badMc.illegal === 2 && /野人多于传教士/.test(badMc.msg), badMc.msg);

  // 卸船再按最优解走 11 步
  await evalJs(page, "document.getElementById('btnReset').click()");
  await sleep(150);
  const mcLen = await playPath('mc');
  const mcWin = await state();
  const mcText = await evalJs(page, "(document.getElementById('result') || {}).innerText || ''");
  check('传教士关按最优解 11 步通关', mcWin.phase === 'win' && mcWin.steps === 11 && mcLen === 11, `steps=${mcWin.steps} plan=${mcLen}`);
  check('结算给出「允许空船只要 5 步」的反事实', /5/.test(mcText) && /如果换一条规则/.test(mcText), String(/如果换一条规则/.test(mcText)));
  await shot(page, OUT + '/g6-river-mc-win-mobile.png');

  // ---------- 9. 页面无 JS 报错 ----------
  const errors = await evalJs(page, 'window.__errors');
  check('整场无未捕获 JS 错误', Array.isArray(errors) && errors.length === 0, JSON.stringify(errors));

  // ---------- 10. 桌面视口也正常 ----------
  await navigate(page, PAGE, { width: 1280, height: 900 });
  await sleep(400);
  const desk = await state();
  check('桌面 1280px 无溢出、布局正常', desk.scrollW <= desk.innerW && desk.leftCount === 3, `${desk.scrollW}/${desk.innerW}`);
  await shot(page, OUT + '/g6-river-desktop.png');
} catch (err) {
  check('E2E 执行异常', false, String(err && err.message ? err.message : err));
} finally {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== ${pass}/${results.length} PASS ===`);
  fs.writeFileSync(OUT + '/g6-river-e2e.json', JSON.stringify(results, null, 2));
  await cdp.close();
  process.exit(pass === results.length ? 0 : 1);
}
