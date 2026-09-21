// Surge Information Panel - polished / home-aware edition
// 多源查询实际出口 IP；家庭 SSID(wait/sky) 只展示网关接管状态，外出网络校验 Binance=TW / OKX=SG。

const details = $surge.selectGroupDetails ? $surge.selectGroupDetails() : { decisions: {} };
const decisions = details.decisions || {};
const wifi = $network.wifi || {};
const cell = $network["cellular-data"] || {};
const v4 = $network.v4 || {};
const dns = $network.dns || [];
const ssid = wifi.ssid || "";
const isHome = ssid === "wait" || ssid === "sky";

function safe(v, fallback = "-") {
  return (v === undefined || v === null || v === "") ? fallback : String(v);
}

function networkName() {
  if (ssid) return `Wi-Fi · ${ssid}`;
  const parts = ["蜂窝"];
  if (cell.carrier && cell.carrier !== "-") parts.push(String(cell.carrier));
  if (cell.radio) parts.push(String(cell.radio));
  if (parts.length > 1) return parts.join(" · ");
  return safe(v4.primaryInterface, "未知网络");
}

const countryNames = {
  CN: "中国大陆", HK: "香港", MO: "澳门", TW: "台湾",
  JP: "日本", KR: "韩国", SG: "新加坡", MY: "马来西亚",
  TH: "泰国", VN: "越南", ID: "印度尼西亚", PH: "菲律宾",
  IN: "印度", US: "美国", CA: "加拿大", MX: "墨西哥",
  GB: "英国", IE: "爱尔兰", FR: "法国", DE: "德国",
  NL: "荷兰", BE: "比利时", LU: "卢森堡", CH: "瑞士",
  AT: "奥地利", ES: "西班牙", PT: "葡萄牙", IT: "意大利",
  SE: "瑞典", NO: "挪威", FI: "芬兰", DK: "丹麦",
  IS: "冰岛", PL: "波兰", CZ: "捷克", HU: "匈牙利",
  RO: "罗马尼亚", GR: "希腊", UA: "乌克兰", RU: "俄罗斯",
  TR: "土耳其", AE: "阿联酋", SA: "沙特阿拉伯", QA: "卡塔尔",
  IL: "以色列", EG: "埃及", ZA: "南非", AU: "澳大利亚",
  NZ: "新西兰", BR: "巴西", AR: "阿根廷", CL: "智利"
};

function flagFromCode(code) {
  const cc = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "🌐";
  return String.fromCodePoint(cc.charCodeAt(0) + 127397, cc.charCodeAt(1) + 127397);
}

function countryLabel(code) {
  const cc = String(code || "??").toUpperCase();
  const name = countryNames[cc] || cc;
  return `${flagFromCode(cc)} ${name}`;
}

const strategyRegions = [
  ["中国", "🇨🇳"], ["香港", "🇭🇰"], ["澳门", "🇲🇴"], ["台湾", "🇹🇼"],
  ["日本", "🇯🇵"], ["韩国", "🇰🇷"], ["新加坡", "🇸🇬"], ["美国", "🇺🇸"],
  ["英国", "🇬🇧"], ["德国", "🇩🇪"], ["法国", "🇫🇷"], ["澳大利亚", "🇦🇺"]
];

function decorateStrategy(value) {
  const s = safe(value, "默认");
  for (const [keyword, flag] of strategyRegions) {
    if (s.includes(keyword)) return s.includes(flag) ? s : `${flag} ${s}`;
  }
  return s;
}

const providers = [
  {
    name: "Cloudflare",
    url: "https://www.cloudflare.com/cdn-cgi/trace",
    parse: (data) => {
      const m = String(data || "").match(/(?:^|\n)ip=([^\n\r]+)/);
      return m ? m[1].trim() : null;
    }
  },
  {
    name: "ipify",
    url: "https://api64.ipify.org",
    parse: (data) => {
      const s = String(data || "").trim();
      return /^[0-9a-fA-F:.]+$/.test(s) ? s : null;
    }
  },
  {
    name: "ifconfig.co",
    url: "https://ifconfig.co/ip",
    parse: (data) => {
      const s = String(data || "").trim();
      return /^[0-9a-fA-F:.]+$/.test(s) ? s : null;
    }
  }
];

function lookup(policy, label, callback) {
  let index = 0;
  let lastError = "";

  function attempt() {
    if (index >= providers.length) {
      callback({ label, policy, ok: false, error: lastError });
      return;
    }

    const p = providers[index++];
    $httpClient.get({
      url: p.url,
      policy,
      timeout: 5,
      "auto-cookie": false,
      headers: { "User-Agent": "Surge/5" }
    }, (error, response, data) => {
      const status = response && response.status ? response.status : 0;
      const ip = (!error && status >= 200 && status < 300) ? p.parse(data) : null;
      if (!ip) {
        lastError = `${p.name}:${error || status || "parse"}`;
        attempt();
        return;
      }

      callback({
        label,
        policy,
        ok: true,
        ip,
        cc: safe($utils.geoip(ip), "??").toUpperCase(),
        asn: safe($utils.ipasn(ip), "?"),
        aso: safe($utils.ipaso(ip), "未知网络")
      });
    });
  }

  attempt();
}

function normalExitLines(result) {
  if (!result || !result.ok) return ["🌐 普通  ❌ 查询失败"];
  return [
    `🌐 普通  ${countryLabel(result.cc)} · ${result.ip}`,
    `        AS${result.asn} · ${result.aso}`
  ];
}

function tradeExitLines(icon, name, result, expectedCC) {
  const lines = [`${icon} ${name}`];
  if (!result || !result.ok) {
    lines.push("❌ 查询失败");
    return lines;
  }

  const location = countryLabel(result.cc);
  if (isHome) {
    lines.push(`• ${location} · ${result.ip}`);
  } else if (result.cc === expectedCC) {
    lines.push(`✅ ${location} · ${result.ip}`);
  } else {
    lines.push(`⚠️ ${location} · ${result.ip}`);
    lines.push(`   期望：${countryLabel(expectedCC)}`);
  }
  lines.push(`   AS${result.asn} · ${result.aso}`);
  return lines;
}

const results = {};
let pending = isHome ? 1 : 3;
let done = false;

function finishOne(key, value) {
  results[key] = value;
  pending -= 1;
  if (pending === 0) render();
}

function render() {
  if (done) return;
  done = true;

  if (isHome) {
    const lines = [];
    lines.push(`📶 Wi-Fi · ${ssid}`);
    lines.push(`📍 IPv4  ${safe(v4.primaryAddress)}`);
    lines.push("");
    lines.push("🔀 分流状态");
    lines.push("🛡️ Surge    DIRECT");
    lines.push("💰 Binance  上级网关接管");
    lines.push("💱 OKX      上级网关接管");
    lines.push("");
    lines.push("🌍 本机出口");
    if (results.normal && results.normal.ok) {
      lines.push(`${countryLabel(results.normal.cc)} · ${results.normal.ip}`);
      lines.push(`AS${results.normal.asn} · ${results.normal.aso}`);
    } else {
      lines.push("❌ 查询失败");
    }
    lines.push("");
    lines.push("ℹ️ 交易出口");
    lines.push("Binance / OKX 最终出口由上级网关策略决定");
    lines.push("Surge 本机不判定最终出口");

    $done({
      title: "🏠 家庭网络 · 网关接管",
      content: lines.join("\n"),
      style: "info"
    });
    return;
  }

  let style = "info";
  let title = "🌐 Surge 智能网络";

  if (results.binance && results.okx && results.binance.ok && results.okx.ok) {
    const binanceOK = results.binance.cc === "TW";
    const okxOK = results.okx.cc === "SG";
    if (binanceOK && okxOK) {
      style = "good";
      title = "✅ 交易出口正常";
    } else {
      style = "alert";
      title = "⚠️ 检查交易出口";
    }
  } else {
    style = "alert";
    title = "❌ 出口查询异常";
  }

  const lines = [];
  lines.push("🌐 当前网络");
  lines.push(`📶 ${networkName()}`);
  lines.push(`📍 IPv4  ${safe(v4.primaryAddress)}`);

  lines.push("");
  lines.push("🧩 当前策略");
  lines.push(`🚀 主策略  ${decorateStrategy(decisions["节点选择"])}`);
  lines.push(`💰 币安    ${decorateStrategy(decisions["币安交易"] || "默认")}`);
  lines.push(`💱 欧易    ${decorateStrategy(decisions["欧易交易"] || "默认")}`);

  lines.push("");
  lines.push("🌍 出口状态");
  lines.push(...normalExitLines(results.normal));
  lines.push("");
  lines.push(...tradeExitLines("💰", "Binance", results.binance, "TW"));
  lines.push("");
  lines.push(...tradeExitLines("💱", "OKX", results.okx, "SG"));

  $done({ title, content: lines.join("\n"), style });
}

lookup("节点选择", "普通出口", (v) => finishOne("normal", v));
if (!isHome) {
  lookup("币安交易", "Binance", (v) => finishOne("binance", v));
  lookup("欧易交易", "OKX", (v) => finishOne("okx", v));
}

setTimeout(() => {
  if (!done) {
    done = true;
    $done({
      title: isHome ? "🏠 家庭网络 · 网关接管" : "⚠️ 出口查询超时",
      content: `🌐 当前网络\n📶 ${networkName()}\n\n🔄 出口查询超时，请稍后手动刷新`,
      style: isHome ? "info" : "alert"
    });
  }
}, 18000);
