# Surge 分流架构重整设计

日期：2026-09-21  
仓库：`Milk-lpy/surgeios`

## 1. 目标

本次重整的目标是：

- 提高应用级分流覆盖率，重点修复 Microsoft / Outlook 类流量漏分流问题。
- 所有可见“应用类策略组”都提供完整地区选择：香港、台湾、日本、新加坡、美国。
- 保留家庭网络 `wait / sky` 的上级网关接管逻辑，避免双重代理。
- 保留 `sky6_5G`、其他 Wi-Fi、蜂窝网络由 Surge 自己接管。
- 保留 Binance 默认台湾、OKX 默认新加坡的既有交易出口策略。
- 保留 B 节点优先和启动稳定性优化，不恢复启动时对完整节点池批量测速。
- 把第三方规则源与自维护补漏规则解耦，后续出现漏项时只需更新 GitHub `Rules/*.list`，无需重做整份 Surge 配置。
- 不把 MITM CA、机场订阅、HomeLAN 密码等敏感信息上传到公开 GitHub。

## 2. 可见策略组

最终可见策略组按以下顺序排列：

1. 节点选择
2. 💱 欧易交易
3. 💰 币安交易
4. 🤖 AI 服务
5. 🔎 Google
6. 🪟 Microsoft
7. ✈️ Telegram
8. 🍎 Apple
9. 🎬 流媒体
10. 🎮 游戏平台
11. 家里LAN
12. 🇭🇰 香港节点
13. 🇹🇼 台湾节点
14. 🇯🇵 日本节点
15. 🇸🇬 新加坡节点
16. 🇺🇸 美国节点

所有应用类策略组都统一提供：

- 应用默认策略
- 节点选择
- 🇭🇰 香港节点
- 🇹🇼 台湾节点
- 🇯🇵 日本节点
- 🇸🇬 新加坡节点
- 🇺🇸 美国节点
- DIRECT

手动选择具体地区时，应覆盖应用默认策略和家庭网络自动 DIRECT 行为。

## 3. 应用默认行为

| 应用 | wait / sky | 其他 Wi-Fi / 蜂窝 / sky6_5G |
|---|---|---|
| 欧易 | DIRECT | 新加坡交易稳定 |
| 币安 | DIRECT | 台湾交易稳定 |
| AI | DIRECT | 美国稳定 |
| Google | DIRECT | 通用网络 |
| Microsoft | DIRECT | DIRECT |
| Telegram | DIRECT | 通用网络 |
| Apple | DIRECT | DIRECT |
| 流媒体 | DIRECT | 通用网络 |
| 游戏平台 | DIRECT | 通用网络 |

应用默认行为使用隐藏的 `subnet` 策略组实现。

## 4. 地区与自动节点逻辑

### 4.1 地区组

五个地区组从完整机场节点池动态筛选：

- 🇭🇰 香港节点
- 🇹🇼 台湾节点
- 🇯🇵 日本节点
- 🇸🇬 新加坡节点
- 🇺🇸 美国节点

地区组以该地区节点的可用性与延迟为主要选择依据。

### 4.2 自动选择

`自动选择` 继续使用 Smart：

- B0 / B1 / B2 等 B 系节点保持最高优先级。
- B 节点不可用或质量明显劣化后，才回退到常用低倍率优化线路。
- 不恢复启动时对全部 100+ 节点主动批量测速。
- 完整节点池仍可在 `节点选择` 中手动使用。

### 4.3 交易稳定池

继续保留隐藏的：

- 台湾交易稳定
- 新加坡交易稳定
- 美国稳定

这些池只纳入小范围高质量候选，避免过度测速。

## 5. 规则源架构

规则按四层组织：

1. 关键显式域名
2. Blackmatrix7 主规则
3. SukkaW / 其他高质量 GitHub 规则补充
4. `Milk-lpy/surgeios` 自维护 Extra 规则

自维护规则目录：

```text
Rules/
├── Microsoft-Extra.list
├── Google-Extra.list
├── AI-Extra.list
├── Telegram-Extra.list
├── Apple-Extra.list
├── Media-Extra.list
├── Games-Extra.list
├── Binance-Extra.list
└── OKX-Extra.list
```

原则：

- Extra 文件只维护第三方规则漏项、冲突修正或用户实际抓包发现的新增域名。
- 不复制第三方完整规则库，避免形成长期过期的重复规则集。
- 主配置永久引用这些 Extra 文件。
- Extra 文件和第三方规则存在同目标重复时允许；如果同一域名指向不同策略，则必须在交付前消除冲突。

## 6. 应用规则归属

### 6.1 Microsoft

只保留一个可见总策略组：`🪟 Microsoft`。

以下业务统一归入 Microsoft：

- Outlook / Outlook Mobile
- Exchange Online
- Microsoft 365 / Office 365
- Office
- OneDrive
- SharePoint
- Teams
- Skype
- Microsoft Account / 登录认证
- Edge 服务
- Bing
- Microsoft Copilot
- Xbox / Microsoft 公共基础设施中明确属于 Microsoft 的部分

规则来源：

- Blackmatrix7 Microsoft
- Blackmatrix7 OneDrive
- Blackmatrix7 Teams
- Blackmatrix7 MicrosoftEdge
- Blackmatrix7 Bing
- Blackmatrix7 Copilot
- SukkaW microsoft.conf
- `Rules/Microsoft-Extra.list`

关键 Outlook / M365 / 登录认证域名应在泛国内规则之前显式兜底。

### 6.2 AI

归入 `🤖 AI 服务`：

- OpenAI / ChatGPT
- Claude
- Google Gemini
- Perplexity
- Apple Intelligence
- 其他明确 AI 产品域名

规则来源：

- SukkaW ai.conf
- Blackmatrix7 OpenAI
- Blackmatrix7 Claude
- 现有 Apple Intelligence 规则
- `Rules/AI-Extra.list`

AI 专项规则必须位于普通 Google / Apple 规则之前。

### 6.3 Google

归入 `🔎 Google`：

- Google 常规业务
- Google Voice
- Google 基础服务中不属于 AI 专项的部分

Gemini 不归 Google，归 AI。

### 6.4 Telegram

归入 `✈️ Telegram`：

- Telegram 域名
- Telegram IP / CIDR

使用 Blackmatrix7 Telegram 规则并通过 Extra 处理实际漏项。

### 6.5 Apple

归入 `🍎 Apple`：

- iCloud
- App Store / Apple 服务
- 普通 Apple 网络服务

Apple Intelligence 不归 Apple，归 AI。

### 6.6 流媒体

归入 `🎬 流媒体`：

- YouTube
- Netflix
- Disney+
- Spotify
- GlobalMedia
- 后续必要时补充 TikTok、Prime Video 等

### 6.7 游戏平台

归入 `🎮 游戏平台`：

- Nintendo
- Steam
- Xbox
- PlayStation / Sony
- Epic
- Battle.net
- 其他明确游戏平台服务

`SteamCN` 保持 DIRECT，不并入海外游戏平台。

### 6.8 Binance / OKX

Binance 和 OKX 继续使用独立策略组和独立默认出口：

- Binance → 台湾交易稳定
- OKX → 新加坡交易稳定

不把整个 Cryptocurrency / Crypto 总表直接绑定到 Binance 或 OKX，以免把其他交易所误分到错误策略。

## 7. 最终规则优先级

主配置 `[Rule]` 按以下顺序：

1. 局域网 / 私网
2. OKX / Binance 精确交易规则
3. AI 专项规则
4. Microsoft / Google / Telegram / Apple 应用专项规则
5. 流媒体 / 游戏平台
6. 国内明确服务（WeChat、BiliBili、ChinaMedia、SteamCN 等）
7. `.cn`
8. ChinaMax
9. GEOIP,CN
10. 泛海外 Proxy
11. FINAL

设计重点：

- Microsoft、AI、Google、Binance、OKX 必须在 ChinaMax 前。
- Outlook / M365 等不能先落入国内库或泛代理。
- Gemini 必须先命中 AI，不能先命中普通 Google。
- Apple Intelligence 必须先命中 AI，不能先命中 Apple DIRECT。
- SteamCN 必须在 Steam 海外规则前保持 DIRECT。

## 8. 家庭网络行为

只对以下 SSID 启用家庭网关接管：

- `wait`
- `sky`

这些网络下，各应用“默认策略”返回 DIRECT，由上级网关继续分流。

`sky6_5G` 不属于家庭直连特判，按外部网络处理。

如果用户手动把某个应用策略切到地区组，例如：

```text
🪟 Microsoft → 🇺🇸 美国节点
```

即使在 `wait` 上也应强制使用美国节点，不再服从应用默认 DIRECT。

## 9. 完整性校验

交付前需要执行以下静态和行为校验：

### 9.1 结构检查

- 所有 RULE-SET URL 可访问。
- 所有规则引用的策略组存在。
- 所有应用类策略组都包含香港、台湾、日本、新加坡、美国五地区。
- 不存在已删除的 Google Voice 独立策略引用。
- 关键应用规则全部位于 ChinaMax / GEOIP CN 前。
- SteamCN 等国内特殊规则保持 DIRECT。
- FINAL 指向预期通用策略。
- 无明显相互冲突的关键显式域名。

### 9.2 代表业务命中测试

至少覆盖：

- Outlook / Microsoft 365 / OneDrive / Teams
- OpenAI / Claude / Gemini / Perplexity
- Google Voice
- Telegram 域名与 IP
- iCloud / Apple 服务
- YouTube / Netflix / Disney+ / Spotify
- Steam / Nintendo / Xbox / PlayStation / Epic / Battle.net
- Binance
- OKX

测试目标是验证每个代表域名命中预期的可见应用策略。

### 9.3 家庭 / 外部网络矩阵

至少验证：

- `wait`
- `sky`
- `sky6_5G`
- 蜂窝网络
- 普通第三方 Wi-Fi

并验证“默认策略”和“手动地区覆盖”两种状态。

## 10. 安全与隐私

以下内容禁止提交到公开 GitHub：

- MITM `ca-p12`
- MITM `ca-passphrase`
- 机场订阅地址及 token
- HomeLAN 用户名 / 密码
- 其他私人网络凭证

公开仓库中只保存：

- 脱敏后的规则文件
- 脱敏设计文档
- 不含凭据的脚本
- 不含私密订阅的模板配置

本地最终配置可以保留这些敏感字段，但不得以明文提交到公开仓库。

## 11. 交付物

实施完成后应产出：

- 新版 Surge 主配置
- `Rules/*.list` 九个自维护规则文件
- 更新后的必要状态脚本（仅在需要适配新策略名时修改）
- 静态校验结果
- 代表域名命中测试结果
- SHA-256 校验值

