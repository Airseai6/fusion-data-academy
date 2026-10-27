// G5 24点浏览器 E2E（CDP，移动端视口 390×844）。
// 运行：node tests/e2e_twentyfour.mjs
// 指到本地 HTTP / live：TF_URL=https://airseai6.github.io/fusion-data-academy/puzzle/24/ node tests/e2e_twentyfour.mjs
import fs from 'node:fs';
import { launch, newTab, navigate, evalJs, shot, sleep } from 'file:///D:/DSHWorkspace/playtest/cdp.mjs';

const PAGE = process.env.TF_URL || 'file:///D:/hermesWorkspace/projects/github-pages/puzzle/24/index.html';
const OUT = 'D:/DSHWorkspace/playtest/shots-e2e';
const ROOT = 'D:/hermesWorkspace/projects/github-pages';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' | ' + detail : ''}`);
};

const cdp = await launch({ port: 9382 });
const page = await newTab(cdp);
const setExpr = (text) => evalJs(page, `(() => {
  const el = document.getElementById('expr');
  el.value = ${JSON.stringify(text)};
  el.dispatchEvent(new Event('input', { bubbles: true }));
})()`);
const enter = () => evalJs(page, `document.getElementById('expr').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
const state = () => evalJs(page, `({
  hand: window.__24.hand.slice(),
  expr: window.__24.expr,
  phase: window.__24.phase,
  timeLeft: window.__24.timeLeft,
  attempts: window.__24.attempts,
  hints: window.__24.hints,
  streak: window.__24.streak,
  solvable: window.TwentyFour.hasSolution(window.__24.hand)
})`);

try {
  // 提前埋好错误收集器，用来验证「没有未捕获的 JS 报错」
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__errors = [];
      window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
      window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection:' + e.reason));`,
  });
  await navigate(page, PAGE, { width: 390, height: 844, mobile: true });
  await sleep(600);

  // --- 1. 首屏 ---
  const boot = await evalJs(page, `({
    nums: document.querySelectorAll('.num').length,
    pad: document.querySelectorAll('.pad button').length,
    timer: document.getElementById('tnum')?.innerText || '',
    fill: document.getElementById('tfill')?.style.width || '',
    title: document.title,
    analytics: !!window.counters,
    expr: !!document.getElementById('expr'),
    submit: !!document.getElementById('btnSubmit'),
    hint: !!document.getElementById('btnHint'),
    minTile: Math.min(...[...document.querySelectorAll('.num')].map(e => e.getBoundingClientRect().height)),
    scrollW: document.documentElement.scrollWidth,
    innerW: innerWidth
  })`);
  check('首屏：4 张数字牌 + 运算符键盘 + 倒计时 + 提交/提示按钮',
    boot.nums === 4 && boot.pad >= 8 && boot.expr && boot.submit && boot.hint, JSON.stringify({ nums: boot.nums, pad: boot.pad }));
  // 页面加载 + sleep(600) 已经吃掉 1 秒左右，所以只要求仍在 55 秒以上、进度条 ≥90%
  check('倒计时从 60 秒开始倒数，进度条接近满格',
    parseFloat(boot.timer) > 55 && parseFloat(boot.fill) >= 90, `${boot.timer} / ${boot.fill}`);
  check('移动端 390px 无横向溢出', boot.scrollW <= boot.innerW, `${boot.scrollW}/${boot.innerW}`);
  check('数字牌触控目标 ≥ 44px', boot.minTile >= 44, `${boot.minTile.toFixed(1)}px`);
  check('analytics.js 已加载', boot.analytics, String(boot.analytics));
  await shot(page, OUT + '\\g5-24-play-mobile.png');

  // --- 2. 点数字 / 点运算符：算式拼起来，用过的牌变灰 ---
  await evalJs(page, 'newHand({ hand: [3, 4, 6, 8] })');       // 固定一手无重复的牌，断言才稳定
  await sleep(150);
  const first = await state();
  await evalJs(page, "document.querySelectorAll('.num')[0].click()");
  await sleep(60);
  await evalJs(page, "document.querySelector('[data-tok=\"+\"]').click()");
  await sleep(60);
  await evalJs(page, "document.querySelectorAll('.num')[1].click()");
  await sleep(80);
  const typed = await evalJs(page, `({
    value: document.getElementById('expr').value,
    disabled: document.querySelectorAll('.num:disabled').length
  })`);
  check('点数字和运算符能拼出算式（点击输入）', typed.value === `${first.hand[0]}+${first.hand[1]}`, typed.value);
  check('已经用掉的牌变灰、不能再点', typed.disabled === 2, `disabled=${typed.disabled}`);

  // 重复数字：用掉一张 5 之后，另一张 5 必须还能点（这里曾经踩过 bug）
  await evalJs(page, 'newHand({ hand: [5, 5, 6, 8] })');
  await sleep(150);
  await evalJs(page, "document.querySelectorAll('.num')[0].click()");
  await sleep(100);
  const dupState = await evalJs(page, `({
    value: document.getElementById('expr').value,
    badge: [...document.querySelectorAll('.num .copies')].map(e => e.textContent).join(','),
    fivesEnabled: [...document.querySelectorAll('.num')].filter(e => e.textContent.startsWith('5') && !e.disabled).length,
    fivesSpent: [...document.querySelectorAll('.num')].filter(e => e.textContent.startsWith('5') && e.classList.contains('spent')).length
  })`);
  check('手牌有重复数字时，用掉一张后另一张仍可点并显示剩余张数',
    dupState.fivesEnabled === 2 && dupState.fivesSpent === 0 && dupState.badge === '×1,×1', JSON.stringify(dupState));

  // --- 3. 错答案：提示原因且不结算 ---
  await evalJs(page, 'newHand({ hand: [3, 4, 6, 8] })');
  await sleep(150);
  await evalJs(page, "document.getElementById('btnClear').click()");
  await sleep(60);
  await setExpr('3+4');
  await evalJs(page, "document.getElementById('btnSubmit').click()");
  await sleep(100);
  const wrong = await evalJs(page, `({ msg: document.getElementById('msg').innerText, phase: window.__24.phase, attempts: window.__24.attempts, result: !!document.querySelector('.result') })`);
  check('少用数字提交被拦下并说明原因', wrong.phase === 'playing' && !wrong.result && /各用一次|必须/.test(wrong.msg), wrong.msg);
  check('每次提交都计入尝试次数', wrong.attempts === 1, String(wrong.attempts));

  // 4 个数全用上但结果不是 24（3+4+6+8 = 21）
  await setExpr('3+4+6+8');
  await evalJs(page, "document.getElementById('btnSubmit').click()");
  await sleep(100);
  const wrongVal = await evalJs(page, "document.getElementById('msg').innerText");
  check('值不等于 24 时给出实际结果', /不是 24/.test(wrongVal), wrongVal);

  // --- 4. 分数解通关（8/(3-8/3) = 24）---
  await evalJs(page, "newHand({ hand: [3, 3, 8, 8] })");
  await sleep(150);
  await setExpr('8/(3-8/3)');
  await enter();
  await sleep(200);
  const win = await evalJs(page, `({
    phase: window.__24.phase,
    streak: window.__24.streak,
    heading: document.querySelector('.result h2')?.innerText || '',
    math: document.querySelector('.result .math')?.innerText || '',
    share: document.querySelector('.sharebox pre')?.innerText || '',
    mine: window.__24.userExpr,
    fail: !!document.querySelector('.result.fail')
  })`);
  check('分数中间步的算式能通关（8÷(3−8÷3)）', win.phase === 'win' && !win.fail && win.heading.includes('24'), win.heading.replace(/\s+/g, ' '));
  check('结算面板回显我的算式并给出一种解与穷举统计',
    win.math.includes('一种解') && /种手牌/.test(win.math) && win.mine === '8÷(3−8÷3)', win.math.split('\n')[0]);
  check('分享文案不含解法（没有括号与运算符）',
    !!win.share && /https:\/\//.test(win.share) && !/[÷×()]/.test(win.share) && !win.share.includes('8/3'),
    win.share.split('\n')[0]);
  check('分享文案带连对战绩', win.share.includes('连对'), win.share.split('\n')[0].slice(0, 40));
  await shot(page, OUT + '\\g5-24-win-mobile.png');

  // --- 5. 提示：给出正确解、扣时间、可继续作答 ---
  await evalJs(page, "newHand({ hand: [1, 5, 5, 5] })");
  await sleep(120);
  await evalJs(page, "document.getElementById('btnHint').click()");
  await sleep(150);
  const hinted = await evalJs(page, `(() => {
    const t = document.getElementById('hintbox');
    const expr = t ? t.querySelector('b').innerText : '';
    const r = window.TwentyFour.evaluateExpression(expr);
    return {
      shown: !!t,
      expr,
      value: r.value ? r.value.n + '/' + r.value.d : String(r.error),
      numbers: window.TwentyFour.numbersIn(expr).sort().join(','),
      hand: window.__24.hand.slice().sort().join(','),
      hints: window.__24.hints,
      timeLeft: window.__24.timeLeft,
      phase: window.__24.phase
    };
  })()`);
  check('提示给出一种解，且该解精确等于 24、用数与手牌一致',
    hinted.shown && hinted.value === '24/1' && hinted.numbers === hinted.hand, `${hinted.expr} = ${hinted.value}`);
  check('用提示扣掉 5 秒且不结算', hinted.hints === 1 && hinted.timeLeft <= 55.5 && hinted.phase === 'playing', `left=${hinted.timeLeft.toFixed(1)}`);

  // 结算文案不能一律说「必须用分数」：(5+5)+(6+8) 是纯整数解
  await evalJs(page, 'newHand({ hand: [5, 5, 6, 8] })');
  await sleep(150);
  await evalJs(page, 'window.__24.startAt = Date.now() - 61000');
  await sleep(600);
  const noFracText = await evalJs(page, "document.querySelector('.result .math')?.innerText || ''");
  check('纯整数解的结算文案不谎称「必须用分数」',
    noFracText.includes('不用分数') && !noFracText.includes('只肯用整数'), noFracText.split('\n')[1] || '');

  // 下一手换成必须用分数的经典牌，文案要改成分数版
  await evalJs(page, 'newHand({ hand: [3, 3, 8, 8] })');
  await sleep(150);
  await setExpr('8/(3-8/3)');
  await enter();
  await sleep(200);
  const fracText = await evalJs(page, "document.querySelector('.result .math')?.innerText || ''");
  check('必须用分数的手牌，结算文案点出分数中间值',
    /分数中间值/.test(fracText) && !fracText.includes('不用分数'), fracText.split('\n')[1] || '');
  await evalJs(page, "newHand({ hand: [1, 5, 5, 5] })");
  await sleep(150);

  // --- 6. 倒计时真的在走 ---
  const t1 = await evalJs(page, 'window.__24.timeLeft');
  await sleep(900);
  const t2 = await evalJs(page, 'window.__24.timeLeft');
  check('倒计时在走（1 秒后减少约 1 秒）', t1 - t2 > 0.6 && t1 - t2 < 1.6, `${t1.toFixed(1)} → ${t2.toFixed(1)}`);

  // --- 7. 超时结算 ---
  await evalJs(page, 'window.__24.startAt = Date.now() - 61000');
  await sleep(600);
  const failed = await evalJs(page, `({
    phase: window.__24.phase,
    isFail: !!document.querySelector('.result.fail'),
    heading: document.querySelector('.result.fail h2')?.innerText || '',
    math: document.querySelector('.result.fail .math')?.innerText || '',
    streak: window.__24.streak,
    share: document.querySelector('.sharebox pre')?.innerText || ''
  })`);
  check('时间到进入失败结算并清空连对', failed.phase === 'fail' && failed.isFail && failed.streak === 0, failed.heading.replace(/\s+/g, ' '));
  check('失败结算给出正确解（不含判错的空值）', /一种解：\d/.test(failed.math), failed.math.split('\n')[0]);
  check('失败页的分享文案同样不含解法', !/[÷×()]/.test(failed.share), failed.share.split('\n')[0]);
  await shot(page, OUT + '\\g5-24-timeout-mobile.png');

  // --- 8. 换一题：新牌、计时重置、可继续玩 ---
  await evalJs(page, "document.getElementById('btnAgain').click()");
  await sleep(200);
  const next = await state();
  check('换一题后计时重置到 60 秒并回到可玩状态',
    next.phase === 'playing' && next.timeLeft > 58 && next.solvable === true, `left=${next.timeLeft.toFixed(1)}`);

  // --- 9. 出题保证有解：连抽 12 手都验一遍 ---
  const sweep = await evalJs(page, `(() => {
    const F = window.TwentyFour;
    const bad = [];
    const keys = new Set();
    let dup = 0;
    for (let i = 0; i < 12; i++) {
      newHand();
      const h = window.__24.hand;
      if (h.length !== 4) bad.push('length:' + h.join(','));
      if (!F.hasSolution(h)) bad.push('unsolvable:' + h.join(','));
      const k = F.handKey(h);
      if (keys.has(k)) dup++;
      keys.add(k);
    }
    return { bad, dup, distinct: keys.size };
  })()`);
  check('连抽 12 手全部有解、无残缺手牌', sweep.bad.length === 0, JSON.stringify(sweep.bad));
  check('换题不会连着出同一手牌', sweep.dup === 0, `distinct=${sweep.distinct}/12`);

  // --- 10. 经典难度 1–13 ---
  await evalJs(page, "(() => { const el = document.getElementById('difficulty'); el.value = 'classic'; el.dispatchEvent(new Event('change')); })()");
  await sleep(250);
  const classic = await evalJs(page, `({
    hand: window.__24.hand.slice(),
    diff: window.__24.difficulty,
    solvable: window.TwentyFour.hasSolution(window.__24.hand),
    maxOk: window.__24.hand.every(n => n >= 1 && n <= 13),
    scrollW: document.documentElement.scrollWidth,
    innerW: innerWidth,
    minTile: Math.min(...[...document.querySelectorAll('.num')].map(e => e.getBoundingClientRect().height))
  })`);
  check('经典难度出的牌都在 1–13 且有解', classic.diff === 'classic' && classic.maxOk && classic.solvable, classic.hand.join(','));
  check('经典难度移动端仍无溢出、触控目标 ≥ 44px', classic.scrollW <= classic.innerW && classic.minTile >= 44, `${classic.scrollW}/${classic.innerW}, tile=${classic.minTile.toFixed(1)}px`);
  await shot(page, OUT + '\\g5-24-classic-mobile.png');

  // --- 11. 键盘输入直接打字也能提交 ---
  const kbHand = await evalJs(page, 'window.__24.hand.slice()');
  const kbSolution = await evalJs(page, 'window.TwentyFour.bestSolution(window.__24.hand)');
  const ascii = kbSolution.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  await setExpr(ascii);
  await enter();
  await sleep(200);
  const kb = await evalJs(page, `({ phase: window.__24.phase, mine: window.__24.userExpr, heading: document.querySelector('.result h2')?.innerText || '' })`);
  const expected = ascii.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
  check('键盘直接输入 ASCII 算式（* 与 /）也能判定通过并回显排版符号',
    kb.phase === 'win' && kb.mine === expected, `${kbHand.join(',')} 输入 ${ascii} → ${kb.mine}`);

  // --- 12. 控制台无报错 ---
  const errors = await evalJs(page, 'window.__errors || []');
  check('页面没有未捕获的 JS 报错', Array.isArray(errors) && errors.length === 0, JSON.stringify(errors));

  // --- 13. 入口卡片：/brain/ 与 /puzzle/ 都指向本作，且真能点进来 ---
  const brainHtml = fs.readFileSync(ROOT + '/brain/index.html', 'utf8');
  const puzzleHtml = fs.readFileSync(ROOT + '/puzzle/index.html', 'utf8');
  check('两个入口页都加了 24点 链接', brainHtml.includes('../puzzle/24/') && puzzleHtml.includes('./24/'), '');

  await navigate(page, 'file:///' + ROOT + '/brain/index.html', { width: 390, height: 844, mobile: true });
  await sleep(400);
  const entry = await evalJs(page, `(() => {
    const a = [...document.querySelectorAll('a.card')].find((x) => (x.getAttribute('href') || '').includes('24'));
    return a ? { href: a.getAttribute('href'), name: a.querySelector('.name')?.textContent || '' } : null;
  })()`);
  check('大脑保健操 hub 能看到 24点 卡片', !!entry && entry.name === '24点', JSON.stringify(entry));

  // file:// 下以 / 结尾的目录 URL 会显示目录索引而不是 index.html，手工补上（GitHub Pages 上由服务器补）
  const hubTarget = new URL(entry.href, 'file:///' + ROOT + '/brain/index.html').href;
  await navigate(page, hubTarget.endsWith('/') ? hubTarget + 'index.html' : hubTarget, { width: 390, height: 844, mobile: true });
  await sleep(500);
  const landed = await evalJs(page, `({
    title: document.title,
    nums: document.querySelectorAll('.num').length,
    phase: window.__24 ? window.__24.phase : null,
    scrollW: document.documentElement.scrollWidth,
    innerW: innerWidth
  })`);
  check('从 hub 点进来能直接开局（无 404、无溢出）',
    landed.nums === 4 && landed.phase === 'playing' && /24点/.test(landed.title) && landed.scrollW <= landed.innerW,
    JSON.stringify(landed));
  await shot(page, OUT + '\\g5-24-from-hub-mobile.png');
} finally {
  await page.close();
  await cdp.close();
}
const fail = results.filter((r) => !r.ok);
console.log(JSON.stringify({ pass: results.length - fail.length, fail: fail.length, failed: fail }, null, 2));
process.exit(fail.length ? 1 : 0);
