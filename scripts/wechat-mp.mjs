// 微信公众号自定义菜单 API 工具。
// 需要环境变量：WECHAT_APPID、WECHAT_APPSECRET（不要写进仓库）。
//
// 用法：
//   node scripts/wechat-mp.mjs token
//   node scripts/wechat-mp.mjs create-menu [menu.json]
//   node scripts/wechat-mp.mjs get-menu
//   node scripts/wechat-mp.mjs delete-menu
//
// 注意：自动回复/关键词回复官方没有简单的“新增一条”API，
// 需要在公众号后台“自动回复”页面粘贴 docs/WECHAT-OFFICIAL-ACCOUNT.md 里的文案。
import fs from 'node:fs';
import path from 'node:path';

const APPID = process.env.WECHAT_APPID;
const APPSECRET = process.env.WECHAT_APPSECRET;
if (!APPID || !APPSECRET) {
  console.error('缺少 WECHAT_APPID / WECHAT_APPSECRET 环境变量');
  process.exit(2);
}

const BASE = 'https://api.weixin.qq.com';
const action = process.argv[2] || 'get-menu';
const menuFile = path.resolve(process.argv[3] || 'wechat/menu.json');

async function getJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (data.errcode) {
    throw new Error(`WeChat API error ${data.errcode}: ${data.errmsg}`);
  }
  return data;
}

async function getAccessToken() {
  const url = `${BASE}/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(APPID)}&secret=${encodeURIComponent(APPSECRET)}`;
  const data = await getJson(url);
  return data.access_token;
}

const token = await getAccessToken();

if (action === 'token') {
  console.log(JSON.stringify({ ok: true, access_token_length: token.length, tip: '不要把 token 打印/提交到任何地方' }, null, 2));
} else if (action === 'create-menu') {
  const menu = JSON.parse(fs.readFileSync(menuFile, 'utf8'));
  const data = await getJson(`${BASE}/cgi-bin/menu/create?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(menu),
  });
  console.log(JSON.stringify({ ok: true, action, file: menuFile, errcode: data.errcode, errmsg: data.errmsg }, null, 2));
} else if (action === 'get-menu') {
  const data = await getJson(`${BASE}/cgi-bin/menu/get?access_token=${encodeURIComponent(token)}`);
  console.log(JSON.stringify({ ok: true, menu: data.menu, conditionalmenu: data.conditionalmenu }, null, 2));
} else if (action === 'delete-menu') {
  const data = await getJson(`${BASE}/cgi-bin/menu/delete?access_token=${encodeURIComponent(token)}`, { method: 'POST' });
  console.log(JSON.stringify({ ok: true, action, errcode: data.errcode, errmsg: data.errmsg }, null, 2));
} else {
  console.error('未知 action：token | create-menu | get-menu | delete-menu');
  process.exit(2);
}
