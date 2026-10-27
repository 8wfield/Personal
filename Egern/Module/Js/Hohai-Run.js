// HOHAI 每日签到 + 抽奖 · Egern 定时脚本
// 账号密码由模块参数注入，本文件不含任何凭据
const ORIGIN = 'https://api.hohai.eu.org';
const RT = 'hohai.refresh';

function pick(env, names, dft) {
  for (const n of names) {
    const v = env[n];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s === '' || s.indexOf('{{') === 0) continue;
    return s;
  }
  return dft;
}

function num(v, dft) {
  const n = Number(v);
  return isFinite(n) ? n : dft;
}

function amt(v) {
  const n = num(v, 0);
  const s = Math.abs(n).toFixed(2);
  return n < 0 ? '-' + s : s;
}

const dat = (r) => ((r && r.body && r.body.data) || {});

const CODES = {
  AUTH_SESSION_LIMIT: '登录会话数已达上限，去网页端「个人设置 → 会话管理」点一下「撤销其他会话」',
  AUTH_SESSION_ISSUANCE_LIMIT: '24 小时内登录太频繁已被限流，明天再试',
  AUTH_SESSION_REVOKED: '原登录会话已被撤销，自动改用密码登录即可',
  AUTH_ORIGIN_FORBIDDEN: '请求来源被拒，请更新模块到最新版',
  AUTH_USER_DELETED: '账号不存在',
  USER_BANNED: '账号已被封禁',
};

function why(r, dft) {
  const b = (r && r.body) || {};
  const code = String(b.code || '');
  if (CODES[code]) return CODES[code];
  return String(b.message || dft || '服务端未返回原因') + (code ? '（' + code + '）' : '');
}

async function call(ctx, method, path, o) {
  const opt = o || {};
  const headers = Object.assign({ Accept: 'application/json' }, opt.headers || {});
  if (opt.token) headers.Authorization = 'Bearer ' + opt.token;
  const arg = { headers };
  if (opt.payload) {
    headers['Content-Type'] = 'application/json';
    arg.body = JSON.stringify(opt.payload);
  }
  const url = ORIGIN + path;
  const res = method === 'GET' ? await ctx.http.get(url, arg) : await ctx.http.post(url, arg);
  let body = null;
  try { body = await res.json(); } catch (e) {}
  return { status: res.status, body: body || {}, res };
}

function keep(ctx, r) {
  try {
    for (const c of r.res.headers.getAll('set-cookie') || []) {
      const m = /(?:^|\s)new_api_refresh=([^;]+)/.exec(c);
      if (m) { ctx.storage.set(RT, m[1]); return true; }
    }
  } catch (e) {}
  return false;
}

async function auth(ctx, user, pass) {
  const rt = ctx.storage.get(RT);
  if (rt) {
    const r = await call(ctx, 'POST', '/api/user/auth/refresh', {
      headers: { Cookie: 'new_api_refresh=' + rt, Origin: ORIGIN },
    });
    const t = dat(r).access_token;
    if (t) { keep(ctx, r); return t; }
    try { ctx.storage.delete(RT); } catch (e) {}
  }
  const r = await call(ctx, 'POST', '/api/user/login', {
    headers: { Origin: ORIGIN },
    payload: { username: user, password: pass },
  });
  const t = dat(r).access_token;
  if (!t) throw new Error(why(r, '账号或密码不对'));
  if (!keep(ctx, r)) {
    await call(ctx, 'POST', '/api/user/auth/logout', { token: t, headers: { Origin: ORIGIN } }).catch(() => {});
  }
  return t;
}

async function money(ctx) {
  try {
    const s = dat(await call(ctx, 'GET', '/api/status'));
    const per = num(s.quota_per_unit, 500000) || 500000;
    const t = String(s.quota_display_type || 'USD').toUpperCase();
    if (t === 'CNY') return { sym: '¥', rate: num(s.usd_exchange_rate, 1), per };
    if (t === 'CUSTOM') return { sym: String(s.custom_currency_symbol || '¤'), rate: num(s.custom_currency_exchange_rate, 1), per };
    if (t === 'TOKENS') return { sym: '', rate: 1, per };
    return { sym: '$', rate: 1, per };
  } catch (e) {
    return { sym: '¥', rate: 1, per: 500000 };
  }
}

export default async function (ctx) {
  const env = ctx.env || {};
  const user = String(pick(env, ['USERNAME', 'username', 'USER'], '')).trim();
  const pass = String(pick(env, ['PASSWORD', 'password'], ''));
  const say = (title, body) => ctx.notify({ title, body, sound: true });
  if (!user || !pass) return say('⚠️ HOHAI 未配置', '请在模块设置里填账号和密码');

  try {
    const token = await auth(ctx, user, pass);

    let signed = !!((dat(await call(ctx, 'GET', '/api/user/checkin', { token })).stats || {}).checked_in_today);
    if (!signed) {
      const ci = await call(ctx, 'POST', '/api/user/checkin', { token });
      signed = !!ci.body.success || /already/i.test(why(ci, ''));
      if (!signed) return say('⚠️ HOHAI 签到失败', why(ci));
    }

    const lt = dat(await call(ctx, 'GET', '/api/user/lottery', { token }));
    const before = num((lt.stats || {}).total_amount, 0);
    let tickets = Math.floor(num(lt.tickets, 0));
    let draws = 0;
    while (tickets > 0 && draws < 100) {
      const dr = await call(ctx, 'POST', '/api/user/lottery/draw', { token });
      if (!dr.body.success) break;
      draws++;
      tickets--;
    }

    const cur = await money(ctx);
    const after = dat(await call(ctx, 'GET', '/api/user/lottery', { token }));
    const me = dat(await call(ctx, 'GET', '/api/user/self', { token }));
    const gain = Math.max(0, num((after.stats || {}).total_amount, before) - before);
    const bal = num(me.quota, 0) / cur.per * cur.rate;
    const m = (v) => cur.sym + amt(v);

    const lines = [];
    if (draws > 0) lines.push('🎁 抽到 ' + m(gain) + (draws > 1 ? '（' + draws + ' 次）' : ''));
    else lines.push('🎟 今天没有抽奖券');
    lines.push('💰 余额 ' + m(bal));

    say(draws > 0 ? '🎉 HOHAI 签到抽奖' : '🔔 HOHAI 已签到', lines.join('\n'));
  } catch (e) {
    say('⚠️ HOHAI 出错', String((e && e.message) || e));
  }
}