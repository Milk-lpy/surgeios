// Surge 5.22+ event script
// 非家庭网络切换/启动后，延迟重测交易与 GV 稳定组；家庭 wait/sky 由上级网关接管，不做无意义重测。

const groups = ["台湾交易稳定", "新加坡交易稳定", "美国稳定"];
const eventName = (typeof $event !== "undefined" && $event.name) ? $event.name : "manual";
const ssid = ($network.wifi && $network.wifi.ssid) ? $network.wifi.ssid : "";
const carrier = ($network["cellular-data"] && $network["cellular-data"].carrier) ? $network["cellular-data"].carrier : "-";
const isHome = ssid === "wait" || ssid === "sky";
let remaining = groups.length;
let finished = false;

function finish(message) {
  if (finished) return;
  if (remaining > 0 && !message) return;
  finished = true;
  $surge.logbook(message || `稳定出口已重测 · ${eventName} · Wi-Fi:${ssid || "-"} · Cellular:${carrier}`);
  $done();
}

if (isHome) {
  remaining = 0;
  finish(`家庭网络 ${ssid} · 网关接管，跳过交易/GV 出口重测`);
} else {
  // 给 policy-path / 本地订阅输出留一点初始化时间，减少引擎启动瞬间空组告警。
  setTimeout(() => {
    groups.forEach((name) => {
      try {
        $surge.retestGroup(name, (result) => {
          const available = result && result.availablePolicyNames ? result.availablePolicyNames.join(" / ") : "无结果";
          console.log(`${name}: ${available}`);
          remaining -= 1;
          finish();
        });
      } catch (e) {
        console.log(`${name} retest failed: ${e}`);
        remaining -= 1;
        finish();
      }
    });
  }, 1800);
}

// 极端情况下防止回调异常导致脚本长时间挂起。
setTimeout(() => {
  if (!finished) {
    remaining = 0;
    finish("稳定出口重测超时，已结束本次任务");
  }
}, 14500);
