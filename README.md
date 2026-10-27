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

当前状态（2026-10-27）：

- P0 已修复（commit `e9fa1d8`：序章出口、抓狐狸重做、E2E 闸门）；
- P1 补齐：跨页出口 / 公众号 CTA、shot 幕次门控（碰滑杆、q(0)≥1、跳过空载 -10 信任、去噪影响误差）、design 退化几何与 Ip>30 MA 拦截。
- G1《数字侦探 · Bulls & Cows》实现：每日种子、A/B 反馈、非法输入不扣次数、
  刷新恢复、分享文案、埋点（game_start / game_win / game_fail / share）；入口在首页与 `/puzzle/`。

本地 E2E（真实浏览器点击，不以 HTTP 200 为准）：

```
pip install playwright && playwright install chromium
python tests/e2e_test.py --root .
```

没有 Playwright 时，至少用 `node --check` 抽检内联脚本，并起本地静态服务器人工点一遍。
数字侦探另有**无浏览器逻辑单测**（真实执行页面内联 JS，断言 A/B、每日种子、候选集）：

```
node tests/digits_logic_test.mjs
```

E2E 的 `[G]` 段覆盖 G1 验收：首页/puzzle 入口卡片、每日种子稳定、非法输入不扣次数、
刷新恢复、完整赢一局、分享文案、输一局、埋点事件。

## 上线前必改（2 处占位符）

打开 `index.html`，替换：
- `REPLACE_WITH_YOUR_EMAIL` → 你的联系邮箱
- `REPLACE_WITH_YOUR_GITHUB` → 你的 GitHub 用户名（出现 2 次）

## 用途

- **Payoneer 注册时"业务网址"** ← 主要用途
- Steam / itch.io / MS Store 的商品页外链
- 产品介绍（客户/合作方查看）
