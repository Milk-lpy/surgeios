# surgeios

个人 Surge 配置与脚本。

## 目录

- `Surge全功能智能版.example.conf`：脱敏配置模板，复制后填入自己的订阅地址与 HomeLAN 凭据。
- `Scripts/network-retest.js`：网络变化 / Surge 引擎启动时重测交易专用 fallback 组。
- `Scripts/surge-status.js`：Surge Panel，显示当前网络、主要策略和不同策略的实际公网出口 IP / 国家 / ASN。

## 远程脚本地址

```text
https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Scripts/network-retest.js
https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Scripts/surge-status.js
```

配置中使用 `script-update-interval=3600`，Surge 会定期检查远程脚本更新。

## 安全说明

仓库为 Public。不要提交机场订阅 Token、HomeLAN 密码、证书私钥或其他敏感信息。仓库中的配置文件仅保留占位符。


## Surge 6 Subscription Studio（订阅转换模块）

安装模块：

```text
https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Modules/subscription-converter.sgmodule
```

启用模块后，在 Surge 的脚本列表中运行「打开 Subscription Studio」，或打开浏览器访问：

```text
http://surge-converter.test/
```

把你的原始订阅地址保存到本机，再选择「刷新订阅」。完成后在自己的主配置的 `[Proxy Group]` 中添加：

```ini
✈️ 我的节点 = select, policy-path=http://surge-converter.test/subscription, update-interval=1800
```

**v3.2 支持：** Shadowsocks (SS)、AnyTLS、VLESS（REALITY / Vision / WS / HTTPUpgrade / gRPC / XHTTP 基础参数）、Trojan、VMess（v2rayN Base64 JSON）、Hysteria 2、TUIC v4/v5，以及 Surge 原生 `[Proxy]` 节点列表。原始列表可以是明文或 Base64 包装。

**转换原则：** 如果检测到无法完整映射的节点或扩展参数，不自动生成残缺的新订阅；已有成功缓存可供回退。Clash YAML/JSON、SS 插件、VLESS XHTTP 高级 `extra` 配置以及部分特殊分享链接暂不支持。包含明确 `fp` 客户端指纹要求的 VLESS 链接在 Surge 6.0 兼容模式下拒绝静默丢参，6.1+ 用户可使用 Surge 原生分享链接导入。

**隐私：** 原始订阅 URL 只保存在 Surge 本机 Persistent Store，不要提交到 GitHub。管理页仅显示脱敏的订阅主机名，隐藏路径与查询参数。订阅请求仍会访问原始订阅服务商。若要彻底清除历史节点，注意管理页的「移除」只清理原 URL，转换缓存仍会保留。

**维护：** v3.1 脚本和页面保留供回退；主模块现引用 `Scripts/subscription-studio-v3.2.js` 和 `Web/subscription-studio-v3.2.html`。协议与异常转换回归测试位于 `tests/subscription-studio-v3.2.test.js`，可通过 `node tests/subscription-studio-v3.2.test.js` 执行。暂未在用户设备上的 Surge iOS 6 内完成端到端实测。


### v3.1 修复（2026-11-21）

- 接受 SIP002 合法的 `ss://...@host:port/` 可选尾部斜杠（含带查询参数的分享链接），同时继续拒绝真正的 `/path` 和无效端口。
- `AnyTLS` 和其他分享链接的 `host:port/` 同步兼容。
- 转换失败后保留已有成功缓存；新的转换诊断显示失败行号、协议与安全错误分类，不展示节点密码、分享链接或订阅 Token。
- 主模块改为 v3.1 独立脚本地址，使 Surge 更新模块后能绕过旧脚本 URL 缓存。无法保证所有机场订阅的非标准格式均兼容，需在 iPhone Surge 6 上执行实际刷新验证。

### v3.2 更新（2026-11-21）

- 重设计手机端管理界面：紧凑状态与节点统计、独立「概览 / 节点 / 日志」页面。删除首页大段协议介绍和冗余解释说明。
- 本机运行日志：手动刷新、`policy-path` 自动更新、网络/转换失败、使用缓存、原订阅保存与移除。
- 日志详情包括时间、执行方式、用时、节点数量、HTTP 状态码以及脱敏的失败行号/协议/错误类别；**不记录原订阅 URL、Token、代理服务器地址、节点密码**。
- 日志保存在本机 Surge Persistent Store 的 `surge-subconverter-logs-v1` 键中，最多 80 条，并限制序列化长度不超过 26,000 字符；页面支持筛选、复制 JSON 日志和清空日志。
- 更新独立 UI 缓存键，防止网页资源暂时不可用时展示旧版页面。已有原始订阅设置、节点输出缓存及转换状态键保持不变。
- 回归测试：`node tests/subscription-studio-v3.2.test.js`。已在模拟 Surge 脚本环境中验证相关接口，但**尚未在用户的 iPhone Surge 6 上完成端到端实测**。
