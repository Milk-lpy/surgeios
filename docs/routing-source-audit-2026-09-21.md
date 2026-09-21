# Surge Routing Source Audit — 2026-09-21

All GitHub-backed rule files referenced by the rebuilt routing layer were checked through the GitHub connector on 2026-09-21.

## Microsoft / AI sources

- Blackmatrix7 Microsoft: present (`1a2f1eb11b1ddbc318d18a7317e1a0ecc2c139f6`)
- Blackmatrix7 OneDrive: present (`4114bec0370bc1c135c9b0d12e66a4457f69e7ae`)
- Blackmatrix7 Teams: present (`3718b579b6a7bfcb0521d6d02bb8929c38667789`)
- Blackmatrix7 MicrosoftEdge: present (`cdc0d2688a85cbe3b0d157610b741402ceb04190`)
- Blackmatrix7 Bing: present (`73d9f040b1f517389d0a8cea1043b1034ad6c408`)
- Blackmatrix7 Copilot: present (`5ed01991645664e7b9a89b3d6cb4bb469b54839d`)
- SukkaW Microsoft: present (`27d173eb027b1b0211e92bbc4424a29482ff7b22`), verified to include Office 365, Outlook, Outlook Mobile, Microsoft Online, OneDrive and SharePoint domains.
- SukkaW AI: present (`36f43c3d2d21f0125a2cf7f5523bf4a4b03131c5`), verified to include OpenAI, Claude, Perplexity and Gemini coverage.
- SukkaW Apple Intelligence: present (`d3dd50038011c1f4cf8f20f41a535f009a8c89e0`)
- Blackmatrix7 OpenAI: present (`506c9ec94dad225df23c05a50294d2c440c94dd3`)
- Blackmatrix7 Claude: present (`222554c6e93219bf5c08da5f331d8ed6a78e3db3`)

## Google / Telegram / Apple / media

- Google: present (`844947a54e3b3f4afb9a71ba9879de9bbab8b9c3`)
- Google Voice: present (`f5c22a0202fb4fd621e5182b7e0c70ceca5c4e69`)
- Telegram: present (`d55a56961bca071058927de1ebb96a3a60ee4f98`)
- Apple: present (`3d9009b2b31e93e3112027318e2c2da07d365757`)
- YouTube: present (`8f5477e84e7fc9cc6b73cc0dc0e4b895c6fc823e`)
- Netflix: present (`5d27df5b41cfd59ddd2c3db7f34b4c56abcb2d57`)
- Disney: present (`a58d7d7f1ffbfc1816f39870d88b495227b72dd7`)
- Spotify: present (`39c31e12a50451457c4c7bc8b802de4f61dcff6b`)
- GlobalMedia: present (`f78819e0094a38737689389a31e94ed19597934e`)

## Game / trading / generic sources

- Nintendo: present (`1c9026b9253c958e2ce5e3ceb5b8cab2cecdf89f`)
- Steam: present (`0ee38679d48c0cb9b47e5f9df875328917018abf`)
- SteamCN: present (`3a702e406c7ecc908a1b33cf34352483ab39413e`)
- Xbox: present (`a77ed4cf9c59264eafd99531f91a8166cc93191c`)
- Sony: present (`9d1d97a56b6d92ce87225b5cbf6d299aaacbdc23`)
- Epic: present (`9f78779c7407577398a49b32d24d8e0bad408ae2`)
- Battle.net: present (`fd1f767aa7ca5484d407629d863c0fe8bf0a5dce`)
- Binance: present (`4f4fd2d50078fd02ba4214611f00d12755d54791`)
- ChinaMax: repository object present (`c398d9e1064ae63716192c77b534cea2e7ecb338`); connector could not stream the very large raw payload, so validation relies on repository existence plus Surge runtime retrieval.
- Proxy: present (`65c5ed80684c8e5a1670b9318e9a4b046ed8cf7d`)

## Representative ownership checks

- `outlook.com`, `outlookmobile.com`, `login.microsoftonline.com`, `onedrive.com`, `sharepoint.com` → `🪟 Microsoft`
- `chatgpt.com`, `claude.ai`, `gemini.google.com`, `perplexity.ai` → `🤖 AI 服务`
- `voice.google.com` → `🔎 Google`
- `telegram.org` → `✈️ Telegram`
- `icloud.com` → `🍎 Apple`
- `youtube.com`, `netflix.com`, `spotify.com` → `🎬 流媒体`
- `steampowered.com`, `nintendo.net`, `xboxlive.com`, `playstation.net`, `epicgames.com`, `battle.net` → `🎮 游戏平台`
- `binance.com` → `💰 币安交易`
- `okx.com` → `💱 欧易交易`

All application-specific rules appear before `.cn`, ChinaMax, GEOIP CN and the generic Proxy rule. SteamCN is placed before the international Steam rule and remains DIRECT.
