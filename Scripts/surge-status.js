// Surge Information Panel
// 展示当前网络、策略选择，以及通过不同策略实际访问外网时的出口 IP / 国家 / ASN。

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
  if (cell.carrier || cell.radio) return `蜂窝 · ${safe(cell.carrier)} · ${safe(cell.radio)}`;
  return safe(v4.primaryInterface, "未知网络");
}

function lookup(policy, label, callback) {
  $httpClient.get({
    url: "https://api.my-ip.io/ip",
    policy: policy,
    timeout: 5,
    "auto-cookie": false
  }, (error, response, data) => {
    if (error || !data) {
      callback({ label, policy, ok: false, text: `${label}: 查询失败` });
      return;
    }

    const ip = String(data).trim();
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
  lines.push(`主策略：${safe(decisions["节点选择"])}  ·  币安：${safe(decisions["币安交易"])}`);
  lines.push(`欧易：${safe(decisions["欧易交易"])}  ·  GV：${safe(decisions["Google Voice"])}`);
  lines.push("");
  lines.push(results.normal ? results.normal.text : "普通出口: -");
  lines.push(results.binance ? results.binance.text : "Binance: -");
  lines.push(results.okx ? results.okx.text : "OKX: -");

  let style = "info";
  let title = "Surge 智能网络";

  if (!isHome && results.binance && results.okx && results.binance.ok && results.okx.ok) {
    const binanceOK = results.binance.cc === "TW";
    const okxOK = results.okx.cc === "SG";
    if (binanceOK && okxOK) {
      style = "good";
      title = "交易出口正常";
    } else {
      style = "alert";
      title = "检查交易出口地区";
    }
  } else if (isHome) {
    style = "info";
    title = "家庭网络：交给网关处理";
  }

  $done({ title, content: lines.join("\n"), style });
}

lookup("通用网络", "普通出口", (v) => finishOne("normal", v));
lookup("币安网络", "Binance", (v) => finishOne("binance", v));
lookup("欧易网络", "OKX", (v) => finishOne("okx", v));

// 防止外部 IP 服务异常导致 Panel 一直等待
setTimeout(() => {
  if (!done) {
    done = true;
    $done({
      title: "Surge 智能网络",
      content: `网络：${networkName()}\n出口查询超时，请稍后手动刷新`,
      style: "alert"
    });
  }
}, 10000);
