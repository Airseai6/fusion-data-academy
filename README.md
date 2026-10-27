# Fusion Data Academy — 业务官网（GitHub Pages）

这是一个纯静态单页网站，用于作为业务的官方网址（Payoneer / 商店审核需要）。

## 部署步骤（5 分钟）

1. 在 GitHub 新建仓库，名字建议：`fusion-data-academy`（Public）
2. 把本地仓库推上去：
   ```
   git remote add origin https://github.com/<你的用户名>/fusion-data-academy.git
   git branch -M main
   git push -u origin main
   ```
3. 仓库 → Settings → Pages → Source 选 `Deploy from a branch`
   → Branch 选 `main` / `root` → Save
4. 等 1-2 分钟，访问：`https://<你的用户名>.github.io/fusion-data-academy/`

## 互动实验室 / 小游戏

站内三个可直接玩的互动入口（纯静态，无后端）：

- `/lab/` — **Understanding Fusion · 交互实验室**
  - `lab/shot.html`《第一次放电》：7 幕互动小说（约 30 分钟，A/B/C 评级 + 成绩卡）
  - `lab/design.html`《造一台》：9 幕装置设计（约 40 分钟，设计卡）
  - `lab/physics.html` 物理沙盒（量子隧穿 + Lawson 判据，约 5 分钟）
- `/puzzle/` — **反直觉 · 抓狐狸**：3 分钟逻辑小游戏（路径图有必胜策略，环图 n≥3 无解）
- `/puzzle/digits/` — **反直觉 · 数字侦探（Bulls & Cows）**：每日一题，4 位数字 + 6 次机会，
  A/B 反馈 + 候选集排除（信息论）。每日种子按日期稳定；进度/结果存 localStorage；
  练习模式分普通（不重复）/ 困难（可重复）
- `/puzzle/nim/` — **反直觉 · 最后一颗（Nim 取子）**：三堆石子，轮流取子；普通模式取最后者胜，
  可切换「取最后者输」；三档 AI，困难档用 DP 求出的异或最优策略；提示显示二进制与异或和；
  结算含数学解释 + 分享；移动端可玩
- `/puzzle/hanoi/` — **反直觉 · 汉诺塔（最少步）**：3–6 层，把塔从 A 搬到 C；最少步数 2ⁿ−1；
  提示下一步；非法移动拦截、悔棋、结算分享；移动端可玩
- `/puzzle/fifteen/` — **反直觉 · 十五数码（奇偶）**：3×3 / 4×4 滑块拼图；只发可解局面
  （逆序数奇偶校验，4×4 另计空格行）；步数 / 曼哈顿距离 / 本机最佳、撤销、重置、
  目标态缩略图、无解局面演示、分享；移动端可玩
- `/puzzle/24/` — **反直觉 · 24点（限时）**：4 个数字各用一次凑 24，简单（1–9）/ 经典（1–13）；
  只发有解手牌（穷举校验），60 秒倒计时，提示一种解（−5 秒），分数用「分子/分母」精确计算，
  所以 8÷(3−8÷3) 判得到正好 24；结算按解的实际情况区分「要不要经过分数」；分享文字不含解法
- `/puzzle/river/` — **反直觉 · 过河（状态图）**：狼·羊·菜（船容 1、可空船回）与
  传教士·野人（船容 2、必须有人划）两关；只允许让两岸都安全的移动，非法一步当场说明原因；
  BFS 给出最短步数（7 / 11）与反向距离场做「提示下一步」；步数 / 提示 / 非法尝试统计、
  撤销、重置、结算给状态图统计（安全状态数、边数、层宽、独立环数、最短路径条数）+ 分享

当前状态（2026-10-27）：

- P0 已修复（commit `e9fa1d8`：序章出口、抓狐狸重做、E2E 闸门）；
- P1 补齐：跨页出口 / 公众号 CTA、shot 幕次门控（碰滑杆、q(0)≥1、跳过空载 -10 信任、去噪影响误差）、design 退化几何与 Ip>30 MA 拦截。
- G1《数字侦探 · Bulls & Cows》实现：每日种子、A/B 反馈、非法输入不扣次数、
  刷新恢复、分享文案、埋点（game_start / game_win / game_fail / share）；入口在首页与 `/puzzle/`。
- G2《最后一颗 · Nim 取子》已上线（2026-10-27，commit `66ecca3`）：三堆石子、两种胜负模式、
  三档 AI（困难档 DP 最优）、二进制提示、悔棋、结算解释 + 分享；入口 `/brain/` 与 `/puzzle/`。
- G3《汉诺塔 · 最少步》已上线（2026-10-27，commit `6d43084`）：3–6 层、最少步 2ⁿ−1、
  BFS 提示下一步、非法移动拦截、悔棋、结算分享；入口 `/brain/` 与 `/puzzle/`。
- G4《十五数码 · 奇偶》已上线（2026-10-27，commit `ec858a7`）：3×3 / 4×4、逆序数奇偶只生成可解局面、
  步数 / 曼哈顿 / 本机最佳、撤销重置、目标态、无解演示、分享；逻辑单测 14/14 + live 浏览器 E2E 19/19；入口 `/brain/` 与 `/puzzle/`。
- G5《24点 · 限时》已上线（2026-10-27，commit `44d605b`）：两档难度、只出有解手牌、60 秒倒计时、提示扣时、
  点击与键盘两种输入、尝试/连对统计、分享不含解法；逻辑单测 18/18（1–13 全 1820 种手牌与独立位集 DP 逐一比对）
  + live 浏览器 E2E 33/33（390px 无溢出、超时/通关/重复牌/难度切换）；入口 `/brain/` 与 `/puzzle/`。
- G6《过河 · 状态图》已实现（分支 `feat/g6-river`，待 live 验收，未直推 main）：
  狼羊菜（7 步）+ 传教士野人（11 步）两关，状态向量 = 各物在出发岸的个数 × 船位，
  规则以「安全判定函数」注入，BFS 建状态图 + 反向距离场做提示；结算给出安全状态数、
  边数、各层宽度、独立环数与最短路径条数，并给出「允许空船只要 5 步」的规则反事实；
  逻辑单测 17/17、浏览器 E2E 29/29；入口 `/brain/` 与 `/puzzle/`。

本地 E2E（真实浏览器点击，不以 HTTP 200 为准）：

```
pip install playwright && playwright install chromium
python tests/e2e_test.py --root .
```

没有 Playwright 时，至少用 `node --check` 抽检内联脚本，并起本地静态服务器人工点一遍。
数字侦探另有**无浏览器逻辑单测**（真实执行页面内联 JS，断言 A/B、每日种子、候选集）：

```
node tests/digits_logic_test.mjs
node --test tests/nim_logic_test.mjs
node tests/e2e_nim.mjs
node --test tests/hanoi_logic_test.mjs
node tests/e2e_hanoi.mjs
node --test tests/fifteen_logic_test.mjs
node tests/e2e_fifteen.mjs
node --test tests/twentyfour_logic_test.mjs
node tests/e2e_twentyfour.mjs
node --test tests/river_logic_test.mjs
node tests/e2e_river.mjs
```

E2E 的 `[G]` 段覆盖 G1 验收：首页/puzzle 入口卡片、每日种子稳定、非法输入不扣次数、
刷新恢复、完整赢一局、分享文案、输一局、埋点事件。G2 Nim 另有浏览器 E2E（赢/输/模式切换/提示/移动端，8/8）；G3 汉诺塔有逻辑单测 5/5 + 浏览器 E2E 6/6（最优 7 步/非法移动/提示/层数切换/移动端）；G4 十五数码有逻辑单测 14/14（含 3×3 全图穷举 181440 状态验证奇偶判据）+ 浏览器 E2E 19/19（可解性/步数/撤销/重置/4×4/键控/无解演示/移动端无溢出）。G5 24点有逻辑单测 18/18（1–13 全部 1820 种手牌与独立位集 DP 逐一比对、解表达式自证等于 24）+ 浏览器 E2E 30/30（首屏/点击与键盘输入/错答拦截/分数解通关/提示扣时/超时结算/换题/重复牌/难度切换/390px 无溢出/无 JS 报错）。
G6 过河有逻辑单测 17/17（独立 IDDFS 交叉验证 7 步可达 / 6 步不可达、11 步可达 / 10 步不可达、
安全状态数与经典结论一致、边可逆性、最短路径条数与独立 BFS 计数一致）
+ 浏览器 E2E 29/29（装船/卸船/容量拦截/非法一步被拒并说明原因/撤销/重置/提示不下结论、
按最优解 7 步与 11 步通关、分享不含走法、空船开船被拒、390px 与 1280px 无溢出、无 JS 报错）。

## 上线前必改（2 处占位符）

打开 `index.html`，替换：
- `REPLACE_WITH_YOUR_EMAIL` → 你的联系邮箱
- `REPLACE_WITH_YOUR_GITHUB` → 你的 GitHub 用户名（出现 2 次）

## 用途

- **Payoneer 注册时"业务网址"** ← 主要用途
- Steam / itch.io / MS Store 的商品页外链
- 产品介绍（客户/合作方查看）
