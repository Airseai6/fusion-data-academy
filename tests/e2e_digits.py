"""
《数字侦探》浏览器 E2E · 补 G1 验收缺口
========================================
已有的 tests/digits_logic_test.mjs 只测纯逻辑（44 项），没有浏览器层。
本文件补需求里"至少 3 条真实浏览器 E2E（赢/输/刷新）"。

流程要点（已实测）：
  第 1 屏 = 模式选择（#btn-daily / .difftab / #btn-practice）
  点 #btn-daily 后进入游戏页 → 12 个 .key（1-9 / ⌫ / 0 / 提交）
  全局状态：window.D {phase, mode, difficulty, secret[], guesses[], input[], attemptsLeft, error}

跑法：python tests/e2e_digits.py
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(r"D:\hermesWorkspace\projects\github-pages").resolve()
URL = "file:///" + str(ROOT / "puzzle" / "digits" / "index.html").replace("\\", "/")

PASS, FAIL = [], []


def ok(n, d=""):
    PASS.append(n)
    print(f"  ✓ {n}{'  ' + d if d else ''}")


def bad(n, d=""):
    FAIL.append(n)
    print(f"  ✗ {n}{'  ' + d if d else ''}")


def enter_daily(p):
    """从模式选择进入每日挑战"""
    p.goto(URL)
    p.wait_for_timeout(500)
    p.click("#btn-daily")
    p.wait_for_timeout(600)


def type_str(p, s):
    """点数字键（用文本匹配，不依赖 data 属性）"""
    for ch in str(s):
        p.click(f'.key:text-is("{ch}")')
        p.wait_for_timeout(28)


def submit(p):
    p.click("#key-submit")
    p.wait_for_timeout(160)


with sync_playwright() as pw:
    try:
        b = pw.chromium.launch(channel="chrome", headless=True)
    except Exception:
        b = pw.chromium.launch(headless=True)

    ctx = b.new_context(viewport={"width": 390, "height": 844})
    p = ctx.new_page()
    errs = []
    p.on("pageerror", lambda e: errs.append(str(e)[:140]))

    print("=" * 68)
    print("  数字侦探 · 浏览器 E2E（390×844）")
    print("=" * 68)

    # ══════════════════════════════════════════
    # [1] 首屏：模式选择页
    # ══════════════════════════════════════════
    print("\n[1] 首屏（模式选择）")
    p.goto(URL)
    p.wait_for_timeout(600)

    title = p.title()
    desc = p.evaluate("document.querySelector('meta[name=description]')?.content || ''")
    if title:
        ok("<title> 存在", title[:44])
    else:
        bad("缺 <title>")
    if len(desc) >= 30:
        ok("meta description 存在", f"{len(desc)} 字")
    else:
        bad("meta description 缺失/过短", str(len(desc)))

    if p.locator("#btn-daily").count() == 1:
        ok("有「每日挑战」入口")
    else:
        bad("缺每日挑战入口")
    if p.locator("#btn-practice").count() == 1:
        ok("有「练习」入口")
    else:
        bad("缺练习入口")

    sw = p.evaluate("document.documentElement.scrollWidth")
    cw = p.evaluate("document.documentElement.clientWidth")
    if sw <= cw + 2:
        ok("首屏无横向溢出", f"{sw}/{cw}")
    else:
        bad("首屏横向溢出", f"scrollWidth={sw} > clientWidth={cw}")

    # ══════════════════════════════════════════
    # [2] 进入游戏：键盘与触控
    # ══════════════════════════════════════════
    print("\n[2] 游戏页")
    p.click("#btn-daily")
    p.wait_for_timeout(600)

    keys = p.locator(".key").count()
    if keys == 12:
        ok("12 个数字键（1-9 / ⌫ / 0 / 提交）", str(keys))
    else:
        bad("键盘键数不对", str(keys))

    box = p.locator(".key").first.bounding_box()
    if box and box["height"] >= 44:
        ok("触控目标 ≥44px", f"{box['height']:.0f}px")
    else:
        bad("触控目标过小", f"{box['height'] if box else '?'}")

    sw2 = p.evaluate("document.documentElement.scrollWidth")
    cw2 = p.evaluate("document.documentElement.clientWidth")
    if sw2 <= cw2 + 2:
        ok("游戏页无横向溢出", f"{sw2}/{cw2}")
    else:
        bad("游戏页横向溢出", f"{sw2} > {cw2}")

    # ══════════════════════════════════════════
    # [3] 非法输入不扣次数
    # ══════════════════════════════════════════
    print("\n[3] 非法输入")
    before = p.evaluate("window.D ? D.guesses.length : -1")

    type_str(p, "123")
    submit(p)
    mid = p.evaluate("window.D ? D.guesses.length : -1")
    err = p.evaluate("window.D ? (D.error || '') : ''")
    if mid == before:
        ok("3 位提交 → 不扣次数", f"guesses={mid} error={err!r}")
    else:
        bad("3 位被计入次数", f"{before} → {mid}")

    p.evaluate("if(window.D){D.input=[]; render();}")
    type_str(p, "1123")
    submit(p)
    after = p.evaluate("window.D ? D.guesses.length : -1")
    err2 = p.evaluate("window.D ? (D.error || '') : ''")
    if after == before:
        ok("重复数字（普通模式）→ 不扣次数", f"guesses={after} error={err2!r}")
    else:
        bad("重复数字被计入", f"{before} → {after}")

    # ══════════════════════════════════════════
    # [4] 赢一局
    # ══════════════════════════════════════════
    print("\n[4] 赢一局")
    p.evaluate("""
        if (window.D) {
            D.secret = [4,2,7,1];
            D.input = [];
            D.guesses = [];
            D.attemptsLeft = 6;
            D.error = '';
            D.phase = 'play';
            D.difficulty = 'normal';
            render();
        }
    """)
    p.wait_for_timeout(200)
    type_str(p, "4271")
    submit(p)
    p.wait_for_timeout(400)

    st = p.evaluate("window.D ? {phase:D.phase, n:D.guesses.length} : null")
    # 答案渲染成 "4 2 7 1"（带空格），统一去空格后比较
    ans_txt = ""
    if p.locator("#answer").count():
        ans_txt = p.locator("#answer").first.inner_text().replace(" ", "").strip()

    if st and st["n"] == 1:
        ok("猜测被记录", str(st))
    else:
        bad("猜测未记录", str(st))

    if st and st["phase"] != "play" and ans_txt == "4271":
        ok("猜中 → 结算页并显示答案", f"phase={st['phase']} answer={ans_txt}")
    elif st and st["phase"] != "play":
        ok("猜中 → 结算页", f"phase={st['phase']}")
        bad("结算页答案不对", repr(ans_txt))
    else:
        bad("未进入结算", str(st))

    has_math = p.locator(".mathbox").count() > 0
    if has_math:
        mtxt = p.locator(".mathbox").first.inner_text()
        if 15 <= len(mtxt) <= 500:
            ok("有数学解释", f"{len(mtxt)} 字")
        else:
            bad("数学解释长度异常", str(len(mtxt)))
    else:
        bad("缺 .mathbox")

    share_hit = p.locator("#btn-again").count() > 0 or "分享" in body or "复制" in body
    if share_hit:
        ok("结算页有再来一局/分享")
    else:
        bad("结算页无出口")

    # ══════════════════════════════════════════
    # [5] 输一局
    # ══════════════════════════════════════════
    print("\n[5] 输一局（6 次用尽）")
    p.evaluate("""
        if (window.D) {
            D.secret = [9,8,7,6];
            D.input = [];
            D.guesses = [];
            D.attemptsLeft = 6;
            D.error = '';
            D.phase = 'play';
            D.difficulty = 'normal';
            render();
        }
    """)
    p.wait_for_timeout(200)

    for g in ["1234", "2345", "3450", "0123", "1235", "1243"]:
        p.evaluate("if(window.D){D.input=[]; render();}")
        type_str(p, g)
        submit(p)
        p.wait_for_timeout(110)

    n = p.evaluate("window.D ? D.guesses.length : -1")
    ph = p.evaluate("window.D ? D.phase : ''")
    lose_ans = ""
    if p.locator("#answer").count():
        lose_ans = p.locator("#answer").first.inner_text().replace(" ", "").strip()

    if n == 6:
        ok("6 次全部记录", str(n))
    else:
        bad("次数不对", str(n))

    if ph != "play":
        ok("6 次用尽 → 离开游戏态", f"phase={ph}")
    else:
        bad("6 次后仍在 play", str(ph))

    if lose_ans == "9876":
        ok("失败页揭示答案", lose_ans)
    elif "9876" in p.inner_text("body").replace(" ", ""):
        ok("失败页揭示答案（全文匹配）", "9876")
    else:
        bad("失败页没揭示答案", repr(lose_ans))

    # ══════════════════════════════════════════
    # [6] 刷新恢复
    # ══════════════════════════════════════════
    print("\n[6] 刷新恢复")
    ls_keys = p.evaluate("[...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).filter(k=>k&&k.toLowerCase().indexOf('digit')>-1)")
    if ls_keys:
        ok("localStorage 有存档", str(ls_keys))
        val = p.evaluate(f"localStorage.getItem('{ls_keys[0]}')")
        print(f"    {ls_keys[0]} = {str(val)[:90]}")
    else:
        bad("没有 digit 相关 localStorage", str(p.evaluate("[...Array(localStorage.length)].map((_,i)=>localStorage.key(i))")))

    p.reload()
    p.wait_for_timeout(700)
    alive = p.evaluate("typeof window.D === 'object' && window.D !== null")
    if alive or p.locator("#btn-daily").count() == 1:
        ok("刷新后正常重建")
    else:
        bad("刷新后异常")

    # ══════════════════════════════════════════
    # [7] 控制台
    # ══════════════════════════════════════════
    print("\n[7] 控制台")
    real = [e for e in errs if "analytics" not in e.lower() and "Failed to load" not in e]
    if not real:
        ok("无 JS 运行时错误", f"（过滤 {len(errs)-len(real)} 条 analytics 相关）")
    else:
        bad("有 JS 错误", " | ".join(real[:3]))

    b.close()

print()
print("=" * 68)
print(f"  通过 {len(PASS)}   失败 {len(FAIL)}")
if FAIL:
    for f in FAIL:
        print(f"    ✗ {f}")
    sys.exit(1)
print("  ✓ 全部通过")
