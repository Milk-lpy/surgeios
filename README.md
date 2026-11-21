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

\`\`\`text
https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Modules/subscription-converter.sgmodule
\`\`\`

启用模块后，在 Surge 的脚本列表中运行「打开 Subscription Studio」，或打开浏览器访问：

\`\`\`text
http://surge-converter.test/
\`\`\`

把你的原始订阅地址保存到本机，再选择「刷新订阅」。完成后在自己的主配置的 \`[Proxy Group]\` 中添加：

\`\`\`ini
✈️ 我的节点 = select, policy-path=http://surge-converter.test/subscription, update-interval=1800
\`\`\`

**v3 支持：** Shadowsocks (SS)、AnyTLS、VLESS（REALITY / Vision / WS / HTTPUpgrade / gRPC / XHTTP 基础参数）、Trojan、VMess（v2rayN Base64 JSON）、Hysteria 2、TUIC v4/v5，以及 Surge 原生 \`[Proxy]\` 节点列表。原始列表可以是明文或 Base64 包装。

**转换原则：** 如果检测到无法完整映射的节点或扩展参数，不自动生成残缺的新订阅；已有成功缓存可供回退。Clash YAML/JSON、SS 插件、VLESS XHTTP 高级 \`extra\` 配置以及部分特殊分享链接暂不支持。包含明确 \`fp\` 客户端指纹要求的 VLESS 链接在 Surge 6.0 兼容模式下拒绝静默丢参，6.1+ 用户可使用 Surge 原生分享链接导入。

**隐私：** 原始订阅 URL 只保存在 Surge 本机 Persistent Store，不要提交到 GitHub。管理页仅显示脱敏的订阅主机名，隐藏路径与查询参数。订阅请求仍会访问原始订阅服务商。若要彻底清除历史节点，注意管理页的「清除」目前只清理原 URL，转换缓存仍会保留。

**维护：** v2 引用脚本保留供回退；主模块现引用 \`Scripts/subscription-studio-v3.js\` 和 \`Web/subscription-studio-v3.html\`。协议与异常转换回归测试位于 \`tests/subscription-studio-v3.test.js\`，可通过 \`node tests/subscription-studio-v3.test.js\` 执行。暂未在用户设备上的 Surge iOS 6 内完成端到端实测。

