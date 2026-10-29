#!/usr/bin/env node
/**
 * 防止把微信 AppID 全文提交到公开仓库。
 * 只允许 “前缀 + 省略号”（例如 wx0d21...）或 touristappid 占位符。
 */
import { execFileSync } from 'node:child_process';

let out = '';
try {
  out = execFileSync('git', ['grep', '-n', '-I', '-E', 'wx[0-9a-f]{16}', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
} catch (err) {
  if (err.status === 1) {
    console.log('secret guard: no full WeChat AppID in tracked files — PASS');
    process.exit(0);
  }
  throw err;
}

const lines = out.trim().split('\n').filter(Boolean);
console.error('secret guard: full WeChat AppID found in tracked files:');
for (const line of lines) {
  console.error('  ' + line.replace(/wx[0-9a-f]{16}/i, 'wx****...'));
}
console.error('请改成 “前缀 + 点点点”（如 wx0d21...），真实 AppID 只放本地私有配置。');
process.exit(1);
