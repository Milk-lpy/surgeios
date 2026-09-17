// Surge subscription converter helper
// Converts a universal Base64 subscription containing ss:// and anytls://
// into Surge [Proxy]-compatible lines. It cannot inject proxies into a profile;
// on iOS it copies the converted result through a notification action.

(function () {
  'use strict';

  var STORE_OUTPUT = 'surge-subconverter-output-v1';
  var STORE_STATUS = 'surge-subconverter-status-v1';

  function safeDecodeURIComponent(s) {
    try { return decodeURIComponent(s); } catch (_) { return s; }
  }

  function base64Bytes(input) {
    var s = String(input || '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = [];
    var i, c1, c2, c3, c4, n;
    for (i = 0; i < s.length; i += 4) {
      c1 = alphabet.indexOf(s.charAt(i));
      c2 = alphabet.indexOf(s.charAt(i + 1));
      c3 = s.charAt(i + 2) === '=' ? -1 : alphabet.indexOf(s.charAt(i + 2));
      c4 = s.charAt(i + 3) === '=' ? -1 : alphabet.indexOf(s.charAt(i + 3));
      if (c1 < 0 || c2 < 0 || (c3 < 0 && s.charAt(i + 2) !== '=') || (c4 < 0 && s.charAt(i + 3) !== '=')) {
        throw new Error('invalid base64');
      }
      n = (c1 << 18) | (c2 << 12) | ((c3 < 0 ? 0 : c3) << 6) | (c4 < 0 ? 0 : c4);
      out.push((n >> 16) & 255);
      if (c3 >= 0) out.push((n >> 8) & 255);
      if (c4 >= 0) out.push(n & 255);
    }
    return out;
  }

  function utf8Decode(bytes) {
    var out = '';
    var i = 0, b1, b2, b3, b4, cp;
    while (i < bytes.length) {
      b1 = bytes[i++];
      if (b1 < 0x80) {
        out += String.fromCharCode(b1);
      } else if ((b1 & 0xE0) === 0xC0 && i < bytes.length) {
        b2 = bytes[i++];
        cp = ((b1 & 0x1F) << 6) | (b2 & 0x3F);
        out += String.fromCharCode(cp);
      } else if ((b1 & 0xF0) === 0xE0 && i + 1 < bytes.length) {
        b2 = bytes[i++]; b3 = bytes[i++];
        cp = ((b1 & 0x0F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F);
        out += String.fromCharCode(cp);
      } else if ((b1 & 0xF8) === 0xF0 && i + 2 < bytes.length) {
        b2 = bytes[i++]; b3 = bytes[i++]; b4 = bytes[i++];
        cp = ((b1 & 0x07) << 18) | ((b2 & 0x3F) << 12) | ((b3 & 0x3F) << 6) | (b4 & 0x3F);
        cp -= 0x10000;
        out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
      } else {
        out += '\uFFFD';
      }
    }
    return out;
  }

  function base64Utf8(input) {
    return utf8Decode(base64Bytes(input));
  }

  function looksLikeUniversal(text) {
    return /(^|\r?\n)(ss|anytls):\/\//i.test(String(text || ''));
  }

  function decodeSubscription(text) {
    var raw = String(text || '').trim();
    if (looksLikeUniversal(raw)) return raw;
    var decoded = base64Utf8(raw);
    if (!looksLikeUniversal(decoded)) throw new Error('订阅内容不是受支持的 ss:// / anytls:// 通用订阅');
    return decoded;
  }

  function splitFragment(uri) {
    var idx = uri.indexOf('#');
    if (idx < 0) return { body: uri, name: '' };
    return { body: uri.slice(0, idx), name: safeDecodeURIComponent(uri.slice(idx + 1)) };
  }

  function splitQuery(s) {
    var idx = s.indexOf('?');
    if (idx < 0) return { body: s, query: '' };
    return { body: s.slice(0, idx), query: s.slice(idx + 1) };
  }

  function parseQuery(q) {
    var obj = {};
    if (!q) return obj;
    q.split('&').forEach(function (part) {
      if (!part) return;
      var idx = part.indexOf('=');
      var k = safeDecodeURIComponent(idx < 0 ? part : part.slice(0, idx));
      var v = safeDecodeURIComponent(idx < 0 ? '' : part.slice(idx + 1));
      if (!(k in obj)) obj[k] = v;
    });
    return obj;
  }

  function parseHostPort(s) {
    var host, port, idx, end;
    if (s.charAt(0) === '[') {
      end = s.indexOf(']');
      if (end < 0 || s.charAt(end + 1) !== ':') throw new Error('invalid IPv6 host:port');
      host = s.slice(1, end);
      port = Number(s.slice(end + 2));
    } else {
      idx = s.lastIndexOf(':');
      if (idx <= 0) throw new Error('missing port');
      host = s.slice(0, idx);
      port = Number(s.slice(idx + 1));
    }
    if (!host || !port || port < 1 || port > 65535) throw new Error('invalid host/port');
    return { host: host, port: port };
  }

  function quoteValue(v) {
    v = String(v);
    if (/[,"\r\n]|^\s|\s$/.test(v)) return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    return v;
  }

  function normalizeName(name, fallback) {
    var n = String(name || '').trim();
    return n || fallback;
  }

  function parseSS(uri, index) {
    var sf = splitFragment(uri);
    var name = normalizeName(sf.name, 'SS-' + index);
    var rest = sf.body.slice(5);
    var sq = splitQuery(rest);
    rest = sq.body;
    var creds, hp, at = rest.lastIndexOf('@');

    if (at >= 0) {
      var userPart = rest.slice(0, at);
      var hostPart = rest.slice(at + 1);
      try { creds = base64Utf8(userPart); }
      catch (_) { creds = safeDecodeURIComponent(userPart); }
      hp = parseHostPort(hostPart);
    } else {
      var decoded = base64Utf8(rest);
      var decodedAt = decoded.lastIndexOf('@');
      if (decodedAt < 0) throw new Error('invalid SS URI');
      creds = decoded.slice(0, decodedAt);
      hp = parseHostPort(decoded.slice(decodedAt + 1));
    }

    var colon = creds.indexOf(':');
    if (colon <= 0) throw new Error('invalid SS credential');
    var method = creds.slice(0, colon);
    var password = creds.slice(colon + 1);
    if (!password) throw new Error('empty SS password');

    return {
      name: name,
      protocol: 'ss',
      line: name + ' = ss, ' + hp.host + ', ' + hp.port +
        ', encrypt-method=' + quoteValue(method) +
        ', password=' + quoteValue(password) +
        ', tfo=true, udp-relay=true'
    };
  }

  function truthy(v) {
    return /^(1|true|yes|on)$/i.test(String(v || ''));
  }

  function parseAnyTLS(uri, index) {
    var sf = splitFragment(uri);
    var name = normalizeName(sf.name, 'AnyTLS-' + index);
    var rest = sf.body.slice('anytls://'.length);
    var sq = splitQuery(rest);
    var at = sq.body.lastIndexOf('@');
    if (at <= 0) throw new Error('invalid AnyTLS URI');
    var password = safeDecodeURIComponent(sq.body.slice(0, at));
    var hp = parseHostPort(sq.body.slice(at + 1));
    var q = parseQuery(sq.query);
    var params = ['password=' + quoteValue(password)];

    var sni = q.sni || q.peer || q.serverName || q.server_name;
    if (sni) params.push('sni=' + quoteValue(sni));
    if (truthy(q.insecure) || truthy(q.allowInsecure) || truthy(q['skip-cert-verify'])) {
      params.push('skip-cert-verify=true');
    }
    if (q.reuse !== undefined) {
      if (/^(0|false|no|off)$/i.test(String(q.reuse))) params.push('reuse=false');
      else if (truthy(q.reuse)) params.push('reuse=true');
    }
    if (q.alpn) params.push('alpn=' + quoteValue(q.alpn));

    return {
      name: name,
      protocol: 'anytls',
      line: name + ' = anytls, ' + hp.host + ', ' + hp.port + ', ' + params.join(', ')
    };
  }

  function makeUniqueName(item, seen) {
    var base = item.name;
    var n = base;
    var i = 2;
    while (seen[n]) n = base + ' #' + (i++);
    seen[n] = true;
    if (n !== item.name) {
      item.name = n;
      item.line = n + item.line.slice(item.line.indexOf(' ='));
    }
    return item;
  }

  function convertText(text) {
    var decoded = decodeSubscription(text);
    var lines = decoded.split(/\r?\n/);
    var out = [], errors = [], seen = {};
    var counts = { ss: 0, anytls: 0, ignored: 0 };

    lines.forEach(function (raw, idx) {
      var line = raw.trim();
      if (!line) return;
      try {
        var item;
        if (/^ss:\/\//i.test(line)) item = parseSS(line, idx + 1);
        else if (/^anytls:\/\//i.test(line)) item = parseAnyTLS(line, idx + 1);
        else { counts.ignored += 1; return; }
        item = makeUniqueName(item, seen);
        out.push(item.line);
        counts[item.protocol] += 1;
      } catch (e) {
        errors.push({ index: idx + 1, reason: String(e && e.message ? e.message : e) });
      }
    });

    if (!out.length) throw new Error('没有转换出可用节点');
    return {
      output: out.join('\n'),
      total: out.length,
      ss: counts.ss,
      anytls: counts.anytls,
      ignored: counts.ignored,
      failed: errors.length,
      errors: errors
    };
  }

  function nowISO() {
    try { return new Date().toISOString(); } catch (_) { return String(Date.now()); }
  }

  function notifyCopy(result, fromCache) {
    var subtitle = result.total + ' 个节点 · SS ' + result.ss + ' · AnyTLS ' + result.anytls;
    if (result.failed) subtitle += ' · 失败 ' + result.failed;
    $notification.post(
      fromCache ? '已读取上次转换结果' : '订阅转换完成',
      subtitle,
      '点击此通知，将 Surge 节点列表复制到剪贴板',
      { action: 'clipboard', text: result.output }
    );
  }

  function saveResult(result) {
    $persistentStore.write(result.output, STORE_OUTPUT);
    var status = {
      time: nowISO(), total: result.total, ss: result.ss, anytls: result.anytls,
      ignored: result.ignored, failed: result.failed
    };
    $persistentStore.write(JSON.stringify(status), STORE_STATUS);
  }

  function makeStatusPayload(statusText, outputText) {
    var st = {};
    try { st = JSON.parse(statusText || '{}'); } catch (_) { st = {}; }
    return {
      ok: true,
      has_cache: !!outputText,
      time: st.time || null,
      total: Number(st.total || 0),
      ss: Number(st.ss || 0),
      anytls: Number(st.anytls || 0),
      ignored: Number(st.ignored || 0),
      failed: Number(st.failed || 0)
    };
  }

  function renderWebApp() {
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
      '<meta name="color-scheme" content="light dark"><title>Surge 订阅转换助手</title><style>' +
      ':root{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC",sans-serif;color-scheme:light dark;background:#f5f7fb;color:#111827}' +
      '@media(prefers-color-scheme:dark){:root{background:#0b0f16;color:#eef2f7}}body{margin:0;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);background:inherit;color:inherit}' +
      '.wrap{max-width:880px;margin:auto;padding:20px}.hero{padding:24px;border-radius:24px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;box-shadow:0 16px 44px rgba(37,99,235,.24)}' +
      'h1{font-size:28px;margin:0 0 8px}.sub{opacity:.86}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.card{background:rgba(255,255,255,.78);border:1px solid rgba(127,127,127,.16);backdrop-filter:blur(18px);padding:16px;border-radius:18px;box-shadow:0 8px 28px rgba(15,23,42,.08)}' +
      '@media(prefers-color-scheme:dark){.card{background:rgba(22,28,38,.84)}}.n{font-size:27px;font-weight:750}.k{font-size:12px;opacity:.65;margin-top:4px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}' +
      'button{appearance:none;border:0;border-radius:14px;padding:12px 16px;font-size:15px;font-weight:650;background:#2563eb;color:#fff}button.secondary{background:rgba(127,127,127,.18);color:inherit}button:disabled{opacity:.45}' +
      '.status{font-size:13px;opacity:.72;margin:8px 0 14px}.box{white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.5;max-height:46vh;overflow:auto;background:rgba(127,127,127,.10);border-radius:16px;padding:14px}' +
      '.foot{font-size:12px;opacity:.55;margin-top:16px}.good{color:#16a34a}.bad{color:#ef4444}@media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr)}.hero{padding:20px}h1{font-size:24px}}' +
      '</style></head><body><main class="wrap"><section class="hero"><h1>Surge 订阅转换助手</h1><div class="sub">本机劫持页面 · Token 不会显示在前端</div></section>' +
      '<section class="grid"><div class="card"><div class="n" id="total">-</div><div class="k">总节点</div></div><div class="card"><div class="n" id="ss">-</div><div class="k">Shadowsocks</div></div><div class="card"><div class="n" id="anytls">-</div><div class="k">AnyTLS</div></div><div class="card"><div class="n" id="failed">-</div><div class="k">失败</div></div></section>' +
      '<div class="actions"><button id="convert">刷新并转换</button><button id="load" class="secondary">载入节点</button><button id="copy" class="secondary">复制全部</button></div>' +
      '<div id="status" class="status">正在读取缓存…</div><div id="output" class="box">暂无节点数据</div><textarea id="clip" style="position:fixed;left:-9999px;top:-9999px"></textarea>' +
      '<div class="foot">访问地址：http://surge-converter.test/ · 仅在启用该 Surge 模块时生效</div></main><script>' +
      'const $=id=>document.getElementById(id);let current="";' +
      'async function json(u){const r=await fetch(u,{cache:"no-store"});const j=await r.json();if(!r.ok)throw new Error(j.error||("HTTP "+r.status));return j}' +
      'function paint(s){$("total").textContent=s.total||0;$("ss").textContent=s.ss||0;$("anytls").textContent=s.anytls||0;$("failed").textContent=s.failed||0;$("failed").className="n "+(s.failed?"bad":"good");$("status").textContent=(s.has_cache?"缓存可用":"暂无缓存")+(s.time?" · "+new Date(s.time).toLocaleString():"")}' +
      'async function status(){try{paint(await json("/api/status?ts="+Date.now()))}catch(e){$("status").textContent=e.message}}' +
      'async function load(){try{const r=await fetch("/api/output?ts="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error("暂无转换缓存");current=await r.text();$("output").textContent=current||"暂无节点数据"}catch(e){$("status").textContent=e.message}}' +
      'async function convert(){const b=$("convert");b.disabled=true;$("status").textContent="正在拉取并转换订阅…";try{const s=await json("/api/convert?ts="+Date.now());paint(s);await load();$("status").textContent="转换完成 · "+s.total+" 个节点"}catch(e){$("status").textContent="转换失败："+e.message}finally{b.disabled=false}}' +
      'async function copy(){if(!current)await load();if(!current)return;try{await navigator.clipboard.writeText(current);$("status").textContent="已复制到剪贴板"}catch(e){const t=$("clip");t.value=current;t.focus();t.select();document.execCommand("copy");$("status").textContent="已复制到剪贴板"}}' +
      '$("convert").onclick=convert;$("load").onclick=load;$("copy").onclick=copy;status();load();' +
      '</script></body></html>';
  }

  function jsonMock(obj, status) {
    return { response: { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) } };
  }

  function textMock(text, type, status) {
    return { response: { status: status || 200, headers: { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, body: String(text || '') } };
  }

  function requestPath(url) {
    var p = String(url || '').replace(/^https?:\/\/[^/]+/i, '');
    p = p.split('?')[0] || '/';
    return p;
  }

  function handleWebRequest() {
    var path = requestPath($request && $request.url);
    var arg = String(typeof $argument !== 'undefined' ? ($argument || '') : '').trim();
    var cached = $persistentStore.read(STORE_OUTPUT);
    var statusText = $persistentStore.read(STORE_STATUS);

    if (path === '/' || path === '/index.html') {
      $done(textMock(renderWebApp(), 'text/html; charset=utf-8'));
      return;
    }
    if (path === '/api/status') {
      $done(jsonMock(makeStatusPayload(statusText, cached)));
      return;
    }
    if (path === '/api/output') {
      if (!cached) $done(textMock('暂无转换缓存', 'text/plain; charset=utf-8', 404));
      else $done(textMock(cached, 'text/plain; charset=utf-8'));
      return;
    }
    if (path === '/api/convert') {
      if (!/^https?:\/\//i.test(arg)) {
        $done(jsonMock({ ok: false, error: '模块中没有配置有效的订阅 URL' }, 500));
        return;
      }
      $httpClient.get({ url: arg, timeout: 20, 'auto-cookie': false }, function (error, response, data) {
        if (error || !data || (response && response.status && response.status >= 400)) {
          var oldOutput = $persistentStore.read(STORE_OUTPUT);
          var fallbackStatus = makeStatusPayload($persistentStore.read(STORE_STATUS), oldOutput);
          fallbackStatus.ok = false;
          fallbackStatus.error = oldOutput ? '订阅更新失败，已保留上次成功缓存' : '订阅请求失败，且没有可用缓存';
          $done(jsonMock(fallbackStatus, 502));
          return;
        }
        try {
          var result = convertText(data);
          saveResult(result);
          var fresh = makeStatusPayload($persistentStore.read(STORE_STATUS), result.output);
          $done(jsonMock(fresh));
        } catch (e) {
          $done(jsonMock({ ok: false, error: String(e && e.message ? e.message : e) }, 500));
        }
      });
      return;
    }
    $done(textMock('Not Found', 'text/plain; charset=utf-8', 404));
  }

  function runSurge() {
    var arg = String(typeof $argument !== 'undefined' ? ($argument || '') : '').trim();

    if (arg === '__OPEN_WEB__') {
      $notification.post('Surge 订阅转换助手', '', '点击打开本地转换前端', { action: 'open-url', url: 'http://surge-converter.test/' });
      $done();
      return;
    }

    if (arg === '__COPY_CACHE__') {
      var cached = $persistentStore.read(STORE_OUTPUT);
      var st = $persistentStore.read(STORE_STATUS);
      if (!cached) {
        $notification.post('没有缓存', '', '请先运行“订阅转换并复制”');
        $done();
        return;
      }
      var status = { total: 0, ss: 0, anytls: 0, failed: 0 };
      try { status = JSON.parse(st || '{}'); } catch (_) {}
      status.output = cached;
      notifyCopy(status, true);
      $done();
      return;
    }

    if (!/^https?:\/\//i.test(arg)) {
      $notification.post('订阅转换失败', '', '模块中没有配置有效的订阅 URL');
      $done();
      return;
    }

    $httpClient.get({ url: arg, timeout: 20, 'auto-cookie': false }, function (error, response, data) {
      if (error || !data || (response && response.status && response.status >= 400)) {
        var fallback = $persistentStore.read(STORE_OUTPUT);
        if (fallback) {
          var oldst = {};
          try { oldst = JSON.parse($persistentStore.read(STORE_STATUS) || '{}'); } catch (_) {}
          oldst.output = fallback;
          notifyCopy(oldst, true);
          $notification.post('订阅更新失败', '', '已保留并提供上次成功转换结果');
        } else {
          $notification.post('订阅转换失败', '', '订阅请求失败，且没有可用缓存');
        }
        $done();
        return;
      }

      try {
        var result = convertText(data);
        saveResult(result);
        notifyCopy(result, false);
      } catch (e) {
        $notification.post('订阅转换失败', '', String(e && e.message ? e.message : e));
      }
      $done();
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      convertText: convertText,
      decodeSubscription: decodeSubscription,
      parseSS: parseSS,
      parseAnyTLS: parseAnyTLS,
      renderWebApp: renderWebApp,
      makeStatusPayload: makeStatusPayload,
      requestPath: requestPath
    };
  } else if (typeof $request !== 'undefined') {
    handleWebRequest();
  } else {
    runSurge();
  }
})();
