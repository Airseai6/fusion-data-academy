"""
Playwright E2E · 6 个互动作品
=============================
目的：防止再拿 "HTTP 200" 当验证。

跑法：
    python e2e_test.py --root <含 html 的目录> [--headed]

检查项（对应试玩报告 P0-3 / GAME-BACKLOG G1 验收）：
  a) 每个页面的每个场景都有可用前进控件（专治序章卡死）
  b) 抓狐狸 L1：按最优策略必能通关；乱点必失败；失败页可达
  c) 抓狐狸 L2：任意序列都判定为"不能保证"；3 次后揭示页可达
  d) 第一次放电：开场 → 七幕 → 成绩卡
  e) 造一台：序章 → 八幕 → 设计卡
  f) 数字侦探 G1：入口卡片 → 每日种子稳定 → 非法输入不扣次数 →
     刷新恢复 → 赢一局 → 分享文案 → 输一局 → 埋点事件
"""
import argparse
import functools
import http.server
import json
import socketserver
import sys
import threading
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
    digits = root / "puzzle" / "digits" / "index.html"

    for p, label in [(pz, "puzzle"), (shot, "shot"), (design, "design"),
                     (physics, "physics"), (digits, "digits")]:
        if not p.exists():
            bad(f"缺文件 {label}", str(p))
            return

    # 数字侦探的「刷新恢复」需要真实 localStorage 语义，用本地 HTTP 源跑；
    # 其余旧用例仍用 file://（保持原行为）。A1 live 验收走 GitHub Pages。
    class _Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(_Quiet, directory=str(root))
    srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    web = f"http://127.0.0.1:{port}"

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

        # ══════════════════════════════════════════════
        # G. 数字侦探 · G1 Bulls & Cows
        # ══════════════════════════════════════════════
        print("\n[G] 数字侦探 · G1 Bulls & Cows")
        game_url = web + "/puzzle/digits/"

        # G1) 首页 → 大脑保健操 → 数字侦探（架构调整后：首页不再直链游戏，
        #     改为经 /brain/ hub 中转，所以测两层跳转）
        page.goto(web + "/index.html")
        page.wait_for_timeout(200)
        card = page.query_selector('a.card[href="./brain/"]')
        if card:
            ok("首页有「大脑保健操」入口卡片")
            card.click()
            page.wait_for_timeout(400)
            if "大脑保健操" in page.title():
                ok("首页卡片可进入大脑保健操")
                # 第二层：hub → 数字侦探
                sub = page.query_selector('a.card[href="../puzzle/digits/"]')
                if sub:
                    ok("大脑保健操有数字侦探卡片")
                    sub.click()
                    page.wait_for_timeout(500)
                    if "数字侦探" in page.title():
                        ok("大脑保健操可跳到数字侦探")
                    else:
                        bad("hub 跳转标题不对", page.title())
                else:
                    bad("大脑保健操缺数字侦探卡片")
            else:
                bad("首页卡片跳转标题不对", page.title())
        else:
            bad("首页缺「大脑保健操」入口卡片")

        # G2) 说明页 + 每日种子稳定
        page.goto(game_url)
        page.wait_for_timeout(300)
        if page.evaluate("!!document.getElementById('btn-daily')"):
            ok("数字侦探说明页有每日挑战入口")
        else:
            bad("数字侦探说明页缺每日挑战入口")

        seed_stable = page.evaluate(
            "JSON.stringify(__digits.dailySecret('2026-10-27')) === "
            "JSON.stringify(__digits.dailySecret('2026-10-27'))"
        )
        seed_diff = page.evaluate(
            "JSON.stringify(__digits.dailySecret('2026-10-27')) !== "
            "JSON.stringify(__digits.dailySecret('2026-10-28'))"
        )
        if seed_stable and seed_diff:
            ok("每日种子：同一天稳定、不同天不同")
        else:
            bad("每日种子不稳定", f"same={seed_stable} diff={seed_diff}")

        # G3) 开始每日挑战：非法输入只提示、不扣次数
        page.click("#btn-daily")
        page.wait_for_timeout(250)
        if page.evaluate("D.phase === 'play'"):
            ok("每日挑战可开始")
        else:
            bad("每日挑战没有进入游戏", page.evaluate("D.phase"))

        page.click('[data-digit="1"]')
        page.click('[data-digit="2"]')
        page.click('[data-digit="3"]')
        page.click("#key-submit")
        page.wait_for_timeout(150)
        err_len = page.inner_text(".error")
        if err_len.strip() and page.evaluate("D.guesses.length") == 0 \
                and page.evaluate("D.attemptsLeft") == 6:
            ok("3 位输入被拒且不扣次数", err_len.strip())
        else:
            bad("非法长度输入未正确处理", f"err={err_len!r}")

        for _ in range(3):
            page.click("#key-back")
        for d in ["1", "1", "2", "3"]:
            page.click(f'[data-digit="{d}"]')
        page.click("#key-submit")
        page.wait_for_timeout(150)
        err_dup = page.inner_text(".error")
        if "重复" in err_dup and page.evaluate("D.guesses.length") == 0 \
                and page.evaluate("D.attemptsLeft") == 6:
            ok("重复数字被拒且不扣次数", err_dup.strip())
        else:
            bad("重复数字未被正确处理", f"err={err_dup!r}")

        # G4) 刷新恢复：一次合法错误猜测后刷新，历史与题面都还在
        for _ in range(4):
            page.click("#key-back")
        secret = page.evaluate("[...D.secret].join('')")
        wrong = secret[1:] + secret[0]
        for ch in wrong:
            page.click(f'[data-digit="{ch}"]')
        page.click("#key-submit")
        page.wait_for_timeout(200)
        guesses_before = page.evaluate("D.guesses.length")
        page.reload()
        page.wait_for_timeout(400)
        guesses_after = page.evaluate("D.guesses.length")
        same_secret = page.evaluate("[...D.secret].join('')") == secret
        if guesses_before == 1 and guesses_after == 1 and same_secret:
            ok("刷新后恢复每日进度（猜测历史 + 同一题）")
        else:
            bad("刷新恢复失败",
                f"before={guesses_before} after={guesses_after} same={same_secret}")

        # G5) 赢一局 + 刷新保留结果 + 分享文案
        for ch in secret:
            page.click(f'[data-digit="{ch}"]')
        page.click("#key-submit")
        page.wait_for_timeout(250)
        if page.evaluate("D.phase") == "win":
            ok("输入答案后进入胜利结算")
        else:
            bad("未能进入胜利结算", page.evaluate("D.phase"))
        answer_txt = page.inner_text("#answer").replace(" ", "")
        if answer_txt == secret:
            ok("结算页显示正确答案", answer_txt)
        else:
            bad("结算页答案不对", f"{answer_txt} vs {secret}")

        page.reload()
        page.wait_for_timeout(400)
        if page.evaluate("D.phase") == "win" and page.query_selector("#btn-share"):
            ok("刷新后保留当日获胜结果")
        else:
            bad("刷新后当日结果丢失", page.evaluate("D.phase"))

        share_text = page.evaluate("buildShareText()")
        today = page.evaluate("D.date")
        spoiler_free = share_text.replace(today, "")
        if "数字侦探" in share_text and "/puzzle/digits/" in share_text \
                and secret not in spoiler_free and "猜中" in share_text:
            ok("分享文案含成绩与站点链接、不含答案")
        else:
            bad("分享文案不合规", share_text.replace("\n", " | ")[:120])

        page.click("#btn-share")
        page.wait_for_timeout(300)
        share_msg = page.evaluate("D.shareMsg")
        if share_msg:
            ok("分享按钮有反馈（复制成功 / 手动提示）", share_msg)
        else:
            bad("分享按钮无反馈")

        # 埋点：game_start / game_win / share 都带 game + difficulty
        raw = page.evaluate("window.counters ? counters.export() : '[]'")
        try:
            evs = json.loads(raw)
        except Exception:
            evs = []
        names = {e.get("e") for e in evs}
        digits_events = [e for e in evs if e.get("game") == "digits"]
        for need in ["game_start", "game_win", "share"]:
            if need in names:
                ok(f"埋点事件 {need} 已记录")
            else:
                bad(f"缺埋点事件 {need}")
        if digits_events and all("difficulty" in e for e in digits_events):
            ok("埋点事件均带 game/difficulty", f"{len(digits_events)} 条")
        else:
            bad("埋点事件缺 difficulty")

        # G6) 输一局：练习模式 6 次错误猜测 → 失败结算
        page.goto(game_url + "?mode=practice&difficulty=normal")
        page.wait_for_timeout(300)
        secret2 = page.evaluate("[...D.secret].join('')")
        trial = []
        for start in range(10):
            g = "".join(str((start + i) % 10) for i in range(4))
            if g != secret2 and len(set(g)) == 4:
                trial.append(g)
            if len(trial) == 6:
                break
        if len(trial) < 6:
            bad("无法构造 6 个合法错误猜测")
        else:
            for g in trial:
                for ch in g:
                    page.click(f'[data-digit="{ch}"]')
                page.click("#key-submit")
                page.wait_for_timeout(120)
            if page.evaluate("D.phase") == "lose":
                ok("6 次错误猜测后进入失败结算")
            else:
                bad("未进入失败结算", page.evaluate("D.phase"))
            lose_answer = page.inner_text("#answer").replace(" ", "")
            if lose_answer == secret2:
                ok("失败结算揭晓正确答案", lose_answer)
            else:
                bad("失败结算答案不对", f"{lose_answer} vs {secret2}")

        # 困难模式允许重复数字
        page.goto(game_url + "?mode=practice&difficulty=hard")
        page.wait_for_timeout(300)
        if page.evaluate("__digits.validateGuess([1,1,2,3], 'hard').ok"):
            ok("困难模式允许重复数字")
        else:
            bad("困难模式错误拒绝重复数字")

        browser.close()

    srv.shutdown()


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
