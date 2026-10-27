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

当前状态（2026-10-27）：

- P0 已修复（commit `e9fa1d8`：序章出口、抓狐狸重做、E2E 闸门）；
- P1 补齐：跨页出口 / 公众号 CTA、shot 幕次门控（碰滑杆、q(0)≥1、跳过空载 -10 信任、去噪影响误差）、design 退化几何与 Ip>30 MA 拦截。
- G1《数字侦探 · Bulls & Cows》实现：每日种子、A/B 反馈、非法输入不扣次数、
  刷新恢复、分享文案、埋点（game_start / game_win / game_fail / share）；入口在首页与 `/puzzle/`。
- G2《最后一颗 · Nim 取子》已上线（2026-10-27，commit `66ecca3`）：三堆石子、两种胜负模式、
  三档 AI（困难档 DP 最优）、二进制提示、悔棋、结算解释 + 分享；入口 `/brain/` 与 `/puzzle/`。
- G3《汉诺塔 · 最少步》已上线（2026-10-27，commit `6d43084`）：3–6 层、最少步 2ⁿ−1、
  BFS 提示下一步、非法移动拦截、悔棋、结算分享；入口 `/brain/` 与 `/puzzle/`。
- G4《十五数码 · 奇偶》分支 `feat/g4-fifteen`：3×3 / 4×4、逆序数奇偶只生成可解局面、
  步数 / 曼哈顿 / 本机最佳、撤销重置、目标态、无解演示、分享；逻辑单测 14/14 + 浏览器 E2E 19/19；入口 `/brain/` 与 `/puzzle/`。

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
```

E2E 的 `[G]` 段覆盖 G1 验收：首页/puzzle 入口卡片、每日种子稳定、非法输入不扣次数、
刷新恢复、完整赢一局、分享文案、输一局、埋点事件。G2 Nim 另有浏览器 E2E（赢/输/模式切换/提示/移动端，8/8）；G3 汉诺塔有逻辑单测 5/5 + 浏览器 E2E 6/6（最优 7 步/非法移动/提示/层数切换/移动端）；G4 十五数码有逻辑单测 14/14（含 3×3 全图穷举 181440 状态验证奇偶判据）+ 浏览器 E2E 19/19（可解性/步数/撤销/重置/4×4/键控/无解演示/移动端无溢出）。

## 上线前必改（2 处占位符）

打开 `index.html`，替换：
- `REPLACE_WITH_YOUR_EMAIL` → 你的联系邮箱
- `REPLACE_WITH_YOUR_GITHUB` → 你的 GitHub 用户名（出现 2 次）

## 用途

- **Payoneer 注册时"业务网址"** ← 主要用途
- Steam / itch.io / MS Store 的商品页外链
- 产品介绍（客户/合作方查看）
