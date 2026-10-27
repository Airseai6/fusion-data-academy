// G7 围堵狐狸逻辑测试。从单文件页面里抽出 FOX CORE 在 VM 里跑，测的是真正上线的那份代码。
// 运行：node --test tests/fox_logic_test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../puzzle/fox-hunt/index.html', import.meta.url), 'utf8');
const start = html.indexOf('/* === FOX CORE START === */');
const end = html.indexOf('/* === FOX CORE END === */');
assert.ok(start >= 0 && end > start, 'FOX CORE 标记缺失');

const context = vm.createContext({ console });
vm.runInContext(html.slice(start, end), context);
const F = vm.runInContext(`({
  LEVELS, levelById, adjOf, foxMoves, legalPlacements, initialState, denDistances,
  disjointPathCount, staticNeed, makeSolver, analyseLevel, foxChoice, hintAt, popcount, bitOf, isBlocked
})`, context);

/* ────────── 独立参考实现：用 Set 存封路点，规则全部自己写，不复用页面函数 ────────── */
function rulesOf(level) {
  const n = level.nodes.length;
  const adj = Array.from({ length: n }, () => []);
  for (const e of level.edges) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); }
  return { n, adj, den: level.den };
}
function refMoves(R, fox, blocked) {
  return R.adj[fox].filter((v) => !blocked.has(v));
}
function refPlacements(R, fox, blocked) {
  const out = [];
  for (let v = 0; v < R.n; v++) {
    if (v === fox || v === R.den || blocked.has(v)) continue;
    out.push(v);
  }
  return out;
}
/** 「k 步之内，玩家能否保证围死狐狸」——纯递归，无记忆化，也不读页面的距离场。 */
function canWin(R, fox, blocked, k) {
  if (k <= 0) return false;
  for (const v of refPlacements(R, fox, blocked)) {
    const nb = new Set(blocked);
    nb.add(v);
    const moves = refMoves(R, fox, nb);
    if (moves.length === 0) return true;          // 这一封就封死了
    if (k === 1) continue;                        // 只剩这一步，狐狸还能走 → 这条线不成立
    let forced = true;
    for (const m of moves) {
      if (m === R.den) { forced = false; break; } // 狐狸直接进洞
      if (!canWin(R, m, nb, k - 1)) { forced = false; break; }
    }
    if (forced) return true;
  }
  return false;
}
function refOptimal(R) {
  for (let k = 1; k <= R.n; k++) if (canWin(R, R.fox, new Set(), k)) return k;
  return null;
}
/** 独立求最小顶点割：枚举子集 + BFS 连通性（Menger 的暴力侧）。 */
function refMinCut(R) {
  const others = [];
  for (let v = 0; v < R.n; v++) if (v !== R.fox && v !== R.den) others.push(v);
  for (let k = 0; k <= others.length; k++) {
    let hit = null;
    const brute = (i, chosen) => {
      if (hit !== null) return;
      if (chosen.length === k) {
        const dead = new Set(chosen);
        const seen = new Set([R.fox]);
        const q = [R.fox];
        for (let x = 0; x < q.length; x++) {
          for (const v of R.adj[q[x]]) {
            if (dead.has(v) || seen.has(v)) continue;
            seen.add(v);
            q.push(v);
          }
        }
        if (!seen.has(R.den)) hit = chosen.slice();
        return;
      }
      for (let j = i; j < others.length; j++) { chosen.push(others[j]); brute(j + 1, chosen); chosen.pop(); }
    };
    brute(0, []);
    if (hit) return hit.length;
  }
  return others.length;
}

const levels = F.LEVELS;
const R = levels.map((l) => { const r = rulesOf(l); r.fox = l.fox; return r; });

/* ══════════════════════ 测试 ══════════════════════ */

test('CORE 导出齐全，三关图型各不相同', () => {
  for (const fn of ['adjOf', 'foxMoves', 'legalPlacements', 'denDistances', 'disjointPathCount', 'makeSolver', 'analyseLevel', 'foxChoice', 'hintAt']) {
    assert.equal(typeof F[fn], 'function', `${fn} 缺失`);
  }
  assert.equal(levels.length, 3);
  assert.equal(levels.map((l) => l.id).join(','), 'ring,tree,grid');
  assert.equal(levels.map((l) => l.type).join(','), 'cycle,tree,grid');
});

test('关卡数据自洽：编号连续、边合法、图连通、坐标在画布内且互不重叠', () => {
  for (const level of levels) {
    const n = level.nodes.length;
    assert.equal(JSON.stringify(Array.from(level.nodes, (x) => x.id)), JSON.stringify(Array.from({ length: n }, (_, i) => i)), `${level.id} 编号不连续`);
    const seen = new Set();
    for (const [a, b] of level.edges) {
      assert.ok(a >= 0 && a < n && b >= 0 && b < n, `${level.id} 边越界`);
      assert.notEqual(a, b, `${level.id} 出现自环`);
      const key = Math.min(a, b) + '-' + Math.max(a, b);
      assert.ok(!seen.has(key), `${level.id} 出现重复边 ${key}`);
      seen.add(key);
    }
    // 连通性（从洞口出发应能到每个点）
    const adj = F.adjOf(level);
    const seenNode = new Set([level.den]);
    const q = [level.den];
    for (let i = 0; i < q.length; i++) for (const v of adj[q[i]]) if (!seenNode.has(v)) { seenNode.add(v); q.push(v); }
    assert.equal(seenNode.size, n, `${level.id} 图不连通`);
    // 坐标：在 viewBox(360×300) 内，两两间距 ≥ 44（手机上两个触控目标不重叠）
    for (const nd of level.nodes) {
      assert.ok(nd.x >= 20 && nd.x <= 340 && nd.y >= 20 && nd.y <= 280, `${level.id} 节点 ${nd.id} 出界`);
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(level.nodes[i].x - level.nodes[j].x, level.nodes[i].y - level.nodes[j].y);
        assert.ok(d >= 44, `${level.id} 节点 ${i}/${j} 太近（${d.toFixed(1)}）`);
      }
    }
    assert.notEqual(level.den, level.fox, `${level.id} 狐狸不能在洞口`);
    assert.ok(F.denDistances(level)[level.fox] >= 2, `${level.id} 狐狸起点贴着洞口，玩家必输`);
  }
});

test('三关最短围堵步数：环 3 / 树 4 / 网格 6，且都可达', () => {
  const optimal = Array.from(levels, (l) => F.analyseLevel(l).optimal);
  assert.equal(optimal.join(','), '3,4,6');
  for (const level of levels) {
    const a = F.analyseLevel(level);
    assert.ok(a.reachable, `${level.id} 玩家不可能赢`);
    assert.ok(a.states.memo > 0, `${level.id} 搜索没跑`);
  }
});

test('独立暴力搜索（无记忆化、Set 表示）复核三关最优步数', () => {
  for (let i = 0; i < levels.length; i++) {
    const mine = refOptimal(R[i]);
    const page = F.analyseLevel(levels[i]).optimal;
    assert.equal(page, mine, `${levels[i].id} 页面 BFS/AND-OR 与独立搜索不一致（页面 ${page} / 独立 ${mine}）`);
  }
});

test('最优步数是紧的：少一步时狐狸一定能逃（独立搜索 say no）', () => {
  for (let i = 0; i < levels.length; i++) {
    const k = refOptimal(R[i]);
    assert.ok(k >= 1);
    assert.equal(canWin(R[i], R[i].fox, new Set(), k - 1), false, `${levels[i].id} 用 ${k - 1} 步居然也能赢，说明页面答案不是最少的`);
    assert.equal(canWin(R[i], R[i].fox, new Set(), k), true, `${levels[i].id} ${k} 步应该赢`);
  }
});

test('Menger 定理：页面最大流 == 独立枚举的最小顶点割，且是最优步数的下界', () => {
  for (let i = 0; i < levels.length; i++) {
    const page = F.analyseLevel(levels[i]).disjoint;
    const cut = refMinCut(R[i]);
    assert.equal(page, cut, `${levels[i].id} 不相交路径数与最小割不相等`);
    assert.ok(page >= 1, `${levels[i].id} 至少要有 1 条路`);
    assert.ok(F.analyseLevel(levels[i]).optimal >= page, `${levels[i].id} 最优步数不该小于割的大小`);
  }
});

test('合法封路点：绝不包含狐狸脚下、洞口、已封点', () => {
  for (const level of levels) {
    const n = level.nodes.length;
    for (let fox = 0; fox < n; fox++) {
      if (fox === level.den) continue;                 // 狐狸不可能在洞口
      for (let mask = 0; mask < (1 << n); mask++) {
        if (F.isBlocked(mask, fox)) continue;
        const list = F.legalPlacements(level, fox, mask);
        for (const v of list) {
          assert.notEqual(v, fox, '封到了狐狸脚下');
          assert.notEqual(v, level.den, '封到了洞口');
          assert.equal(F.isBlocked(mask, v), false, '封到了已封点');
        }
        assert.equal(list.length, n - 2 - F.popcount(mask & ~(F.bitOf(fox) | F.bitOf(level.den))), '可封点数量不对');
      }
    }
  }
});

test('狐狸只能走未封的相邻边；无路可走时返回 null', () => {
  for (const level of levels) {
    const n = level.nodes.length;
    for (let fox = 0; fox < n; fox++) {
      if (fox === level.den) continue;
      for (let mask = 0; mask < (1 << n); mask++) {
        if (F.isBlocked(mask, fox)) continue;
        const moves = F.foxMoves(level, fox, mask);
        const adj = F.adjOf(level)[fox];
        assert.ok(moves.every((v) => adj.indexOf(v) >= 0), '狐狸走了一条不存在的边');
        assert.ok(moves.every((v) => !F.isBlocked(mask, v)), '狐狸走进了已封点');
        // 把邻居全封掉 → 无路可走
        let all = 0;
        for (const v of adj) all |= F.bitOf(v);
        const choice = F.foxChoice(level, fox, all);
        assert.equal(choice, null, '邻居全封时狐狸不该还能走');
        assert.equal(F.foxMoves(level, fox, all).length, 0, '邻点全封后狐狸还有路');
      }
    }
  }
});

test('狐狸永远选「拖得最久」的一步（页面 choice 的代价等于所有走法里的最大代价）', () => {
  for (const level of levels) {
    const solver = F.makeSolver(level);
    const n = level.nodes.length;
    for (let fox = 0; fox < n; fox++) {
      if (fox === level.den) continue;
      for (let mask = 0; mask < (1 << n); mask++) {
        if (F.isBlocked(mask, fox)) continue;
        const moves = F.foxMoves(level, fox, mask);
        const choice = F.foxChoice(level, fox, mask);
        if (!moves.length) { assert.equal(choice, null); continue; }
        assert.ok(moves.indexOf(choice) >= 0, '狐狸没走合法的一步');
        const costOf = (m) => (m === level.den ? Infinity : solver.playerTurn(m, mask));
        const bestCost = Math.max.apply(null, moves.map(costOf));
        assert.equal(costOf(choice), bestCost, '狐狸没有挑最难缠的方向');
        // 洞口就在旁边时必须进洞
        if (moves.indexOf(level.den) >= 0) assert.equal(choice, level.den, '洞口可达时狐狸应该直接跑进去');
      }
    }
  }
});

test('提示：每一步都在最优策略上，跟着提示走正好用掉最优步数', () => {
  for (const level of levels) {
    const a = F.analyseLevel(level);
    let fox = level.fox;
    let mask = 0;
    let used = 0;
    for (let guard = 0; guard < 32; guard++) {
      const h = F.hintAt(level, fox, mask);
      assert.ok(h, `${level.id} 在 fox=${fox} mask=${mask} 给不出提示`);
      assert.equal(h.remaining, a.optimal - used, '提示给出的剩余步数没有逐回合递减');
      assert.ok(F.legalPlacements(level, fox, mask).indexOf(h.vertex) >= 0, '提示给了一个非法封路点');
      for (const v of h.picks) {
        assert.equal(1 + F.makeSolver(level).foxTurn(fox, mask | F.bitOf(v)), h.remaining, '提示的候选步法不是最优');
      }
      mask |= F.bitOf(h.vertex);
      used += 1;
      const mv = F.foxChoice(level, fox, mask);
      if (mv === null) break;                          // 围住了
      assert.notEqual(mv, level.den, `${level.id} 跟着最优提示竟然被狐狸跑了`);
      fox = mv;
    }
    assert.equal(used, a.optimal, `${level.id} 提示链长度应等于最优步数`);
  }
});

test('单调性：多封一个点只会让玩家更省步数（f(fox,B) ≥ f(fox,B∪{v})）', () => {
  for (const level of levels) {
    const solver = F.makeSolver(level);
    const n = level.nodes.length;
    for (let fox = 0; fox < n; fox++) {
      if (fox === level.den) continue;
      for (let mask = 0; mask < (1 << n); mask++) {
        if (F.isBlocked(mask, fox)) continue;
        if (F.isBlocked(mask, level.den)) continue;      // 洞口封不掉，这种状态在真实对局里不会出现
        const base = solver.playerTurn(fox, mask);
        for (const v of F.legalPlacements(level, fox, mask)) {
          const more = solver.playerTurn(fox, mask | F.bitOf(v));
          assert.ok(base >= more, `多封一个点反而更费步数：${level.id} fox=${fox} mask=${mask} v=${v}`);
        }
      }
    }
  }
});

test('反事实：狐狸原地不动时只要 deg 步（洞口贴脸则无解）', () => {
  for (const level of levels) {
    const a = F.analyseLevel(level);
    assert.equal(F.staticNeed(level), F.adjOf(level)[level.fox].length);
    assert.ok(a.staticNeed <= a.optimal, '会还手的狐狸不可能比不动的更省步数');
  }
  // 合成一关：洞口就是狐狸的邻点 → 站着不动也封不住
  const bad = { id: 'tmp-adj', den: 1, fox: 0, nodes: [{ id: 0, x: 0, y: 0 }, { id: 1, x: 0, y: 0 }], edges: [[0, 1]] };
  assert.equal(F.staticNeed(bad), Infinity);
});

test('随机小图交叉验证：页面 AND/OR 搜索与独立暴力搜索结论一致（含狐狸必胜的图）', () => {
  let seed = 20261027;
  const rnd = (m) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % m; };
  let checked = 0;
  let escaped = 0;
  for (let iter = 0; iter < 40; iter++) {
    const n = 6 + rnd(3);
    const edges = [];
    const seen = new Set();
    for (let v = 1; v < n; v++) {
      const p = rnd(v);
      edges.push([p, v]);
      seen.add(p + '-' + v);
    }
    const extra = rnd(3);
    for (let i = 0; i < extra; i++) {
      const a = rnd(n); const b = rnd(n);
      if (a === b) continue;
      const key = Math.min(a, b) + '-' + Math.max(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([Math.min(a, b), Math.max(a, b)]);
    }
    const level = {
      id: 'rnd' + iter,
      den: 0,
      fox: 1 + rnd(n - 1),
      nodes: Array.from({ length: n }, (_, i) => ({ id: i, x: 0, y: 0 })),
      edges,
    };
    const page = F.analyseLevel(level).optimal;
    const R2 = rulesOf(level);
    R2.fox = level.fox;
    const mine = refOptimal(R2);
    assert.equal(page, mine, `随机图 ${iter} 结论不一致（页面 ${page} / 独立 ${mine}）edges=${JSON.stringify(edges)} fox=${level.fox}`);
    if (page === null) escaped += 1;
    checked += 1;
  }
  assert.equal(checked, 40);
  assert.ok(escaped > 0, '随机图里应该有狐狸必胜的局面，否则样本没覆盖到');
});
