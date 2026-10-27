/**
 * Bulls & Cows 反馈算法验证
 * ============================
 * 用确定样例断言 A/B 计算正确（含重复数字、位置互换、全错等边界）
 */
const fs = require('fs');
const html = fs.readFileSync('D:/hermesWorkspace/projects/github-pages/games/digits/index.html', 'utf8');

// 提取 feedback 函数
const m = html.match(/function feedback\(secret, guess\) \{[\s\S]*?\n\}/);
if (!m) { console.log('✗ 找不到 feedback'); process.exit(1); }

// 语法检查整段 script
const sm = html.match(/<script>([\s\S]*?)<\/script>/g);
const last = sm[sm.length - 1].replace(/<\/?script>/g, '');
const vm = require('vm');
try { new vm.Script(last); console.log('✓ 整段 JS 语法通过'); }
catch (e) { console.log('✗ 语法错误:', e.message); process.exit(1); }

// eval 出 feedback
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[0] + '\nthis.feedback = feedback;', ctx);
const feedback = ctx.feedback;

console.log('\n' + '='.repeat(62));
console.log('  A/B 算法断言');
console.log('='.repeat(62));

const cases = [
  // [secret, guess, 期望A, 期望B, 说明]
  ['1234', '1234', 4, 0, '完全命中'],
  ['1234', '4321', 0, 4, '全对但位置全错'],
  ['1234', '5678', 0, 0, '完全不沾边'],
  ['1234', '1243', 2, 2, '两位置对+两位置错'],
  ['1234', '1324', 2, 2, '同上（互换 2/3）'],
  ['1234', '1235', 3, 0, '三个对，一个错'],
  ['1234', '1256', 2, 0, '两个对，其余不沾'],
  ['1234', '5671', 0, 1, '只有一个 1 在错位'],
  ['1234', '4123', 0, 4, '循环移位'],
  ['1234', '1111', 1, 0, '重复猜测数（1 只算一次）'],
  ['1122', '1212', 2, 2, '谜底有重复：位置0/3 命中，2 和 1 各错位一次'],
  ['1122', '1111', 2, 0, '谜底两个1，猜四个1 → 只算2个A'],
  ['1122', '1122', 4, 0, '重复数字完全命中'],
  ['1123', '1124', 3, 0, '重复谜底三对一错'],
  ['0000', '0000', 4, 0, '全零'],
  ['0000', '0001', 3, 0, '全零猜错一位'],
  ['0123', '3210', 0, 4, '反转'],
  ['9876', '9876', 4, 0, '大数字'],
];

let pass = 0, fail = 0;
for (const [secret, guess, ea, eb, desc] of cases) {
  const r = feedback(secret, guess);
  const ok = r.A === ea && r.B === eb;
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? '✓' : '✗'} ${secret} vs ${guess} → ${r.A}A${r.B}B` +
              (ok ? '' : `  （期望 ${ea}A${eb}B）`) + `  ${desc}`);
}

console.log('\n' + '='.repeat(62));
console.log(`  通过 ${pass} / ${pass + fail}`);
console.log('='.repeat(62));
if (fail > 0) process.exit(1);

// ── 额外：A+B 不应超过 4 ──
console.log('\n  额外检查：A+B ≤ 4（随机 10000 组）');
let bad = 0;
for (let i = 0; i < 10000; i++) {
  const rnd = () => Array.from({length:4}, () => Math.floor(Math.random()*10)).join('');
  const s = rnd(), g = rnd();
  const r = feedback(s, g);
  if (r.A + r.B > 4 || r.A < 0 || r.B < 0) { bad++; if (bad < 3) console.log('   异常:', s, g, r); }
}
console.log(`  异常 ${bad} 组 ${bad === 0 ? '✓' : '✗'}`);
if (bad > 0) process.exit(1);
