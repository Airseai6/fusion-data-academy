// G7 围堵狐狸浏览器 E2E（CDP，移动端视口 390×844）。
// 运行：node tests/e2e_fox.mjs
// 指到 live：FX_URL=https://airseai6.github.io/fusion-data-academy/puzzle/fox-hunt/ node tests/e2e_fox.mjs
import fs from 'node:fs';
import { launch, newTab, navigate, evalJs, shot, sleep } from 'file:///D:/DSHWorkspace/playtest/cdp.mjs';

const PAGE = process.env.FX_URL || 'file:///D:/hermesWorkspace/projects/github-pages/puzzle/fox-hunt/index.html';
const OUT = 'D:/DSHWorkspace/playtest/shots-e2e';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' | ' + detail : ''}`);
};

const cdp = await launch({ port: 9387 });
const page = await newTab(cdp);

const state = () => evalJs(page, `({
  levelId: window.__fox.levelId,
  fox: window.__fox.fox,
  steps: window.__fox.steps,
  hints: window.__fox.hints,
  phase: window.__fox.phase,
  cuts: window.__fox.blocked.toString(2).split('1').length - 1,
  msg: (document.getElementById('msg') || {}).innerText || '',
  nodes: document.querySelectorAll('#graph .node').length,
  foxNode: (document.querySelector('#graph .node.fox') || {dataset:{}}).dataset.node,
  denNode: (document.querySelector('#graph .node.den') || {dataset:{}}).dataset.node,
  cutsDom: document.querySelectorAll('#graph .node.cut').length,
  hintbox: !!document.getElementById('hintbox'),
  hintpoint: document.querySelectorAll('#graph .node.hintpoint').length,
  result: !!document.getElementById('result'),
  lose: !!document.querySelector('#result.lose'),
  resultText: (document.getElementById('result') || {}).innerText || '',
  stepsShown: (document.getElementById('steps') || {}).innerText || '',
  scrollW: document.documentElement.scrollWidth,
  innerW: innerWidth,
})`);

const clickNode = async (v) => {
  // SVG 元素没有 HTMLElement.click()，要自己派发事件
  await evalJs(page, `(() => {
    const el = document.querySelector('#graph .node[data-node="${v}"]');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  })()`);
  await sleep(60);
};
const clickBtn = async (id) => {
  await evalJs(page, `document.getElementById('${id}').click()`);
  await sleep(120);
};
/** 按页面自己的提示走完一关（提示 → 点那个点 → 狐狸还手），返回用了几步。 */
const playByHints = async (expectWin) => {
  let guard = 0;
  let used = 0;
  while (guard++ < 20) {
    const st = await state();
    if (st.phase !== 'playing') return used;
    const v = await evalJs(page, `window.Fox.hintAt(window.__fox.level, window.__fox.fox, window.__fox.blocked).vertex`);
    await clickNode(v);
    used += 1;
  }
  return used;
};

try {
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
      window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection:' + e.reason));`,
  });
  await navigate(page, PAGE, { width: 390, height: 844, mobile: true });
  await sleep(600);

  // ---------- 1. 首屏 ----------
  const boot = await state();
  const bootUi = await evalJs(page, `({
    tabs: document.querySelectorAll('.levelbar button').length,
    hint: !!document.getElementById('btnHint'),
    undo: !!document.getElementById('btnUndo'),
    reset: !!document.getElementById('btnReset'),
    share: !!document.getElementById('btnShare'),
    analytics: !!window.counters,
    title: document.title,
    minTap: Math.min(...[...document.querySelectorAll('#graph .node .hit')].map(e => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))),
    minBtn: Math.min(...[...document.querySelectorAll('.actions button, .levelbar button')].map(e => e.getBoundingClientRect().height)),
  })`);
  check('首屏：三个关卡 tab + 提示/撤销/重置/分享', bootUi.tabs === 3 && bootUi.hint && bootUi.undo && bootUi.reset && bootUi.share, `tabs=${bootUi.tabs}`);
  check('初始：环关 6 个点，狐狸在 4 号、洞口 1 号、步数 0', boot.levelId === 'ring' && boot.nodes === 6 && boot.foxNode === '3' && boot.denNode === '0' && boot.steps === 0, `nodes=${boot.nodes} fox=${boot.foxNode} den=${boot.denNode}`);
  check('移动端 390px 无横向溢出', boot.scrollW <= boot.innerW, `${boot.scrollW}/${boot.innerW}`);
  check('节点触控目标 ≥ 44px、按钮高度 ≥ 44px', bootUi.minTap >= 44 && bootUi.minBtn >= 44, `${bootUi.minTap.toFixed(1)} / ${bootUi.minBtn.toFixed(1)}`);
  check('analytics.js 已加载', bootUi.analytics, String(bootUi.analytics));
  await shot(page, OUT + '/g7-fox-boot-mobile.png');

  // ---------- 2. 非法点击 ----------
  await clickNode(3);
  const onFox = await state();
  check('点狐狸脚下被拒绝并说明原因', onFox.steps === 0 && /脚下/.test(onFox.msg), onFox.msg);
  await clickNode(0);
  const onDen = await state();
  check('点洞口被拒绝（洞口封不住）', onDen.steps === 0 && /洞口封不了/.test(onDen.msg), onDen.msg);

  // ---------- 3. 提示 ----------
  await clickBtn('btnHint');
  const hinted = await state();
  const hintText = await evalJs(page, "(document.getElementById('hintbox') || {}).innerText || ''");
  check('提示出现、有高亮点、计入提示次数', hinted.hintbox && hinted.hintpoint === 1 && hinted.hints === 1, `hintpoint=${hinted.hintpoint}`);
  check('提示只讲这一步、不叫「答案」', /这一步/.test(hintText) && !/答案/.test(hintText), hintText.replace(/\n/g, ' ').slice(0, 60));
  await shot(page, OUT + '/g7-fox-hint-mobile.png');

  // ---------- 4. 撤销 / 重置 ----------
  await clickBtn('btnReset');
  const r0 = await state();
  check('重置回到初始（步数 0、狐狸回起点）', r0.steps === 0 && r0.fox === 3 && r0.cuts === 0, `steps=${r0.steps} fox=${r0.fox}`);
  const plan = await evalJs(page, `window.Fox.hintAt(window.Fox.levelById('ring'), 3, 0).vertex`);
  await clickNode(plan);
  const afterOne = await state();
  await clickBtn('btnUndo');
  const undone = await state();
  check('撤销一步：步数 −1、狐狸位置也回退', afterOne.steps === 1 && undone.steps === 0 && undone.fox === 3 && undone.cuts === 0, `${afterOne.steps} → ${undone.steps} fox=${undone.fox}`);

  // ---------- 5. 按最优解走完环关（3 步） ----------
  await clickBtn('btnReset');
  const usedRing = await playByHints(true);
  const wonRing = await state();
  check('环关按提示 3 步围死狐狸，出现结算面板', wonRing.phase === 'win' && wonRing.result && wonRing.steps === 3 && usedRing === 3, `steps=${wonRing.steps} used=${usedRing}`);
  check('结算写明最优步数并给出顶点割/Menger 结论', /最优/.test(wonRing.resultText) && /顶点割|Menger/.test(wonRing.resultText), wonRing.resultText.split('\n')[0]);
  check('结算给出「狐狸不动只要几步」的反事实', /站着不动/.test(wonRing.resultText), String(/站着不动/.test(wonRing.resultText)));
  check('步数 HUD 与内部状态一致', wonRing.stepsShown === '3', wonRing.stepsShown);
  check('结算后 HUD 的「最优」显示具体步数', (await evalJs(page, "document.querySelectorAll('.stats b')[1].innerText")) === '3', await evalJs(page, "document.querySelectorAll('.stats b')[1].innerText"));
  await shot(page, OUT + '/g7-fox-ring-win-mobile.png');

  // ---------- 6. 分享 ----------
  await evalJs(page, `Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });`);
  await clickBtn('btnShare2');
  const shareMsg = await evalJs(page, "(document.querySelector('.sharebox .share-msg') || {}).innerText || ''");
  const shareTxt = await evalJs(page, "document.getElementById('sharetext').innerText");
  check('分享文案能复制，且不含具体封法', /已复制/.test(shareMsg) && !/封\s*\d+\s*号点/.test(shareTxt), shareMsg);
  const shareOrigin = await evalJs(page, 'location.origin + location.pathname');
  check('分享文案带可点链接（file:// 下兜底线上地址）',
    /来试：https?:\/\//.test(shareTxt) && (shareTxt.indexOf(shareOrigin) >= 0 || /https:\/\/airseai6\.github\.io/.test(shareTxt)),
    shareTxt.split('\n').pop());

  // ---------- 7. 输棋：故意封远处，让狐狸跑进洞 ----------
  await clickBtn('btnRetry');
  let lost = 0;
  for (let i = 0; i < 8; i++) {
    const st = await state();
    if (st.phase !== 'playing') { lost = st.steps; break; }
    const v = await evalJs(page, `(() => {
      const L = window.__fox.level, F = window.Fox;
      const dist = F.denDistances(L);
      const legal = F.legalPlacements(L, window.__fox.fox, window.__fox.blocked);
      return legal.sort((a, b) => dist[b] - dist[a] || a - b)[0];
    })()`);
    await clickNode(v);
  }
  const lostState = await state();
  check('故意封远端时狐狸能逃进洞口（输棋判定）', lostState.phase === 'lose' && lostState.lose, `phase=${lostState.phase} steps=${lostState.steps}`);
  check('输棋面板说明顺序错了并给出最优步数', /溜进洞|最优/.test(lostState.resultText), lostState.resultText.split('\n')[0]);
  await clickBtn('btnHintLose');
  const loseTip = await evalJs(page, "({hidden: (document.getElementById('losetip')||{}).hidden, text: (document.getElementById('losetip')||{}).innerText || ''})");
  check('输棋后能给「上一手该怎么封」的提示', loseTip.hidden === false && /号点/.test(loseTip.text), loseTip.text.slice(0, 50));
  await shot(page, OUT + '/g7-fox-lose-mobile.png');

  // ---------- 8. 树关（4 步） ----------
  await evalJs(page, `document.querySelector('.levelbar button[data-level="tree"]').click()`);
  await sleep(200);
  const tree = await state();
  check('切到树关：9 个点、狐狸 3 号、步数归零', tree.levelId === 'tree' && tree.nodes === 9 && tree.foxNode === '2' && tree.steps === 0, `nodes=${tree.nodes} fox=${tree.foxNode}`);
  check('树关移动端无溢出', tree.scrollW <= tree.innerW, `${tree.scrollW}/${tree.innerW}`);
  const usedTree = await playByHints(true);
  const treeWin = await state();
  check('树关按提示 4 步围死', treeWin.phase === 'win' && treeWin.steps === 4 && usedTree === 4, `steps=${treeWin.steps} used=${usedTree}`);
  check('树关结算是 0 个环（说明树没有绕路）', /0 个独立环/.test(treeWin.resultText) || /，有 0 个独立环/.test(treeWin.resultText), String(/0 个独立环/.test(treeWin.resultText)));

  // ---------- 9. 网格关（6 步） ----------
  await evalJs(page, `document.querySelector('.levelbar button[data-level="grid"]').click()`);
  await sleep(200);
  const grid = await state();
  check('切到网格关：12 个点、狐狸 3 号、步数归零', grid.levelId === 'grid' && grid.nodes === 12 && grid.foxNode === '2' && grid.steps === 0, `nodes=${grid.nodes} fox=${grid.foxNode}`);
  await shot(page, OUT + '/g7-fox-grid-boot-mobile.png');
  const usedGrid = await playByHints(true);
  const gridWin = await state();
  check('网格关按提示 6 步围死（最难一关）', gridWin.phase === 'win' && gridWin.steps === 6 && usedGrid === 6, `steps=${gridWin.steps} used=${usedGrid}`);
  check('网格关结算给出 Menger 下界 3 与实际 6 步', /Menger/.test(gridWin.resultText) && /3/.test(gridWin.resultText) && /6/.test(gridWin.resultText), gridWin.resultText.split('\n')[1] || '');
  check('网格关移动端无溢出', gridWin.scrollW <= gridWin.innerW, `${gridWin.scrollW}/${gridWin.innerW}`);
  await shot(page, OUT + '/g7-fox-grid-win-mobile.png');

  // ---------- 10. 换一关 / 埋点 / 报错 ----------
  await clickBtn('btnNextLevel');
  const nextLv = await state();
  check('结算页「换一关」能切到下一关并重置', nextLv.levelId === 'ring' && nextLv.steps === 0, nextLv.levelId);
  const events = await evalJs(page, `(() => { try { return Object.keys(window.counters.summary()); } catch (e) { return ['__no_ls__']; } })()`);
  check('埋点记录了封路与胜负事件', Array.isArray(events) && (events.indexOf('foxhunt_block') >= 0 && events.indexOf('foxhunt_win') >= 0 || events[0] === '__no_ls__'), JSON.stringify(events));
  const errors = await evalJs(page, 'window.__errors');
  check('整场无未捕获 JS 错误', Array.isArray(errors) && errors.length === 0, JSON.stringify(errors));

  // ---------- 11. 桌面视口 ----------
  await navigate(page, PAGE, { width: 1280, height: 900 });
  await sleep(500);
  const desk = await state();
  check('桌面 1280px 无溢出、图形正常', desk.scrollW <= desk.innerW && desk.nodes === 6, `${desk.scrollW}/${desk.innerW}`);
  await shot(page, OUT + '/g7-fox-desktop.png');
} catch (err) {
  check('E2E 执行异常', false, String(err && err.message ? err.message : err));
} finally {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n=== ${pass}/${results.length} PASS ===`);
  fs.writeFileSync(OUT + '/g7-fox-e2e.json', JSON.stringify(results, null, 2));
  await cdp.close();
  process.exit(pass === results.length ? 0 : 1);
}
