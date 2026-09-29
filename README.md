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

## 上线前必改（2 处占位符）

打开 `index.html`，替换：
- `REPLACE_WITH_YOUR_EMAIL` → 你的联系邮箱
- `REPLACE_WITH_YOUR_GITHUB` → 你的 GitHub 用户名（出现 2 次）

## 用途

- **Payoneer 注册时"业务网址"** ← 主要用途
- Steam / itch.io / MS Store 的商品页外链
- 产品介绍（客户/合作方查看）
