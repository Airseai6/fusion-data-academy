"""
验证 b8e1d32 的评分改动
========================
报告里的退化解：R0=1.2m, a=1.84m (A=0.65，物理上不存在), Q=17.72 → 原来拿 94 分 A

新规则应该有：
  - 预算 300 上限
  - A 级要求：>=80 分 且 预算内 且 寿命>=2年 且 热流<15 且 Q_eff>=5
"""
from playwright.sync_api import sync_playwright
from pathlib import Path

ROOT = Path(r"D:\hermesWorkspace\projects\github-pages").resolve()
URL = "file:///" + str(ROOT / "lab" / "design.html").replace("\\", "/")

with sync_playwright() as pw:
    try:
        b = pw.chromium.launch(channel="chrome", headless=True)
    except Exception:
        b = pw.chromium.launch(headless=True)
    ctx = b.new_context()
    p = ctx.new_page()
    p.on("pageerror", lambda e: print("  ⚠ JS 错误:", str(e)[:100]))
    p.goto(URL)
    p.wait_for_timeout(600)

    print("=" * 68)
    print("  《造一台》评分验证 · b8e1d32")
    print("=" * 68)

    # 看有哪些全局变量
    keys = p.evaluate("""Object.keys(window).filter(k =>
        ['D','BUDGET','computeScore','renderScene','SCENES'].includes(k))""")
    print(f"\n  全局: {keys}")

    budget = p.evaluate("typeof BUDGET !== 'undefined' ? BUDGET : null")
    print(f"  BUDGET = {budget}")

    # 退化解（报告里的）
    print("\n【测试 1】报告里的退化解：R0=1.2, a=1.84, Q≈17.7")
    r1 = p.evaluate("""(() => {
        const out = {};
        try {
            Object.assign(D, { R0: 1.2, a: 1.84, Bt: 12, kappa: 1.6, delta: 0.35,
                               Ip: 67.7, Pheat: 50, cost: 97, trust: 50, flags: {} });
            if (typeof computeScore === 'function') {
                const s = computeScore();
                out.score = s.score !== undefined ? s.score : s;
                out.grade = s.grade;
                out.breakdown = s.breakdown || s.parts || null;
                out.reason = s.reason || null;
            } else {
                out.err = 'no computeScore';
            }
        } catch (e) { out.err = e.message; }
        return out;
    })()""")
    print(f"    → {r1}")

    # 正常解（ITER 量级）
    print("\n【测试 2】正常设计：R0=3.5, a=1.13, B=5.3, Q≈2")
    r2 = p.evaluate("""(() => {
        const out = {};
        try {
            Object.assign(D, { R0: 3.5, a: 1.13, Bt: 5.3, kappa: 1.7, delta: 0.4,
                               Ip: 8, Pheat: 50, cost: 0, trust: 50, flags: {} });
            const s = computeScore();
            out.score = s.score !== undefined ? s.score : s;
            out.grade = s.grade;
            out.breakdown = s.breakdown || s.parts || null;
        } catch (e) { out.err = e.message; }
        return out;
    })()""")
    print(f"    → {r2}")

    # 超预算测试
    print("\n【测试 3】超预算：R0=6.0（大装置）")
    r3 = p.evaluate("""(() => {
        const out = {};
        try {
            Object.assign(D, { R0: 6.0, a: 2.0, Bt: 5.3, kappa: 1.8, delta: 0.4,
                               Ip: 15, Pheat: 50, cost: 0, trust: 50, flags: {} });
            const s = computeScore();
            out.score = s.score !== undefined ? s.score : s;
            out.grade = s.grade;
            out.breakdown = s.breakdown || s.parts || null;
        } catch (e) { out.err = e.message; }
        return out;
    })()""")
    print(f"    → {r3}")

    b.close()
