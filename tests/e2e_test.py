"""
Playwright E2E · 5 个互动作品
=============================
目的：防止再拿 "HTTP 200" 当验证。

跑法：
    python e2e_test.py --root <含 html 的目录> [--headed]

检查项（对应试玩报告 P0-3）：
  a) 每个页面的每个场景都有可用前进控件（专治序章卡死）
  b) 抓狐狸 L1：按最优策略必能通关；乱点必失败；失败页可达
  c) 抓狐狸 L2：任意序列都判定为"不能保证"；3 次后揭示页可达
  d) 第一次放电：开场 → 七幕 → 成绩卡
  e) 造一台：序章 → 八幕 → 设计卡
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

PASS, FAIL = [], []


def ok(name, detail=""):
    PASS.append(name)
    print(f"  ✓ {name}{'  ' + detail if detail else ''}")


def bad(name, detail=""):
    FAIL.append(name)
    print(f"  ✗ {name}{'  ' + detail if detail else ''}")


def run(root: Path, headed=False):
    pz = root / "puzzle" / "index.html"
    shot = root / "lab" / "shot.html"
    design = root / "lab" / "design.html"
    physics = root / "lab" / "physics.html"

    for p, label in [(pz, "puzzle"), (shot, "shot"), (design, "design"), (physics, "physics")]:
        if not p.exists():
            bad(f"缺文件 {label}", str(p))
            return

    with sync_playwright() as pw:
        try:
            browser = pw.chromium.launch(channel="chrome", headless=not headed)
        except Exception:
            browser = pw.chromium.launch(headless=not headed)
        ctx = browser.new_context(viewport={"width": 414, "height": 900})
        page = ctx.new_page()
        page.on("pageerror", lambda e: bad("JS 运行时错误", str(e)[:120]))

        def url(p):
            return "file:///" + str(p).replace("\\", "/")

        # ══════════════════════════════════════════════
        # A. 抓狐狸 · 第一关：最优策略必赢
        # ══════════════════════════════════════════════
        print("\n[A] 抓狐狸 L1 · 最优策略")
        page.goto(url(pz))
        page.click("button.primary")           # 开始
        page.wait_for_timeout(300)

        # 固定狐狸起点为 5 号（index 4），确保 2,3,4,2,3,4 能全走完
        page.evaluate("G.fox = 4; G.possible = new Set([0,1,2,3,4]); G.day = 1; G.history = []; G.checked = new Set(); render();")

        seq = [1, 2, 3, 1, 2, 3]   # 2,3,4,2,3,4
        for idx in seq:
            page.evaluate(f"onCheck({idx})")
            page.wait_for_timeout(120)

        won = page.evaluate("G.phase === 'win'")
        if won:
            ok("L1 按 2,3,4,2,3,4 通关", f"{page.evaluate('G.history.length')} 天")
        else:
            bad("L1 按最优策略未通关", f"phase={page.evaluate('G.phase')}")

        # 重复查必须允许（第 4 步再查 2 号）
        repeat_ok = page.evaluate("G.history.filter(x=>x===1).length === 2")
        if repeat_ok:
            ok("L1 允许重复查同一个洞")
        else:
            bad("L1 重复查被拦截")

        # ══════════════════════════════════════════════
        # B. 抓狐狸 · 第一关：乱点必失败（失败页可达）
        # ══════════════════════════════════════════════
        print("\n[B] 抓狐狸 L1 · 乱点应失败")
        page.goto(url(pz))
        page.click("button.primary")
        page.wait_for_timeout(200)
        # 固定狐狸在 5 号，连查 1 号 9 次
        page.evaluate("G.fox = 4;")
        for _ in range(9):
            page.evaluate("onCheck(0)")
            page.wait_for_timeout(60)
        lost = page.evaluate("G.phase === 'lose'")
        has_btn = page.evaluate("document.querySelectorAll('button').length > 0")
        if lost:
            ok("L1 乱点 → 失败页可达")
        else:
            bad("L1 乱点未进入失败页", f"day={page.evaluate('G.day')}")
        if has_btn:
            ok("L1 失败页有可用按钮")
        else:
            bad("L1 失败页无按钮（卡死）")

        # ══════════════════════════════════════════════
        # C. 抓狐狸 · 第二关：策略判定 + 揭示页
        # ══════════════════════════════════════════════
        print("\n[C] 抓狐狸 L2 · 策略保证判定")
        page.goto(url(pz) + "?level=2")
        page.wait_for_timeout(200)

        # 初始应是 intro，不该跳过说明页
        phase = page.evaluate("G.phase")
        maxtxt = page.evaluate("G.maxDay")
        if phase == "intro":
            ok("L2 从说明页开始（不跳过）")
        else:
            bad("L2 跳过说明页", f"phase={phase}")
        if maxtxt == 14:
            ok("L2 天数上限 = 14")
        else:
            bad("L2 天数上限不对", str(maxtxt))

        page.click("button.primary")           # 开始组策略
        page.wait_for_timeout(200)

        # 提交 3 条不同序列，都应判"不能保证"
        trials = [[1, 2, 3, 1, 2, 3], [0, 1, 2, 3, 4], [4, 3, 2, 1, 0, 4, 3, 2, 1, 0]]
        for t in trials:
            page.evaluate(f"G.seq = {t}; submitSeq();")
            page.wait_for_timeout(150)
            v = page.evaluate("G.lastVerdict && G.lastVerdict.guaranteed")
            if v is False:
                ok(f"L2 序列 {[x+1 for x in t]} → 判定不能保证",
                   f"{page.evaluate('G.lastVerdict.rows.filter(r=>!r.caught).length')} 个起点逃脱")
            else:
                bad(f"L2 序列 {[x+1 for x in t]} 判定错误", f"guaranteed={v}")

        # 3 次后应能进揭示页
        subs = page.evaluate("G.submissions")
        reveal_btn = page.evaluate("""(() => {
            const bs = [...document.querySelectorAll('button')];
            return bs.some(b => b.textContent.includes('真相'));
        })()""")
        if subs >= 3 and reveal_btn:
            ok("L2 提交 3 次后出现「想知道真相」按钮")
            page.evaluate("goReveal()")
            page.wait_for_timeout(200)
            if page.evaluate("G.phase === 'reveal'"):
                ok("L2 揭示页可达")
            else:
                bad("L2 揭示页打不开")
        else:
            bad("L2 3 次后无揭示入口", f"subs={subs} btn={reveal_btn}")

        # ══════════════════════════════════════════════
        # D. 第一次放电：场景推进 + 成绩卡
        # ══════════════════════════════════════════════
        print("\n[D] 第一次放电 · 全流程")
        page.goto(url(shot))
        page.wait_for_timeout(400)

        # 每个场景都必须有可点的前进控件
        scenes = ["intro", "prologue", "act1", "act2", "act3", "act4", "act5", "act6", "act7"]
        missing = []
        for sc in scenes:
            page.evaluate(f"renderScene('{sc}')")
            page.wait_for_timeout(120)
            n = page.evaluate("document.querySelectorAll('button').length")
            if n == 0:
                missing.append(sc)
        if not missing:
            ok("shot 全部 9 个场景都有按钮")
        else:
            bad("shot 有场景无按钮", ", ".join(missing))

        # 成绩卡：直接渲染 act7 并调用生成函数
        page.evaluate("S.trust = 85; S.flags = {foundPF4:true}; renderScene('act7');")
        page.wait_for_timeout(300)
        has_share = page.evaluate("!!document.getElementById('share-card')")
        if has_share:
            ok("shot 结局有「保存成绩卡」按钮")
        else:
            bad("shot 结局缺成绩卡按钮")

        # 验证 makeShareCard 真的能生成 canvas（不下载，只检查尺寸）
        canvas_ok = page.evaluate("""(() => {
            const orig = document.createElement;
            let w = 0, h = 0;
            document.createElement = function(tag) {
                const el = orig.call(document, tag);
                if (tag === 'canvas') {
                    Object.defineProperty(el, 'width', {set(v){w=v;}, get(){return w;}});
                    Object.defineProperty(el, 'height', {set(v){h=v;}, get(){return h;}});
                }
                return el;
            };
            try { makeShareCard(); } catch(e) { return 'err:' + e.message; }
            finally { document.createElement = orig; }
            return w + 'x' + h;
        })()""")
        if canvas_ok == "1080x1350":
            ok("shot 成绩卡 Canvas 尺寸正确", canvas_ok)
        else:
            bad("shot 成绩卡生成异常", str(canvas_ok))

        # ══════════════════════════════════════════════
        # E. 造一台：场景推进 + 设计卡
        # ══════════════════════════════════════════════
        print("\n[E] 造一台 · 全流程")
        page.goto(url(design))
        page.wait_for_timeout(400)

        scenes2 = ["prologue", "act1", "act2", "act3", "act4", "act5", "act6", "act7", "act8"]
        missing2 = []
        for sc in scenes2:
            page.evaluate(f"renderScene('{sc}')")
            page.wait_for_timeout(120)
            n = page.evaluate("document.querySelectorAll('button').length")
            if n == 0:
                missing2.append(sc)
        if not missing2:
            ok("design 全部 9 个场景都有按钮")
        else:
            bad("design 有场景无按钮", ", ".join(missing2))

        page.evaluate("renderScene('act8')")
        page.wait_for_timeout(300)
        has_share2 = page.evaluate("!!document.getElementById('share-card2')")
        if has_share2:
            ok("design 结局有「保存设计卡」按钮")
        else:
            bad("design 结局缺设计卡按钮")

        canvas2 = page.evaluate("""(() => {
            const orig = document.createElement;
            let w = 0, h = 0;
            document.createElement = function(tag) {
                const el = orig.call(document, tag);
                if (tag === 'canvas') {
                    Object.defineProperty(el, 'width', {set(v){w=v;}, get(){return w;}});
                    Object.defineProperty(el, 'height', {set(v){h=v;}, get(){return h;}});
                }
                return el;
            };
            try { makeDesignCard(); } catch(e) { return 'err:' + e.message; }
            finally { document.createElement = orig; }
            return w + 'x' + h;
        })()""")
        if canvas2 == "1080x1350":
            ok("design 设计卡 Canvas 尺寸正确", canvas2)
        else:
            bad("design 设计卡生成异常", str(canvas2))

        # ══════════════════════════════════════════════
        # F. 物理沙盒：能加载、有交互
        # ══════════════════════════════════════════════
        print("\n[F] 物理沙盒")
        page.goto(url(physics))
        page.wait_for_timeout(400)
        sliders = page.evaluate("document.querySelectorAll('input[type=range]').length")
        if sliders > 0:
            ok("physics 有可交互滑块", f"{sliders} 个")
        else:
            bad("physics 无滑块")

        browser.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=r"D:\hermesWorkspace\projects\github-pages")
    ap.add_argument("--headed", action="store_true")
    a = ap.parse_args()

    root = Path(a.root).resolve()
    print("=" * 70)
    print(f"  E2E · {root}")
    print("=" * 70)

    try:
        run(root, a.headed)
    except PWTimeout as e:
        bad("测试超时", str(e)[:200])
    except Exception as e:
        bad("测试异常", f"{type(e).__name__}: {e}")

    print()
    print("=" * 70)
    print(f"  通过 {len(PASS)}   失败 {len(FAIL)}")
    if FAIL:
        for f in FAIL:
            print(f"    ✗ {f}")
        sys.exit(1)
    print("  ✓ 全部通过")
    sys.exit(0)


if __name__ == "__main__":
    main()
