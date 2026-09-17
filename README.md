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
