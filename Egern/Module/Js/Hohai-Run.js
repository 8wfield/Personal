// HOHAI 每日签到 + 抽奖 · Egern 定时脚本
// 账号密码来自模块参数，本文件不含任何凭据
const ORIGIN = 'https://api.hohai.eu.org';

function pick(env, names, dft) {
  const norm = (s) => String(s).toLowerCase().replace(/[_\-\s]/g, '');
  const want = names.map(norm);
  for (const k of Object.keys(env || {})) {
    const s = String(env[k] === undefined || env[k] === null ? '' : env[k]).trim();
    if (!s || s.indexOf('{{') >= 0) continue;
    if (want.indexOf(norm(k)) >= 0) return s;
  }
  return dft;
}

function num(v, dft) {
  const n = Number(v);
  return isFinite(n) ? n : dft;
}

function amt(v) {
  const n = num(v, 0);
  const s = n.toFixed(2);
  return n !== 0 && s === '0.00' ? n.toFixed(3) : s;
}

async function api(ctx, method, path, token, payload) {
  const opt = { headers: { Accept: 'application/json' } };
  if (payload) {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(payload);
  }
  if (token) opt.headers.Authorization = 'Bearer ' + token;
  const url = ORIGIN + path;
  const res = method === 'GET' ? await ctx.http.get(url, opt) : await ctx.http.post(url, opt);
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  return { status: res.status, body: body || {} };
}

const dat = (r) => ((r && r.body && r.body.data) || {});
const why = (r, dft) => String(((r && r.body) || {}).message || dft || '服务端未返回原因');

async function money(ctx) {
  try {
    const s = dat(await api(ctx, 'GET', '/api/status'));
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
    const login = await api(ctx, 'POST', '/api/user/login', null, { username: user, password: pass });
    const token = dat(login).access_token;
    if (!token) {
      return say('⚠️ HOHAI 登录失败', why(login, '账号或密码不对'));
    }

    let signed = !!((dat(await api(ctx, 'GET', '/api/user/checkin', token)).stats || {}).checked_in_today);
    if (!signed) {
      const ci = await api(ctx, 'POST', '/api/user/checkin', token);
      signed = !!ci.body.success || /already/i.test(why(ci, ''));
      if (!signed) {
        return say('⚠️ HOHAI 签到失败', why(ci));
      }
    }

    const lt = dat(await api(ctx, 'GET', '/api/user/lottery', token));
    const before = num((lt.stats || {}).total_amount, 0);
    let tickets = Math.floor(num(lt.tickets, 0));
    let draws = 0;
    while (tickets > 0 && draws < 100) {
      const dr = await api(ctx, 'POST', '/api/user/lottery/draw', token);
      if (!dr.body.success) break;
      draws++;
      tickets--;
    }

    const cur = await money(ctx);
    const after = dat(await api(ctx, 'GET', '/api/user/lottery', token));
    const me = dat(await api(ctx, 'GET', '/api/user/self', token));
    const gain = Math.max(0, num((after.stats || {}).total_amount, before) - before);
    const bal = num(me.quota, 0) / cur.per * cur.rate;
    const m = (v) => cur.sym + amt(v);

    const lines = [];
    if (draws > 0) lines.push('🎁 抽到 ' + m(gain) + (draws > 1 ? '（' + draws + ' 次）' : ''));
    else lines.push('🎟 今天没有抽奖券');
    lines.push('💰 余额 ' + m(bal));
    const title = draws > 0 ? '🎉 HOHAI 签到抽奖' : '🔔 HOHAI 已签到';

    say(title, lines.join('\n'));
    await api(ctx, 'POST', '/api/user/logout', token).catch(() => {});
  } catch (e) {
    say('⚠️ HOHAI 出错', String((e && e.message) || e));
  }
}
