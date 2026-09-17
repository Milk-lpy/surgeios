// Surge Information Panel - resilient edition
// 多源查询实际出口 IP；分别按主策略、Binance、OKX 的真实业务策略发起请求。

const details = $surge.selectGroupDetails ? $surge.selectGroupDetails() : { decisions: {} };
const decisions = details.decisions || {};
const wifi = $network.wifi || {};
const cell = $network["cellular-data"] || {};
const v4 = $network.v4 || {};
const dns = $network.dns || [];
const ssid = wifi.ssid || "";

function safe(v, fallback = "-") {
  return (v === undefined || v === null || v === "") ? fallback : String(v);
}

function networkName() {
  if (ssid) return `Wi-Fi · ${ssid}`;
  if (cell.carrier || cell.radio) return `蜂窝 · ${safe(cell.carrier)} · ${safe(cell.radio)}`;
  return safe(v4.primaryInterface, "未知网络");
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
      callback({ label, policy, ok: false, text: `${label}: 查询失败`, error: lastError });
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

      const cc = safe($utils.geoip(ip), "??");
      const asn = safe($utils.ipasn(ip), "?");
      const aso = safe($utils.ipaso(ip), "未知网络");
      callback({
        label,
        policy,
        ok: true,
        ip,
        cc,
        asn,
        aso,
        text: `${label}: ${ip} · ${cc} · AS${asn} ${aso}`
      });
    });
  }

  attempt();
}

const results = {};
let pending = 3;
let done = false;

function finishOne(key, value) {
  results[key] = value;
  pending -= 1;
  if (pending === 0) render();
}

function render() {
  if (done) return;
  done = true;

  const lines = [];
  lines.push(`网络：${networkName()}`);
  lines.push(`IPv4：${safe(v4.primaryAddress)}  路由：${safe(v4.primaryRouter)}`);
  if (dns.length) lines.push(`DNS：${dns.slice(0, 3).join(" / ")}`);
  lines.push("");
  lines.push(`主策略：${safe(decisions["节点选择"])}  ·  币安：${safe(decisions["币安交易"], "默认")}`);
  lines.push(`欧易：${safe(decisions["欧易交易"], "默认")}  ·  GV：${safe(decisions["Google Voice"], "默认")}`);
  lines.push("");
  lines.push(results.normal ? results.normal.text : "普通出口: -");
  lines.push(results.binance ? results.binance.text : "Binance: -");
  lines.push(results.okx ? results.okx.text : "OKX: -");

  let style = "info";
  let title = "Surge 智能网络";

  if (results.binance && results.okx && results.binance.ok && results.okx.ok) {
    const binanceOK = results.binance.cc === "TW";
    const okxOK = results.okx.cc === "SG";
    if (binanceOK && okxOK) {
      style = "good";
      title = "交易出口正常";
    } else {
      style = "alert";
      title = "检查交易出口地区";
    }
  }

  $done({ title, content: lines.join("\n"), style });
}

// 用用户真正看到和选择的业务组进行探测，和实际 App 分流保持一致。
lookup("节点选择", "普通出口", (v) => finishOne("normal", v));
lookup("币安交易", "Binance", (v) => finishOne("binance", v));
lookup("欧易交易", "OKX", (v) => finishOne("okx", v));

setTimeout(() => {
  if (!done) {
    done = true;
    $done({
      title: "Surge 智能网络",
      content: `网络：${networkName()}\n出口查询超时，请稍后手动刷新`,
      style: "alert"
    });
  }
}, 18000);
