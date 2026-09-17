// Surge 5.22+ event script
// 网络切换或引擎启动时，只主动重测交易专用 fallback。
// 主 Smart 与地区 url-test 本身会在网络变化后失效并按需重测，避免这里重复扫全订阅造成耗电。

const groups = ["台湾交易稳定", "新加坡交易稳定"];
let remaining = groups.length;
let finished = false;

function finish() {
  if (!finished && remaining <= 0) {
    finished = true;
    const eventName = (typeof $event !== "undefined" && $event.name) ? $event.name : "manual";
    const ssid = ($network.wifi && $network.wifi.ssid) ? $network.wifi.ssid : "-";
    const carrier = ($network["cellular-data"] && $network["cellular-data"].carrier) ? $network["cellular-data"].carrier : "-";
    $surge.logbook(`交易出口已重测 · ${eventName} · Wi-Fi:${ssid} · Cellular:${carrier}`);
    $done();
  }
}

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

// 极端情况下防止回调异常导致脚本长时间挂起
setTimeout(() => {
  if (!finished) {
    finished = true;
    $surge.logbook("交易出口重测超时，已结束本次任务");
    $done();
  }
}, 12000);
