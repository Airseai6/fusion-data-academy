/**
 * 极简埋点 · 无后端也能用
 * ============================
 * 设计原则：
 *  - 默认只存 localStorage，不发任何请求（符合"no tracking"的对外承诺）
 *  - 配置 ENDPOINT 后自动 sendBeacon 上报
 *  - 全部事件可导出（window.counters.export()）
 *
 * 用法：
 *   <script src="/analytics.js"></script>
 *   counters.track('page_view', { game: 'puzzle' });
 */
(function () {
  'use strict';

  // ★ 埋点端点（P2：待用户提供 Umami / 自建 Worker / 百度统计 等收集端点）
  //   接线方式（二选一，默认留空 = 只存 localStorage、不发任何请求）：
  //   ① 在 analytics.js 之前插入一行：<script>window.FD_ANALYTICS_ENDPOINT='https://...';</script>
  //   ② 或运行时调用 window.counters.setEndpoint('https://...')
  let ENDPOINT = (typeof window !== 'undefined' && window.FD_ANALYTICS_ENDPOINT) || '';

  const KEY = 'fd.events.v1';
  const MAX = 500;                     // 本地最多留 500 条，防爆
  const SS_UTM = 'fd.utm';

  /* ── UTM 落地 ── */
  function readUtm() {
    try {
      const q = new URLSearchParams(location.search);
      const utm = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(k => {
        const v = q.get(k);
        if (v) utm[k.replace('utm_', '')] = v;
      });
      if (Object.keys(utm).length) {
        sessionStorage.setItem(SS_UTM, JSON.stringify(utm));
      }
      const cached = sessionStorage.getItem(SS_UTM);
      return cached ? JSON.parse(cached) : {};
    } catch (e) { return {}; }
  }
  const UTM = readUtm();

  /* ── 会话 id（同标签页不变）── */
  function sid() {
    try {
      let s = sessionStorage.getItem('fd.sid');
      if (!s) {
        s = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        sessionStorage.setItem('fd.sid', s);
      }
      return s;
    } catch (e) { return 'anon'; }
  }
  const SID = sid();

  /* ── 存储 ── */
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function save(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-MAX))); }
    catch (e) { /* 配额满了就算了 */ }
  }

  /* ── 上报 ── */
  function send(payload) {
    if (!ENDPOINT) return;
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(ENDPOINT, { method: 'POST', body, keepalive: true });
      }
    } catch (e) { /* 静默失败，不能影响游戏 */ }
  }

  /* ── 主接口 ── */
  const counters = {
    /** 记录一个事件 */
    track(name, props) {
      const ev = Object.assign({
        e: name,
        t: Date.now(),
        sid: SID,
        path: location.pathname,
        ref: document.referrer || '',
      }, UTM, props || {});

      const arr = load();
      arr.push(ev);
      save(arr);
      send(ev);

      // 调试用：控制台可见
      if (window.__FD_DEBUG__) console.log('[track]', ev);
      return ev;
    },

    /** 导出全部事件（JSON 字符串，可直接复制） */
    export() {
      return JSON.stringify(load(), null, 2);
    },

    /** 下载为文件 */
    download() {
      const blob = new Blob([this.export()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'fd-events-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    /** 简单统计（按事件名计数） */
    summary() {
      const arr = load();
      const m = {};
      arr.forEach(x => { m[x.e] = (m[x.e] || 0) + 1; });
      return m;
    },

    /** 清空 */
    clear() {
      try { localStorage.removeItem(KEY); } catch (e) {}
    },

    /** 配置端点（运行时改；返回当前端点） */
    setEndpoint(url) {
      ENDPOINT = String(url || '');
      if (ENDPOINT) console.info('[analytics] endpoint =', ENDPOINT);
      return ENDPOINT;
    },

    /** 读取当前端点（测试/调试用） */
    endpoint() {
      return ENDPOINT;
    },
  };

  window.counters = counters;

  /* ── 自动 page_view ── */
  counters.track('page_view');

  /* ── 自动记录外链点击（所有 <a> 非本站跳转）── */
  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const txt = (a.textContent || '').trim().slice(0, 40);
    if (/^(https?:)?\/\//.test(href) && href.indexOf(location.host) === -1) {
      counters.track('link_out', { target: href, text: txt });
    } else if (href && href.indexOf('.html') > -1) {
      counters.track('link_internal', { target: href, text: txt });
    }
  }, true);
})();
