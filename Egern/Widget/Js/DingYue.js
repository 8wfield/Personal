export default async function (ctx) {
  const MAX = 5;
  const slots = [];

  for (let i = 1; i <= MAX; i++) {
    const url = (ctx.env[`URL${i}`] || "").trim();
    if (!url) continue;
    slots.push({
      name: (ctx.env[`NAME${i}`] || "").trim() || inferName(url),
      url,
      resetDay: parseInt(ctx.env[`RESET${i}`] || "", 10) || null,
    });
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const refreshTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const bgGradient = {
    type: "linear",
    colors: ["#0F172A", "#1E293B", "#111827", "#0F172A"],
    stops: [0, 0.4, 0.7, 1],
    startPoint: { x: 0.2, y: 0 },
    endPoint: { x: 0.8, y: 1 },
  };

  if (!slots.length) {
    return {
      type: "widget",
      padding: 16,
      gap: 10,
      backgroundGradient: bgGradient,
      refreshAfter: refreshTime,
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            {
              type: "image",
              src: "sf-symbol:chart.pie.fill",
              width: 14,
              height: 14,
              color: "#60A5FA",
            },
            {
              type: "text",
              text: "订阅流量",
              font: { size: "caption1", weight: "semibold" },
              textColor: "#FFFFFF88",
            },
          ],
        },
        { type: "spacer" },
        {
          type: "text",
          text: "请配置 URL1 等环境变量",
          font: { size: "caption1" },
          textColor: "#F87171",
          textAlign: "center",
        },
      ],
    };
  }

  const results = await Promise.all(slots.map(s => fetchInfo(ctx, s)));
  const count = slots.length;

  let mainContent;
  if (count === 1) {
    mainContent = buildSingleCard(results[0]);
  } else if (count === 2) {
    mainContent = buildTwoCards(results);
  } else {
    mainContent = {
      type: "stack",
      direction: "column",
      gap: count <= 3 ? 10 : 8,
      children: results.map(r => buildCompactCard(r, count)),
    };
  }

  return {
    type: "widget",
    padding: count === 1 ? [20, 20, 18, 20] : [14, 14, 12, 14],
    gap: 10,
    backgroundGradient: bgGradient,
    refreshAfter: refreshTime,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 8,
        children: [
          {
            type: "image",
            src: "sf-symbol:chart.pie.fill",
            width: 18,
            height: 18,
            color: "#60A5FA",
          },
          {
            type: "text",
            text: "流量监控",
            font: { size: "subheadline", weight: "semibold" },
            textColor: "#E0F2FE",
          },
          { type: "spacer" },
          {
            type: "text",
            text: timeStr,
            font: { size: "caption2" },
            textColor: "#94A3B8",
          },
        ],
      },
      mainContent,
      { type: "spacer" },
    ],
  };
}

function buildSingleCard(result) {
  const { name, error, used, totalBytes, percent, expire, remainDays } = result;
  const usageColor = getUsageColor(percent, error);

  if (error) {
    return {
      type: "stack",
      direction: "column",
      gap: 12,
      alignItems: "center",
      padding: [20, 0, 20, 0],
      children: [
        {
          type: "image",
          src: "sf-symbol:exclamationmark.triangle.fill",
          width: 32,
          height: 32,
          color: "#F87171",
        },
        {
          type: "text",
          text: name,
          font: { size: "title2", weight: "bold" },
          textColor: "#FCA5A5",
          maxLines: 1,
        },
        {
          type: "text",
          text: "获取失败",
          font: { size: "title3" },
          textColor: "#F87171",
        },
      ],
    };
  }

  const expireText = getExpireText(expire, remainDays);
  const expireColor = getExpireColor(expire, remainDays);

  return {
    type: "stack",
    direction: "column",
    gap: 14,
    alignItems: "center",
    padding: [16, 0, 16, 0],
    children: [
      {
        type: "text",
        text: name,
        font: { size: "title3", weight: "bold" },
        textColor: "#F1F5F9",
        maxLines: 1,
        minScale: 0.85,
      },
      {
        type: "stack",
        direction: "row",
        gap: 10,
        alignItems: "center",
        children: [
          {
            type: "image",
            src: "sf-symbol:wifi",
            width: 24,
            height: 24,
            color: usageColor,
          },
          {
            type: "text",
            text: `${Math.round(percent)}%`,
            font: { size: "largeTitle", weight: "bold" },
            textColor: usageColor,
          },
        ],
      },
      {
        type: "stack",
        direction: "row",
        height: 14,
        borderRadius: 7,
        width: 260,
        children: [
          {
            type: "stack",
            flex: percent / 100,
            backgroundColor: usageColor,
            borderRadius: 7,
          },
          {
            type: "stack",
            flex: 1 - percent / 100,
            backgroundColor: "#334155",
            borderRadius: 7,
          },
        ],
      },
      {
        type: "text",
        text: `${bytesToSize(used)} / ${bytesToSize(totalBytes)}`,
        font: { size: "title2", weight: "medium" },
        textColor: "#CBD5E1",
      },
      expireText ? {
        type: "text",
        text: expireText,
        font: { size: "subheadline" },
        textColor: expireColor,
      } : { type: "spacer", length: 4 },
    ],
  };
}

function buildTwoCards(results) {
  return {
    type: "stack",
    direction: "row",
    gap: 14,
    alignItems: "stretch",
    children: results.map(result => {
      const { name, error, used, totalBytes, percent, expire, remainDays } = result;
      const usageColor = getUsageColor(percent, error);

      let expireText = getExpireText(expire, remainDays);
      let expireColor = getExpireColor(expire, remainDays);

      if (error) {
        return {
          type: "stack",
          direction: "column",
          flex: 1,
          gap: 10,
          padding: [14, 14, 14, 14],
          backgroundColor: "#1E293B",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#334155",
          children: [
            {
              type: "image",
              src: "sf-symbol:exclamationmark.circle.fill",
              width: 24,
              height: 24,
              color: "#F87171",
            },
            {
              type: "text",
              text: name,
              font: { size: "title3", weight: "semibold" },
              textColor: "#FCA5A5",
              textAlign: "center",
            },
            {
              type: "text",
              text: "失败",
              font: { size: "subheadline" },
              textColor: "#F87171",
              textAlign: "center",
            },
          ],
        };
      }

      return {
        type: "stack",
        direction: "column",
        flex: 1,
        gap: 10,
        padding: [14, 14, 14, 14],
        backgroundColor: "#1E293B",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#334155",
        children: [
          {
            type: "text",
            text: name,
            font: { size: "title3", weight: "semibold" },
            textColor: "#F1F5F9",
            maxLines: 1,
            minScale: 0.9,
          },
          {
            type: "stack",
            direction: "row",
            height: 10,
            borderRadius: 5,
            children: [
              { type: "stack", flex: percent / 100, backgroundColor: usageColor, borderRadius: 5 },
              { type: "stack", flex: 1 - percent / 100, backgroundColor: "#334155", borderRadius: 5 },
            ],
          },
          {
            type: "stack",
            direction: "row",
            children: [
              {
                type: "text",
                text: `${bytesToSize(used)} / ${bytesToSize(totalBytes)}`,
                font: { size: "caption1", weight: "medium" },
                textColor: "#CBD5E1",
              },
              { type: "spacer" },
              {
                type: "text",
                text: `${Math.round(percent)}%`,
                font: { size: "caption1", weight: "bold" },
                textColor: usageColor,
              },
            ],
          },
          expireText ? {
            type: "text",
            text: expireText,
            font: { size: "caption2" },
            textColor: expireColor,
            textAlign: "center",
          } : null,
        ].filter(Boolean),
      };
    }),
  };
}

function buildCompactCard(result, count) {
  const { name, error, percent, expire, remainDays } = result;
  const usageColor = getUsageColor(percent, error);

  const expireText = getExpireText(expire, remainDays);
  const expireColor = getExpireColor(expire, remainDays);

  return {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 10,
    padding: [10, 12, 10, 12],
    backgroundColor: "#1E293B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    children: [
      {
        type: "image",
        src: error ? "sf-symbol:exclamationmark.circle" : "sf-symbol:wifi",
        width: 18,
        height: 18,
        color: usageColor,
      },
      {
        type: "text",
        text: name,
        font: { size: count >= 5 ? "caption1" : "subheadline", weight: "medium" },
        textColor: "#E2E8F0",
        flex: 1,
        maxLines: 1,
        minScale: 0.85,
      },
      {
        type: "text",
        text: error ? "失败" : `${Math.round(percent)}%`,
        font: { size: "caption1", weight: "bold" },
        textColor: usageColor,
      },
      expireText ? {
        type: "text",
        text: expireText,
        font: { size: "caption2" },
        textColor: expireColor,
      } : null,
    ].filter(Boolean),
  };
}

function getUsageColor(percent, error) {
  if (error) return "#F87171";
  if (percent >= 90) return "#F87171";
  if (percent >= 75) return "#FB923C";
  if (percent >= 50) return "#60A5FA";
  return "#34D399";
}

function getExpireText(expire, remainDays) {
  if (expire) {
    const days = Math.ceil((expire * 1000 - Date.now()) / 86400000);
    if (days < 0) return "已到期";
    if (days <= 7) return `${days}天后到期`;
    return formatDate(expire);
  }
  if (remainDays !== null) return `${remainDays}天后重置`;
  return "";
}

function getExpireColor(expire, remainDays) {
  if (expire) {
    const days = Math.ceil((expire * 1000 - Date.now()) / 86400000);
    if (days < 0) return "#F87171";
    if (days <= 5) return "#F97316";
    if (days <= 10) return "#FBBF24";
    return "#94A3B8";
  }
  if (remainDays !== null && remainDays <= 5) return "#FBBF24";
  return "#94A3B8";
}

function inferName(url) {
  const m = url.match(/^https?:\/\/([^\/?#]+)/i);
  return m ? m[1] : "未命名";
}

function bytesToSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDate(ts) {
  const d = new Date(ts > 1e12 ? ts : ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchInfo(ctx, slot) {
  const urls = buildVariants(slot.url);

  for (const method of ["head", "get"]) {
    for (const url of urls) {
      for (const headers of UA_LIST) {
        try {
          const resp = await ctx.http[method](url, { headers, timeout: 9000 });
          const raw = resp.headers.get("subscription-userinfo") || "";
          const info = parseUserInfo(raw);
          if (info) {
            const used = (info.upload || 0) + (info.download || 0);
            const totalBytes = info.total || 0;
            const percent = totalBytes > 0 ? (used / totalBytes) * 100 : 0;
            return {
              name: slot.name,
              error: null,
              used,
              totalBytes,
              percent,
              expire: info.expire || null,
              remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null,
            };
          }
        } catch (_) {}
      }
    }
  }

  return { name: slot.name, error: true };
}

const UA_LIST = [
  { "User-Agent": "Quantumult%20X/1.5.2" },
  { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" },
  { "User-Agent": "mihomo/1.19.3", Accept: "application/x-yaml,text/plain,*/*" },
];

function buildVariants(url) {
  const seen = new Set();
  const out = [];
  const add = u => { if (u && !seen.has(u)) { seen.add(u); out.push(u); } };
  add(url);
  add(withParam(url, "flag", "clash"));
  add(withParam(url, "flag", "meta"));
  add(withParam(url, "target", "clash"));
  return out;
}

function withParam(url, key, value) {
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function parseUserInfo(header) {
  if (!header) return null;
  const pairs = header.match(/\w+=[\d.eE+-]+/g) || [];
  if (!pairs.length) return null;
  return Object.fromEntries(
    pairs.map(p => {
      const [k, v] = p.split("=");
      return [k, Number(v)];
    })
  );
}

function getRemainingDays(resetDay) {
  const now = new Date();
  const day = now.getDate();
  let next = new Date(now.getFullYear(), now.getMonth(), resetDay);
  if (day >= resetDay) next = new Date(now.getFullYear(), now.getMonth() + 1, resetDay);
  return Math.max(0, Math.ceil((next - now) / 86400000));
}