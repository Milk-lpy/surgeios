'use strict';

const assert = require('assert');
const api = require('../Scripts/subscription-studio-v2.js');

function expectThrow(fn, needle) {
  assert.throws(fn, (err) => String(err && err.message || err).includes(needle));
}

const creds = Buffer.from('aes-128-gcm:pass').toString('base64').replace(/=+$/, '');
const uri = `ss://${creds}@example.com:8388#Test`;

let r = api.convertText(uri);
assert.strictEqual(r.total, 1);
assert.strictEqual(r.ss, 1);
assert.ok(r.output.includes('Test = ss'));

r = api.convertText(Buffer.from(uri).toString('base64'));
assert.strictEqual(r.total, 1);
assert.strictEqual(r.ss, 1);

const native = [
  '[Proxy]',
  'Native = ss, example.com, 8388, encrypt-method=aes-128-gcm, password=pass',
  'AT = anytls, tls.example.com, 443, password=pw, sni=tls.example.com',
  '[Proxy Group]',
  'X = select, Native'
].join('\n');

r = api.convertText(native);
assert.strictEqual(r.total, 2);
assert.strictEqual(r.ss, 1);
assert.strictEqual(r.anytls, 1);
assert.ok(r.output.includes('Native = ss'));
assert.ok(r.output.includes('AT = anytls'));

const nativeB64 = Buffer.from(native).toString('base64');
r = api.convertText(nativeB64);
assert.strictEqual(r.total, 2);

r = api.convertText('\uFEFF' + uri);
assert.strictEqual(r.total, 1);

const duplicateNative = [
  'Same = ss, a.example.com, 8388, encrypt-method=aes-128-gcm, password=a',
  'Same = ss, b.example.com, 8388, encrypt-method=aes-128-gcm, password=b'
].join('\n');
r = api.convertText(duplicateNative);
assert.ok(r.output.includes('Same = ss'));
assert.ok(r.output.includes('Same #2 = ss'));

assert.strictEqual(api.detectSubscriptionKind('<!doctype html><html></html>'), 'html');
assert.strictEqual(api.detectSubscriptionKind('{"error":"bad"}'), 'json');
assert.strictEqual(api.detectSubscriptionKind('proxies:\n  - name: x'), 'yaml');
assert.strictEqual(api.detectSubscriptionKind(native), 'surge');
assert.strictEqual(api.detectSubscriptionKind(uri), 'uri');

expectThrow(() => api.convertText('<html>login</html>'), 'HTML');
expectThrow(() => api.convertText('{"error":"bad"}'), 'JSON');
expectThrow(() => api.convertText('proxies:\n - name: x'), 'YAML/Clash');
expectThrow(() => api.convertText('not-a-subscription'), '无法识别订阅格式');

const longJson = '{"error":"bad","message":"this is long enough for base64 detection"}';
expectThrow(() => api.convertText(Buffer.from(longJson).toString('base64')), 'Base64 解码后得到 JSON');

console.log('subscription-studio-v2: all tests passed');
