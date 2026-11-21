'use strict';
const assert = require('node:assert/strict');
const api = require('../Scripts/subscription-studio-v3.3.js');
const id = '2cae91b3-f85c-433b-88ee-a002b9ed6d61';
const ss = 'ss://' + Buffer.from('aes-128-gcm:password').toString('base64') + '@ss.example:8388#SS';
function converts(input,match){const r=api.convertText(input);assert.equal(r.total,1);assert.match(r.output,match);return r}
function rejects(input,needle){assert.throws(()=>api.convertText(input),e=>String(e.message).includes(needle))}
converts(ss,/SS = ss, ss\.example, 8388/);
converts(Buffer.from(ss).toString('base64'),/SS = ss/);
converts('anytls://password@any.example:443?sni=any.example#Any',/Any = anytls, any\.example, 443/);
const reality='vless://'+id+'@1.2.3.4:443?security=reality&pbk=RmdmRmdmRmdmRmdmRmdmRmdmRmdmRmdmRmdmRmdmRmA&sid=012345&flow=xtls-rprx-vision&sni=www.microsoft.com#Reality';
let r=converts(reality,/reality-public-key=Rmdm/);assert.equal(r.vless,1);assert.match(r.output,/flow=xtls-rprx-vision/);
converts('vless://'+id+'@cdn.example:443?security=tls&type=ws&host=front.example&path=%2Fws#WS',/ws-headers=Host:front\.example/);
converts('vless://'+id+'@cdn.example:443?security=tls&type=httpupgrade&path=%2Fup#Upgrade',/ws-http-upgrade=true/);
converts('vless://'+id+'@grpc.example:443?security=tls&type=grpc&serviceName=service#GRPC',/grpc-service-name=service/);
converts('vless://'+id+'@x.example:443?security=tls&type=xhttp&mode=packet-up&path=%2Fx#XHTTP',/xhttp-mode=packet-up/);
converts('trojan://pw@trojan.example:443?sni=host.example&type=ws&path=%2Fws#Trojan',/Trojan = trojan/);
converts('hy2://pw@hy.example:443?obfs=salamander&obfs-password=obpw#HY2',/salamander-password=obpw/);
converts('hysteria2://pw@hy.example:443,5000-5005#Hop',/port-hopping=443;5000-5005/);
converts('tuic://'+id+':pw@tu.example:443#TUIC5',/tuic-v5.*uuid=/);
converts('tuic://token@tu.example:443#TUIC4',/tuic.*token=token/);
const vm={v:'2',ps:'VMess',add:'vm.example',port:'443',id,aid:'0',net:'ws',type:'none',host:'front.example',path:'/up',tls:'tls'};
converts('vmess://'+Buffer.from(JSON.stringify(vm)).toString('base64'),/vmess-aead=true.*tls=true.*ws=true/);
const native='[Proxy]\nNative = vless, 1.2.3.4, 443, username='+id+'\nSSNative = ss, ss.example, 8388, encrypt-method=aes-128-gcm, password=p\n[Proxy Group]\nG = select, Native';
r=api.convertText(native);assert.equal(r.total,2);assert.equal(r.vless,1);assert.match(r.output,/SSNative = ss/);assert.doesNotMatch(r.output,/G = select/);
r=api.convertText(ss+'\n'+ss);assert.equal(r.total,2);assert.match(r.output,/SS #2 = ss/);
rejects('vless://'+id+'@x.example:443?type=kcp#KCP','传输类型');
rejects('vless://'+id+'@x.example:443?type=grpc&security=none#Bad','需要 TLS');
rejects('vless://'+id+'@x.example:443?security=tls&type=xhttp&extra=%7B%22downloadSettings%22%3A%7B%7D%7D#XHTTP','XHTTP extra');
rejects('vless://'+id+'@x.example:443?security=reality&pbk=abcdef&fp=chrome#Fp','fp');
rejects(ss.replace('#SS','?plugin=v2ray-plugin#SS'),'Shadowsocks 插件');
rejects('hy2://pw@hy.example:443?obfs=not-supported#Bad','混淆');
rejects(ss+'\nvless://'+id+'@x.example:443?type=kcp#Bad','保留旧缓存');
rejects('{"error":"bad"}','JSON');
rejects('proxies:\n - name: bad','YAML/Clash');
const summary=api.maskSourceUrl('https://user:secret@example.com/sub/abc?token=short123');
assert.equal(summary.includes('secret'),false);assert.equal(summary.includes('abc'),false);assert.equal(summary.includes('short123'),false);

const sip002 = 'ss://' + Buffer.from('aes-128-gcm:pw').toString('base64') + '@ss.example.com:8388/';
converts(sip002+'#SIP002',/SIP002 = ss, ss.example.com, 8388/);
converts(sip002+'?unused=1#SIP002',/SIP002 = ss/);
converts('anytls://pw@tls.example.com:443/#AnyTLS',/AnyTLS = anytls, tls.example.com, 443/);
converts('vless://'+id+'@v.example.com:443/?security=tls#VLESS',/VLESS = vless, v.example.com, 443/);
rejects('ss://' + Buffer.from('aes-128-gcm:pw').toString('base64') + '@ss.example.com:8388/realpath#Reject', '端口');
rejects('ss://' + Buffer.from('aes-128-gcm:pw').toString('base64') + '@ss.example.com:65536#Reject', '端口');
const broken = ss + '\n' + sip002.replace('8388/','notaport/')+'#Failed';
let issues=[];
try {api.convertText(broken)}catch(err){issues=err.errors||[]}
assert.equal(issues.length,1);
assert.equal(issues[0].index,2);
assert.equal(issues[0].protocol,'ss');
assert.equal(JSON.stringify(issues).includes('pw'),false);


const fs = require('node:fs'), path = require('node:path'), vmSandbox = require('node:vm');
const script = fs.readFileSync(path.join(__dirname,'../Scripts/subscription-studio-v3.3.js'),'utf8');
const html = fs.readFileSync(path.join(__dirname,'../Web/subscription-studio-v3.3.html'),'utf8');
assert.doesNotThrow(()=>new vmSandbox.Script(script));
const client = html.slice(html.indexOf('<script>')+8,html.indexOf('</script>'));
assert.doesNotThrow(()=>new vmSandbox.Script(client));
for(const elid of ['refresh','view-overview','view-nodes','view-logs','copyLogs','clearLogs','sourceInput','saveSource','nodesList','logList'])
  assert.ok(html.includes('id="'+elid+'"'),'Missing element '+elid);
assert.ok(!html.includes('粘贴机场原订阅'));
const mem = Object.create(null);
mem['surge-subconverter-source-url-v1']='https://user:secret@provider.example/path/token?key=private';
const goodOutput = 'A = ss, ss.example, 8388, encrypt-method=aes-128-gcm, password=p';
function send(pathname,method='GET',upstream={status:200,body:goodOutput},headers={}){
 let response;
 vmSandbox.runInNewContext(script,{
  $request:{url:'http://surge-converter.test'+pathname,method,headers,body:upstream.requestBody},
  $persistentStore:{read:k=>mem[k],write:(v,k)=>{mem[k]=v;return true}},
  $httpClient:{get:(opts,cb)=>cb(null,{status:upstream.status},upstream.body)},
  $done:x=>{response=x},
  $notification:{post:()=>{}}
 },{timeout:2000});
 assert.ok(response&&response.response);
 return response.response;
}
let outputResponse=send('/api/convert','POST');
assert.equal(outputResponse.status,200);
let history=JSON.parse(send('/api/logs').body).entries;
assert.equal(history.length,1);
assert.equal(history[0].action,'refresh_ok');
assert.equal(history[0].total,1);
outputResponse=send('/subscription','GET',{status:503,body:'Error'});
assert.equal(outputResponse.status,200);
assert.equal(outputResponse.headers['X-Surge-Subscription-Stale'],'1');
history=JSON.parse(send('/api/logs').body).entries;
assert.equal(history[1].action,'refresh_error');
assert.equal(history[1].http_status,503);
assert.equal(history[2].action,'cache_used');
outputResponse=send('/api/convert','POST',{status:200,body:'ss://'+Buffer.from('aes-128-gcm:pw').toString('base64')+'@secret.example:invalid/#Bad'});
assert.equal(outputResponse.status,502);
history=JSON.parse(send('/api/logs').body).entries;
assert.equal(history[3].action,'refresh_error');
assert.equal(history[3].issues.length,1);
assert.equal(history[3].issues[0].protocol,'ss');
assert.ok(!JSON.stringify(history).match(/provider.example|secret.example|private|user:secret|\/path\/token/));
assert.equal(send('/api/logs','DELETE',{status:200,body:''},{Origin:'https://evil.test'}).status,403);
outputResponse=send('/api/logs','DELETE',{status:200,body:''},{Origin:'http://surge-converter.test'});
assert.equal(outputResponse.status,200);
assert.equal(JSON.parse(outputResponse.body).entries.length,0);
for(let i=0;i<86;i++)send('/api/source','POST',{requestBody:JSON.stringify({url:'https://provider.example/'+i})},{'Content-Type':'application/json'});
history=JSON.parse(send('/api/logs').body).entries;
assert.equal(history.length,80);
assert.ok(mem['surge-subconverter-logs-v1'].length<=26000);


const realityFP='vless://'+id+'@vless.example:443?security=reality&pbk=RmdmRmdmRmdmRmdmRmdmRmdmRmdmRmdmRmdmRmdmRmA&sni=example.org&fp=chrome&flow=xtls-rprx-vision#RealityChrome';
const tlsFP='vless://'+id+'@vless.example:443?security=tls&sni=example.org&fp=chrome#TLSChrome';
let compatibilityValue='6.0';
globalThis.$persistentStore={read:k=>k==='surge-subconverter-compat-v1'?compatibilityValue:''};
let finger=api.convertText(realityFP);
assert.equal(finger.total,1);
assert.ok(!finger.output.includes('client-fingerprint='));
assert.throws(()=>api.convertText(tlsFP),e=>String(e.message).includes('6.1+'));
compatibilityValue='6.1';
finger=api.convertText(realityFP);
assert.match(finger.output,/client-fingerprint=chromium-155/);
finger=api.convertText(tlsFP);
assert.match(finger.output,/client-fingerprint=chromium-155/);
finger=api.convertText(tlsFP.replace('fp=chrome','fp=safari'));
assert.match(finger.output,/client-fingerprint=apple-26/);
finger=api.convertText(tlsFP.replace('fp=chrome','fp=helloChrome_120'));
assert.match(finger.output,/client-fingerprint=chromium-155/);
assert.throws(()=>api.convertText(tlsFP.replace('fp=chrome','fp=noSuchFingerprint')),e=>e.errors&&e.errors.length===1);
assert.ok(html.includes('id="compatibility"'));
assert.ok(html.includes('/api/settings'));
let settingsResponse=send('/api/settings','GET');
assert.equal(JSON.parse(settingsResponse.body).compatibility,'6.0');
settingsResponse=send('/api/settings','POST',{requestBody:JSON.stringify({compatibility:'6.1'})},{Origin:'https://evil.test','Content-Type':'application/json'});
assert.equal(settingsResponse.status,403);
settingsResponse=send('/api/settings','POST',{requestBody:JSON.stringify({compatibility:'6.1'})},{Origin:'http://surge-converter.test','Content-Type':'application/json'});
assert.equal(settingsResponse.status,200);
assert.equal(JSON.parse(settingsResponse.body).compatibility,'6.1');
settingsResponse=send('/api/settings','POST',{requestBody:JSON.stringify({compatibility:'6.0'})},{Origin:'http://surge-converter.test','Content-Type':'application/json'});
assert.equal(settingsResponse.status,200);
settingsResponse=send('/api/settings','POST',{requestBody:JSON.stringify({compatibility:'7.0'})},{Origin:'http://surge-converter.test','Content-Type':'application/json'});
assert.equal(settingsResponse.status,400);
delete globalThis.$persistentStore;

console.log('Surge Subscription Studio v3.3: all tests passed');
