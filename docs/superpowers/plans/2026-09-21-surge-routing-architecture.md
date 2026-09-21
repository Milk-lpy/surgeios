# Surge Routing Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Surge routing configuration so Microsoft/Outlook and all other application groups are comprehensively routed, every application group can manually select Hong Kong/Taiwan/Japan/Singapore/US, and future rule gaps can be patched through `Milk-lpy/surgeios/Rules/*.list` without exposing private credentials.

**Architecture:** Keep the existing stable V2 runtime model (small Smart pool, hidden per-app default `subnet` groups, `wait/sky` upstream-gateway handoff, no startup-wide retest) and replace the application-routing layer with explicit visible application groups plus four-layer rule coverage: explicit critical rules, Blackmatrix7, SukkaW/other maintained sources, and repository-owned Extra lists. Public GitHub stores only desensitized config/rules/tests; the private final config is produced locally by copying only the validated `[Proxy Group]` and `[Rule]` sections into the user's existing MITM-bearing config.

**Tech Stack:** Surge 5.22 configuration syntax, Surge RULE-SET lists, JavaScript status script, Python 3 standard library (`unittest`, `configparser`-style custom parsing only; no third-party packages), GitHub raw rules.

**Spec:** `docs/superpowers/specs/2026-09-21-surge-routing-architecture-design.md`

## Global Constraints

- Only SSIDs `wait` and `sky` use upstream-gateway handoff; `sky6_5G`, cellular, CPE, and other Wi-Fi are handled by Surge.
- Binance default external exit remains Taiwan stable; OKX default external exit remains Singapore stable.
- AI default external exit is US stable; Microsoft and Apple default external behavior remains DIRECT.
- Every visible application group must expose: its app default, `节点选择`, Hong Kong, Taiwan, Japan, Singapore, US, and DIRECT.
- `自动选择` keeps strong B-node priority and a bounded candidate pool; do not restore startup-wide testing of the full 100+ node subscription.
- Microsoft, AI, Google, Binance, and OKX rules must appear before `.cn`, ChinaMax, and GEOIP CN.
- Gemini belongs to AI, Google Voice belongs to Google, Apple Intelligence belongs to AI, Microsoft Copilot/Bing belong to Microsoft, SteamCN remains DIRECT.
- Never commit MITM `ca-p12`, `ca-passphrase`, airport subscription URLs/tokens, HomeLAN usernames/passwords, or other private network credentials.
- Public Extra rules are patch layers only; do not mirror entire third-party rule repositories.
- The private final config is generated locally and delivered as an artifact; it is never committed to public GitHub.

## Review Focus

- A Microsoft domain also present in a China-oriented ruleset (for example a Microsoft `.cn` endpoint): application rules must win before `.cn`/ChinaMax.
- A nested AI domain under Google (for example `gemini.google.com`): AI must win before the general Google group.
- A user manually selects a region while connected to `wait` or `sky`: the explicit region must override the app-default DIRECT behavior.
- A third-party rule URL fails or changes format: the repository-owned Extra layer must still cover critical Outlook/Exchange, Binance, and OKX endpoints without routing unrelated services to those groups.
- A private config contains secrets in unrelated sections: section replacement must preserve those values locally while secret scanning prevents them from entering committed public files.

---

## File Structure

### Create

- `Rules/Microsoft-Extra.list` — critical Outlook/M365/authentication/OneDrive/Teams patch rules.
- `Rules/Google-Extra.list` — Google/Google Voice patch rules not owned by AI.
- `Rules/AI-Extra.list` — OpenAI/Claude/Gemini/Perplexity critical patch rules.
- `Rules/Telegram-Extra.list` — Telegram critical domain patch rules.
- `Rules/Apple-Extra.list` — Apple/iCloud critical patch rules, excluding Apple Intelligence.
- `Rules/Media-Extra.list` — critical streaming/media domain patch rules.
- `Rules/Games-Extra.list` — critical international game platform patch rules; no SteamCN domains.
- `Rules/Binance-Extra.list` — Binance-only patch rules.
- `Rules/OKX-Extra.list` — OKX-only patch rules.
- `tools/surge_routing.py` — pure parser/validator/section-replacement library.
- `tools/validate_surge_routing.py` — command-line validator for public/private configs.
- `tests/test_surge_routing.py` — unit tests for parsing, group invariants, order, secrets, and private-section replacement.
- `tests/fixtures/minimal-private.conf` — fake-secret fixture proving private preservation without real credentials.
- `tests/fixtures/invalid-routing.conf` — intentionally invalid fixture proving tests fail when a group lacks a region or rules are misordered.

### Modify

- `Surge全功能智能版.example.conf` — desensitized canonical routing template with the new visible application groups, hidden default groups, rule source ordering, and stable V2 behavior.
- `Scripts/surge-status.js` — modify only if validation finds a reference to a removed/renamed application group; otherwise leave byte-for-byte unchanged.
- Private conversation artifact `Surge全功能智能版-稳定性优先V2-去GV版-MITM.conf` — local-only section replacement for final delivery.

---

### Task 1: Build the routing parser and failing architecture tests

**Files:**
- Create: `tools/surge_routing.py`
- Create: `tools/validate_surge_routing.py`
- Create: `tests/__init__.py`
- Create: `tests/test_surge_routing.py`
- Create: `tests/fixtures/minimal-private.conf`
- Create: `tests/fixtures/invalid-routing.conf`

**Interfaces:**
- Produces: `parse_sections(text: str) -> dict[str, list[str]]`
- Produces: `parse_policy_groups(text: str) -> dict[str, str]`
- Produces: `parse_rule_lines(text: str) -> list[str]`
- Produces: `validate_app_groups(text: str) -> list[str]`
- Produces: `validate_rule_order(text: str) -> list[str]`
- Produces: `validate_no_public_secrets(text: str) -> list[str]`
- Produces: `replace_sections(base_text: str, template_text: str, section_names: tuple[str, ...]) -> str`

- [ ] **Step 1: Write the failing unit tests**

Create an empty `tests/__init__.py`, then create `tests/test_surge_routing.py` with these exact invariants:

```python
import pathlib
import unittest

from tools.surge_routing import (
    parse_policy_groups,
    replace_sections,
    validate_app_groups,
    validate_no_public_secrets,
    validate_rule_order,
)

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / "Surge全功能智能版.example.conf"
INVALID = ROOT / "tests/fixtures/invalid-routing.conf"
PRIVATE = ROOT / "tests/fixtures/minimal-private.conf"

APP_GROUPS = [
    "💱 欧易交易",
    "💰 币安交易",
    "🤖 AI 服务",
    "🔎 Google",
    "🪟 Microsoft",
    "✈️ Telegram",
    "🍎 Apple",
    "🎬 流媒体",
    "🎮 游戏平台",
]

REGIONS = [
    "🇭🇰 香港节点",
    "🇹🇼 台湾节点",
    "🇯🇵 日本节点",
    "🇸🇬 新加坡节点",
    "🇺🇸 美国节点",
]

class SurgeRoutingTests(unittest.TestCase):
    def test_all_application_groups_offer_every_region_and_direct(self):
        text = EXAMPLE.read_text(encoding="utf-8")
        groups = parse_policy_groups(text)
        for name in APP_GROUPS:
            self.assertIn(name, groups)
            line = groups[name]
            self.assertIn("节点选择", line)
            self.assertIn("DIRECT", line)
            for region in REGIONS:
                self.assertIn(region, line)

    def test_application_rules_precede_china_protection(self):
        text = EXAMPLE.read_text(encoding="utf-8")
        self.assertEqual(validate_rule_order(text), [])

    def test_public_example_contains_no_private_credentials(self):
        text = EXAMPLE.read_text(encoding="utf-8")
        self.assertEqual(validate_no_public_secrets(text), [])

    def test_invalid_fixture_is_rejected(self):
        text = INVALID.read_text(encoding="utf-8")
        self.assertTrue(validate_app_groups(text))
        self.assertTrue(validate_rule_order(text))

    def test_private_section_replacement_preserves_secret_sections(self):
        private = PRIVATE.read_text(encoding="utf-8")
        template = EXAMPLE.read_text(encoding="utf-8")
        result = replace_sections(private, template, ("Proxy Group", "Rule"))
        self.assertIn("ca-passphrase = PRIVATE_TEST_ONLY", result)
        self.assertIn("password=PRIVATE_TEST_ONLY", result)
        self.assertIn("[Proxy Group]", result)
        self.assertIn("🪟 Microsoft", result)
        self.assertIn("[Rule]", result)
        self.assertIn("Rules/Microsoft-Extra.list", result)

if __name__ == "__main__":
    unittest.main()
```

Create `tests/fixtures/minimal-private.conf`:

```ini
[General]
ipv6 = true

[Proxy]
HomeLAN-DDNS = socks5, example.invalid, 10888, username=PRIVATE_TEST_ONLY, password=PRIVATE_TEST_ONLY

[Proxy Group]
OldGroup = select, DIRECT

[Rule]
FINAL,DIRECT

[MITM]
ca-passphrase = PRIVATE_TEST_ONLY
ca-p12 = PRIVATE_TEST_ONLY
```

Create `tests/fixtures/invalid-routing.conf`:

```ini
[Proxy Group]
💱 欧易交易 = select, DIRECT
💰 币安交易 = select, DIRECT
🤖 AI 服务 = select, DIRECT
🔎 Google = select, DIRECT
🪟 Microsoft = select, DIRECT
✈️ Telegram = select, DIRECT
🍎 Apple = select, DIRECT
🎬 流媒体 = select, DIRECT
🎮 游戏平台 = select, DIRECT

[Rule]
DOMAIN-SUFFIX,cn,DIRECT
DOMAIN-SUFFIX,outlook.com,🪟 Microsoft
FINAL,DIRECT
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
python3 -m unittest tests.test_surge_routing -v
```

Expected: FAIL because `tools.surge_routing` does not exist yet and the current example config does not expose the required new application groups.

- [ ] **Step 3: Implement the minimal parser/validator library**

Create `tools/surge_routing.py` with section-aware parsing. The validator must:

```python
APP_GROUPS = {
    "💱 欧易交易": "欧易默认",
    "💰 币安交易": "币安默认",
    "🤖 AI 服务": "AI默认",
    "🔎 Google": "Google默认",
    "🪟 Microsoft": "Microsoft默认",
    "✈️ Telegram": "Telegram默认",
    "🍎 Apple": "Apple默认",
    "🎬 流媒体": "流媒体默认",
    "🎮 游戏平台": "游戏平台默认",
}

REGION_GROUPS = [
    "🇭🇰 香港节点",
    "🇹🇼 台湾节点",
    "🇯🇵 日本节点",
    "🇸🇬 新加坡节点",
    "🇺🇸 美国节点",
]

APP_RULE_MARKERS = [
    "Rules/OKX-Extra.list",
    "Rules/Binance-Extra.list",
    "Rules/AI-Extra.list",
    "Rules/Microsoft-Extra.list",
    "Rules/Google-Extra.list",
    "Rules/Telegram-Extra.list",
    "Rules/Apple-Extra.list",
    "Rules/Media-Extra.list",
    "Rules/Games-Extra.list",
]

CHINA_MARKERS = [
    "DOMAIN-SUFFIX,cn,DIRECT",
    "/ChinaMax/ChinaMax_All.list",
    "GEOIP,CN,DIRECT",
]
```

`validate_app_groups()` returns an error for a missing app group, missing default group, missing `节点选择`, missing region, or missing `DIRECT`.

`validate_rule_order()` finds the first line index of every present app marker and requires it to be lower than every present China marker. It must also require `SteamCN` before the general `Steam/Steam.list` rule.

`validate_no_public_secrets()` rejects:
- literal `ca-p12 =`
- literal `ca-passphrase =`
- `password=` unless the value contains `YOUR_`
- subscription URLs containing obvious token/query credentials
- known real host/user/password strings must never be hard-coded in this validator; use structural checks only.

`replace_sections()` replaces complete named sections while preserving all unselected sections exactly.

- [ ] **Step 4: Implement the CLI wrapper**

Create `tools/validate_surge_routing.py`:

```python
#!/usr/bin/env python3
import argparse
import pathlib
import sys

from surge_routing import (
    validate_app_groups,
    validate_no_public_secrets,
    validate_rule_order,
)

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("config")
    parser.add_argument("--allow-private", action="store_true")
    args = parser.parse_args()

    text = pathlib.Path(args.config).read_text(encoding="utf-8")
    errors = []
    errors.extend(validate_app_groups(text))
    errors.extend(validate_rule_order(text))
    if not args.allow_private:
        errors.extend(validate_no_public_secrets(text))

    for error in errors:
        print(f"ERROR: {error}")
    if errors:
        return 1
    print("OK: Surge routing validation passed")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Run the focused tests**

Run:

```bash
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_invalid_fixture_is_rejected -v
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_private_section_replacement_preserves_secret_sections -v
```

Expected: PASS for the invalid-fixture rejection and section-preservation behavior; architecture tests against the current example may still fail until later tasks.

- [ ] **Step 6: Commit**

```bash
git add tools/surge_routing.py tools/validate_surge_routing.py tests/__init__.py tests/test_surge_routing.py tests/fixtures/
git commit -m "test: add Surge routing architecture validator"
```

---

### Task 2: Add repository-owned Extra rule layers

**Files:**
- Create: `Rules/Microsoft-Extra.list`
- Create: `Rules/Google-Extra.list`
- Create: `Rules/AI-Extra.list`
- Create: `Rules/Telegram-Extra.list`
- Create: `Rules/Apple-Extra.list`
- Create: `Rules/Media-Extra.list`
- Create: `Rules/Games-Extra.list`
- Create: `Rules/Binance-Extra.list`
- Create: `Rules/OKX-Extra.list`
- Modify: `tests/test_surge_routing.py`

**Interfaces:**
- Produces public Surge-compatible rule lists referenced through `raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/Microsoft-Extra.list` and the eight sibling Extra-list URLs.
- Lists contain rules only, never target policy names or credentials.

- [ ] **Step 1: Add failing tests for critical Extra coverage**

Append tests that read the nine files and require these critical entries:

```python
def test_extra_rule_files_cover_critical_domains(self):
    required = {
        "Microsoft-Extra.list": [
            "DOMAIN-SUFFIX,outlook.com",
            "DOMAIN-SUFFIX,outlookmobile.com",
            "DOMAIN-SUFFIX,office365.com",
            "DOMAIN-SUFFIX,microsoftonline.com",
            "DOMAIN-SUFFIX,onedrive.com",
            "DOMAIN-SUFFIX,sharepoint.com",
        ],
        "Google-Extra.list": [
            "DOMAIN-SUFFIX,google.com",
            "DOMAIN-SUFFIX,googleapis.com",
            "DOMAIN-SUFFIX,googlevoice.com",
        ],
        "AI-Extra.list": [
            "DOMAIN-SUFFIX,openai.com",
            "DOMAIN-SUFFIX,chatgpt.com",
            "DOMAIN-SUFFIX,anthropic.com",
            "DOMAIN-SUFFIX,claude.ai",
            "DOMAIN-SUFFIX,perplexity.ai",
            "DOMAIN-SUFFIX,gemini.google.com",
        ],
        "Telegram-Extra.list": [
            "DOMAIN-SUFFIX,telegram.org",
            "DOMAIN-SUFFIX,t.me",
            "DOMAIN-SUFFIX,telegra.ph",
        ],
        "Apple-Extra.list": [
            "DOMAIN-SUFFIX,apple.com",
            "DOMAIN-SUFFIX,icloud.com",
            "DOMAIN-SUFFIX,icloud-content.com",
        ],
        "Media-Extra.list": [
            "DOMAIN-SUFFIX,youtube.com",
            "DOMAIN-SUFFIX,googlevideo.com",
            "DOMAIN-SUFFIX,netflix.com",
            "DOMAIN-SUFFIX,nflxvideo.net",
            "DOMAIN-SUFFIX,disneyplus.com",
            "DOMAIN-SUFFIX,spotify.com",
        ],
        "Games-Extra.list": [
            "DOMAIN-SUFFIX,steampowered.com",
            "DOMAIN-SUFFIX,steamcommunity.com",
            "DOMAIN-SUFFIX,nintendo.net",
            "DOMAIN-SUFFIX,xboxlive.com",
            "DOMAIN-SUFFIX,playstation.net",
            "DOMAIN-SUFFIX,epicgames.com",
            "DOMAIN-SUFFIX,battle.net",
        ],
        "Binance-Extra.list": [
            "DOMAIN-SUFFIX,binance.com",
            "DOMAIN-SUFFIX,binance.info",
            "DOMAIN-SUFFIX,binance.click",
        ],
        "OKX-Extra.list": [
            "DOMAIN-SUFFIX,okx.com",
            "DOMAIN-SUFFIX,okex.com",
            "DOMAIN-SUFFIX,oklink.com",
            "DOMAIN-SUFFIX,okx-dns.com",
        ],
    }
    for filename, rules in required.items():
        text = (ROOT / "Rules" / filename).read_text(encoding="utf-8")
        for rule in rules:
            self.assertIn(rule, text)
        self.assertNotIn("PRIVATE_TEST_ONLY", text)
        self.assertNotIn("ca-p12", text)
```

Also add:

```python
def test_games_extra_does_not_capture_steam_cn(self):
    text = (ROOT / "Rules/Games-Extra.list").read_text(encoding="utf-8")
    self.assertNotIn("steamchina", text.lower())
    self.assertNotIn("steamserver.net", text.lower())
```

- [ ] **Step 2: Run the new tests and verify failure**

Run:

```bash
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_extra_rule_files_cover_critical_domains -v
```

Expected: FAIL because `Rules/` files do not exist.

- [ ] **Step 3: Create the nine Extra files**

Use these initial contents; comments explain ownership, while the rules deliberately duplicate a small set of critical domains so routing remains deterministic when a third-party list lags.

`Rules/Microsoft-Extra.list`:

```text
# Microsoft critical patch layer: Outlook / M365 / auth / OneDrive / SharePoint / Teams
DOMAIN-SUFFIX,outlook.com
DOMAIN-SUFFIX,outlookmobile.com
DOMAIN-SUFFIX,hotmail.com
DOMAIN-SUFFIX,office.com
DOMAIN-SUFFIX,office.net
DOMAIN-SUFFIX,office365.com
DOMAIN-SUFFIX,microsoftonline.com
DOMAIN-SUFFIX,msauth.net
DOMAIN-SUFFIX,msftauth.net
DOMAIN-SUFFIX,msftidentity.com
DOMAIN-SUFFIX,live.com
DOMAIN-SUFFIX,live.net
DOMAIN-SUFFIX,onedrive.com
DOMAIN-SUFFIX,1drv.com
DOMAIN-SUFFIX,sharepoint.com
DOMAIN-SUFFIX,sharepointonline.com
DOMAIN-SUFFIX,skype.com
DOMAIN-SUFFIX,teams.microsoft.com
```

`Rules/Google-Extra.list`:

```text
# General Google / Google Voice patch layer. AI endpoints belong in AI-Extra.
DOMAIN-SUFFIX,google.com
DOMAIN-SUFFIX,googleapis.com
DOMAIN-SUFFIX,gstatic.com
DOMAIN-SUFFIX,googleusercontent.com
DOMAIN-SUFFIX,googlevoice.com
DOMAIN,voice.google.com
```

`Rules/AI-Extra.list`:

```text
# AI critical patch layer
DOMAIN-SUFFIX,openai.com
DOMAIN-SUFFIX,chatgpt.com
DOMAIN-SUFFIX,oaistatic.com
DOMAIN-SUFFIX,sora.com
DOMAIN-SUFFIX,anthropic.com
DOMAIN-SUFFIX,claude.ai
DOMAIN-SUFFIX,claude.com
DOMAIN-SUFFIX,perplexity.ai
DOMAIN-SUFFIX,gemini.google
DOMAIN-SUFFIX,gemini.google.com
DOMAIN-SUFFIX,generativeai.google
DOMAIN-SUFFIX,generativelanguage.googleapis.com
DOMAIN,aistudio.google.com
```

`Rules/Telegram-Extra.list`:

```text
# Telegram critical domain patch layer
DOMAIN-SUFFIX,telegram.org
DOMAIN-SUFFIX,telegram.me
DOMAIN-SUFFIX,t.me
DOMAIN-SUFFIX,telegra.ph
DOMAIN-SUFFIX,telegram-cdn.org
```

`Rules/Apple-Extra.list`:

```text
# General Apple/iCloud patch layer. Apple Intelligence belongs in AI.
DOMAIN-SUFFIX,apple.com
DOMAIN-SUFFIX,icloud.com
DOMAIN-SUFFIX,icloud-content.com
DOMAIN-SUFFIX,mzstatic.com
DOMAIN-SUFFIX,apple-dns.net
```

`Rules/Media-Extra.list`:

```text
# Streaming/media critical patch layer
DOMAIN-SUFFIX,youtube.com
DOMAIN-SUFFIX,googlevideo.com
DOMAIN-SUFFIX,ytimg.com
DOMAIN-SUFFIX,netflix.com
DOMAIN-SUFFIX,nflxvideo.net
DOMAIN-SUFFIX,nflximg.net
DOMAIN-SUFFIX,disneyplus.com
DOMAIN-SUFFIX,disney-plus.net
DOMAIN-SUFFIX,spotify.com
DOMAIN-SUFFIX,scdn.co
```

`Rules/Games-Extra.list`:

```text
# International game platform patch layer. SteamCN stays DIRECT in main config.
DOMAIN-SUFFIX,steampowered.com
DOMAIN-SUFFIX,steamcommunity.com
DOMAIN-SUFFIX,nintendo.com
DOMAIN-SUFFIX,nintendo.net
DOMAIN-SUFFIX,xbox.com
DOMAIN-SUFFIX,xboxlive.com
DOMAIN-SUFFIX,playstation.com
DOMAIN-SUFFIX,playstation.net
DOMAIN-SUFFIX,epicgames.com
DOMAIN-SUFFIX,unrealengine.com
DOMAIN-SUFFIX,battle.net
DOMAIN-SUFFIX,blizzard.com
```

`Rules/Binance-Extra.list`:

```text
# Binance-only patch layer
DOMAIN-SUFFIX,binance.com
DOMAIN-SUFFIX,binance.info
DOMAIN-SUFFIX,binance.click
DOMAIN-SUFFIX,binance.me
DOMAIN-SUFFIX,binance.us
DOMAIN-SUFFIX,bncstatic.com
DOMAIN,binanceseamg.dataplane.rudderstack.com
```

`Rules/OKX-Extra.list`:

```text
# OKX-only patch layer
DOMAIN-SUFFIX,okx.com
DOMAIN-SUFFIX,okex.com
DOMAIN,wallet.okex.org
DOMAIN-SUFFIX,oklink.com
DOMAIN-SUFFIX,coinall.ltd
DOMAIN-SUFFIX,okx-dns.com
DOMAIN-SUFFIX,okx-dns1.com
DOMAIN-SUFFIX,okx-dns2.com
DOMAIN-SUFFIX,okx.ac
DOMAIN-SUFFIX,okx.cab
DOMAIN,okx.com.cdn.cloudflare.net
DOMAIN-SUFFIX,xlayer.tech
```

- [ ] **Step 4: Run Extra-rule tests**

Run:

```bash
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_extra_rule_files_cover_critical_domains -v
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_games_extra_does_not_capture_steam_cn -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Rules tests/test_surge_routing.py
git commit -m "feat: add self-maintained Surge rule patch layers"
```

---

### Task 3: Rebuild public policy groups with uniform regional choices

**Files:**
- Modify: `Surge全功能智能版.example.conf`
- Modify: `tests/test_surge_routing.py`

**Interfaces:**
- Visible application group names are stable public interfaces consumed by the rule section.
- Hidden defaults are: `欧易默认`, `币安默认`, `AI默认`, `Google默认`, `Microsoft默认`, `Telegram默认`, `Apple默认`, `流媒体默认`, `游戏平台默认`.
- `wait` and `sky` are the only SSIDs mapped to DIRECT in those default groups.

- [ ] **Step 1: Add failing default-behavior tests**

Add:

```python
def test_app_default_groups_match_home_and_external_design(self):
    text = EXAMPLE.read_text(encoding="utf-8")
    groups = parse_policy_groups(text)
    expected_defaults = {
        "欧易默认": "default=新加坡交易稳定",
        "币安默认": "default=台湾交易稳定",
        "AI默认": "default=美国稳定",
        "Google默认": "default=通用网络",
        "Microsoft默认": "default=DIRECT",
        "Telegram默认": "default=通用网络",
        "Apple默认": "default=DIRECT",
        "流媒体默认": "default=通用网络",
        "游戏平台默认": "default=通用网络",
    }
    for group, external_default in expected_defaults.items():
        self.assertIn(group, groups)
        line = groups[group]
        self.assertIn(external_default, line)
        self.assertIn('"SSID:wait"=DIRECT', line)
        self.assertIn('"SSID:sky"=DIRECT', line)
        self.assertNotIn("sky6_5G", line)
        self.assertIn("hidden=true", line)

def test_smart_pool_keeps_b_priority_and_is_not_full_subscription_regex(self):
    text = EXAMPLE.read_text(encoding="utf-8")
    groups = parse_policy_groups(text)
    smart = groups["自动选择"]
    self.assertIn("B[0-9]+", smart)
    self.assertIn("policy-priority", smart)
    self.assertNotIn("policy-regex-filter=.+", smart)
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_app_default_groups_match_home_and_external_design -v
```

Expected: FAIL because the public example still uses old group names and old network groups.

- [ ] **Step 3: Replace the example config `[Proxy Group]` section**

Use the stable V2 node-source architecture and these visible groups:

```ini
节点选择 = select, 自动选择, include-other-group=✈️ 我的节点

💱 欧易交易 = select, 欧易默认, 节点选择, 🇭🇰 香港节点, 🇹🇼 台湾节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, DIRECT
💰 币安交易 = select, 币安默认, 节点选择, 🇭🇰 香港节点, 🇹🇼 台湾节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, DIRECT
🤖 AI 服务 = select, AI默认, 节点选择, 🇭🇰 香港节点, 🇹🇼 台湾节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, DIRECT
🔎 Google = select, Google默认, 节点选择, 🇭🇰 香港节点, 🇹🇼 台湾节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, DIRECT
🪟 Microsoft = select, Microsoft默认, 节点选择, 🇭🇰 香港节点, 🇹🇼 台湾节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, DIRECT
✈️ Telegram = select, Telegram默认, 节点选择, 🇭🇰 香港节点, 🇹🇼 台湾节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, DIRECT
🍎 Apple = select, Apple默认, 节点选择, 🇭🇰 香港节点, 🇹🇼 台湾节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, DIRECT
🎬 流媒体 = select, 流媒体默认, 节点选择, 🇭🇰 香港节点, 🇹🇼 台湾节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, DIRECT
🎮 游戏平台 = select, 游戏平台默认, 节点选择, 🇭🇰 香港节点, 🇹🇼 台湾节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, DIRECT
家里LAN = select, DIRECT, HomeLAN-DDNS
```

Keep these visible region groups at the end:

```ini
🇭🇰 香港节点 = url-test, include-other-group=✈️ 我的节点, policy-regex-filter="(?i)(🇭🇰|香港)", interval=900, tolerance=100, no-alert=true
🇹🇼 台湾节点 = url-test, include-other-group=✈️ 我的节点, policy-regex-filter="(?i)(🇹🇼|台湾)", interval=900, tolerance=100, no-alert=true
🇯🇵 日本节点 = url-test, include-other-group=✈️ 我的节点, policy-regex-filter="(?i)(🇯🇵|日本)", interval=900, tolerance=100, no-alert=true
🇸🇬 新加坡节点 = url-test, include-other-group=✈️ 我的节点, policy-regex-filter="(?i)(🇸🇬|新加坡)", interval=900, tolerance=100, no-alert=true
🇺🇸 美国节点 = url-test, include-other-group=✈️ 我的节点, policy-regex-filter="(?i)(🇺🇸|美国)", interval=900, tolerance=100, no-alert=true
```

Keep `✈️ 我的节点` hidden and use the local converter URL in the private config; the public example must use a safe placeholder or desensitized local converter reference.

Keep the bounded Smart expression from stable V2:

```ini
自动选择 = smart, include-other-group=✈️ 我的节点, policy-regex-filter="(?i)(B[0-9]+|香港.*(?:优化1|优化2).*\[0\.5\]|台湾.*(?:三期1|三期2|A1-4|A1-5).*\[0\.[24]\]|日本.*(?:札幌A1|大阪A1|大阪A2|移联优-1|移联优-2).*\[0\.5\]|新加坡.*\[0\.4\]|美国.*4837)", policy-priority="(?i)B[0-9]+:0.45;\[0\.2\]:0.82;\[0\.4\]:0.88;\[0\.5\]:0.94;\[1\.0\]:1.05", hidden=true
```

Keep the small fallback pools:

```ini
台湾交易稳定 = fallback, include-other-group=✈️ 我的节点, policy-regex-filter="(?i)(🇹🇼|台湾).*(B[0-9]+|三期[12]移动优化|A1-[45])", interval=600, timeout=3, evaluate-before-use=true, no-alert=true, hidden=true
新加坡交易稳定 = fallback, include-other-group=✈️ 我的节点, policy-regex-filter="(?i)(🇸🇬|新加坡).*(B[0-9]+|v6-移联优-2)", interval=600, timeout=3, evaluate-before-use=true, no-alert=true, hidden=true
美国稳定 = fallback, include-other-group=✈️ 我的节点, policy-regex-filter="(?i)(🇺🇸|美国).*(B[0-9]+|4837)", interval=600, timeout=3, evaluate-before-use=true, no-alert=true, hidden=true
```

Create the hidden per-app defaults exactly as:

```ini
通用网络 = subnet, default=节点选择, "SSID:wait"=DIRECT, "SSID:sky"=DIRECT, hidden=true
欧易默认 = subnet, default=新加坡交易稳定, "SSID:wait"=DIRECT, "SSID:sky"=DIRECT, hidden=true
币安默认 = subnet, default=台湾交易稳定, "SSID:wait"=DIRECT, "SSID:sky"=DIRECT, hidden=true
AI默认 = subnet, default=美国稳定, "SSID:wait"=DIRECT, "SSID:sky"=DIRECT, hidden=true
Google默认 = subnet, default=通用网络, "SSID:wait"=DIRECT, "SSID:sky"=DIRECT, hidden=true
Microsoft默认 = subnet, default=DIRECT, "SSID:wait"=DIRECT, "SSID:sky"=DIRECT, hidden=true
Telegram默认 = subnet, default=通用网络, "SSID:wait"=DIRECT, "SSID:sky"=DIRECT, hidden=true
Apple默认 = subnet, default=DIRECT, "SSID:wait"=DIRECT, "SSID:sky"=DIRECT, hidden=true
流媒体默认 = subnet, default=通用网络, "SSID:wait"=DIRECT, "SSID:sky"=DIRECT, hidden=true
游戏平台默认 = subnet, default=通用网络, "SSID:wait"=DIRECT, "SSID:sky"=DIRECT, hidden=true
```

- [ ] **Step 4: Ensure stable-V2 General/Script settings are retained in the example**

The public example must not reintroduce:
- `doh.pub`
- startup/event bulk retest scripts
- `auto-suspend` default behavior

Require:

```ini
encrypted-dns-server = https://dns.alidns.com/dns-query
auto-suspend = false
```

The status panel script stays, with no startup/network-change retest event scripts.

- [ ] **Step 5: Run policy-group tests**

Run:

```bash
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_all_application_groups_offer_every_region_and_direct -v
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_app_default_groups_match_home_and_external_design -v
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_smart_pool_keeps_b_priority_and_is_not_full_subscription_regex -v
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add Surge全功能智能版.example.conf tests/test_surge_routing.py
git commit -m "feat: unify Surge application policy groups"
```

---

### Task 4: Rebuild rule ordering and multi-source coverage

**Files:**
- Modify: `Surge全功能智能版.example.conf`
- Modify: `tests/test_surge_routing.py`

**Interfaces:**
- Rule precedence is the public behavior contract.
- All own-repo Extra lists are referenced before broad China protection.
- Third-party broad Crypto/Cryptocurrency lists are never assigned wholesale to Binance or OKX.

- [ ] **Step 1: Add failing source/order tests**

Add:

```python
def test_microsoft_has_multi_source_coverage(self):
    text = EXAMPLE.read_text(encoding="utf-8")
    required = [
        "Rules/Microsoft-Extra.list,🪟 Microsoft",
        "/Microsoft/Microsoft.list,🪟 Microsoft",
        "/OneDrive/OneDrive.list,🪟 Microsoft",
        "/Teams/Teams.list,🪟 Microsoft",
        "/MicrosoftEdge/MicrosoftEdge.list,🪟 Microsoft",
        "/Bing/Bing.list,🪟 Microsoft",
        "/Copilot/Copilot.list,🪟 Microsoft",
        "SukkaW/Surge/master/Source/non_ip/microsoft.conf,🪟 Microsoft",
    ]
    for marker in required:
        self.assertIn(marker, text)

def test_ai_precedes_google_and_apple(self):
    text = EXAMPLE.read_text(encoding="utf-8")
    self.assertLess(text.index("Rules/AI-Extra.list"), text.index("Rules/Google-Extra.list"))
    self.assertLess(text.index("Rules/AI-Extra.list"), text.index("Rules/Apple-Extra.list"))

def test_crypto_aggregate_lists_are_not_bound_to_trade_groups(self):
    text = EXAMPLE.read_text(encoding="utf-8")
    for line in text.splitlines():
        if "Cryptocurrency/Cryptocurrency.list" in line or "/Crypto/Crypto.list" in line:
            self.assertNotIn("💰 币安交易", line)
            self.assertNotIn("💱 欧易交易", line)
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_microsoft_has_multi_source_coverage -v
```

Expected: FAIL until the rule section is rebuilt.

- [ ] **Step 3: Replace `[Rule]` with the approved precedence**

Use this exact layer order.

**Layer 1 — LAN/private:**
- existing manual direct domains
- loopback/private CIDRs
- HomeLAN CIDRs
- Blackmatrix7 Lan list

**Layer 2 — trading:**

```ini
RULE-SET,https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/OKX-Extra.list,💱 欧易交易,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Binance/Binance.list,💰 币安交易,extended-matching
RULE-SET,https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/Binance-Extra.list,💰 币安交易,extended-matching
```

Keep explicit OKX critical domains if desired, but they must all target `💱 欧易交易` and remain before China protection.

**Layer 3 — AI:**

```ini
RULE-SET,https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/AI-Extra.list,🤖 AI 服务,extended-matching
RULE-SET,https://raw.githubusercontent.com/SukkaW/Surge/master/Source/non_ip/ai.conf,🤖 AI 服务,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/OpenAI/OpenAI.list,🤖 AI 服务,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Claude/Claude.list,🤖 AI 服务,extended-matching
RULE-SET,https://ruleset.skk.moe/List/non_ip/apple_intelligence.conf,🤖 AI 服务,extended-matching
```

**Layer 4 — Microsoft / Google / Telegram / Apple:**

```ini
RULE-SET,https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/Microsoft-Extra.list,🪟 Microsoft,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Microsoft/Microsoft.list,🪟 Microsoft,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/OneDrive/OneDrive.list,🪟 Microsoft,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Teams/Teams.list,🪟 Microsoft,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/MicrosoftEdge/MicrosoftEdge.list,🪟 Microsoft,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Bing/Bing.list,🪟 Microsoft,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Copilot/Copilot.list,🪟 Microsoft,extended-matching
RULE-SET,https://raw.githubusercontent.com/SukkaW/Surge/master/Source/non_ip/microsoft.conf,🪟 Microsoft,extended-matching

RULE-SET,https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/Google-Extra.list,🔎 Google,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/GoogleVoice/GoogleVoice.list,🔎 Google,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Google/Google.list,🔎 Google,extended-matching

RULE-SET,https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/Telegram-Extra.list,✈️ Telegram,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Telegram/Telegram.list,✈️ Telegram

RULE-SET,https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/Apple-Extra.list,🍎 Apple,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Apple/Apple_All_No_Resolve.list,🍎 Apple
```

**Layer 5 — media/games:**

```ini
RULE-SET,https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/Media-Extra.list,🎬 流媒体,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/YouTube/YouTube.list,🎬 流媒体
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Netflix/Netflix.list,🎬 流媒体
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Disney/Disney.list,🎬 流媒体
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Spotify/Spotify.list,🎬 流媒体
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/GlobalMedia/GlobalMedia.list,🎬 流媒体

RULE-SET,https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/Games-Extra.list,🎮 游戏平台,extended-matching
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Nintendo/Nintendo.list,🎮 游戏平台
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Steam/Steam.list,🎮 游戏平台
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Xbox/Xbox.list,🎮 游戏平台
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Sony/Sony.list,🎮 游戏平台
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Epic/Epic.list,🎮 游戏平台
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Battle/Battle.list,🎮 游戏平台
```

**Layer 6 — China protection:**

```ini
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/WeChat/WeChat.list,DIRECT
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/BiliBili/BiliBili.list,DIRECT
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/ChinaMedia/ChinaMedia.list,DIRECT
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/SteamCN/SteamCN.list,DIRECT
DOMAIN-SUFFIX,cn,DIRECT
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/ChinaMax/ChinaMax_All.list,DIRECT,no-resolve
GEOIP,CN,DIRECT
```

`SteamCN` must appear before the general Steam rule; if necessary move SteamCN to immediately before the games layer while keeping it DIRECT.

**Layer 7 — generic overseas and final:**

```ini
RULE-SET,https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/Surge/Proxy/Proxy.list,通用网络
FINAL,通用网络,dns-failed
```

- [ ] **Step 4: Run rule-order and source tests**

Run:

```bash
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_application_rules_precede_china_protection -v
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_microsoft_has_multi_source_coverage -v
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_ai_precedes_google_and_apple -v
python3 -m unittest tests.test_surge_routing.SurgeRoutingTests.test_crypto_aggregate_lists_are_not_bound_to_trade_groups -v
```

Expected: PASS.

- [ ] **Step 5: Run the CLI against the public example**

Run:

```bash
python3 tools/validate_surge_routing.py Surge全功能智能版.example.conf
```

Expected:

```text
OK: Surge routing validation passed
```

- [ ] **Step 6: Commit**

```bash
git add Surge全功能智能版.example.conf tests/test_surge_routing.py
git commit -m "feat: rebuild Surge application routing coverage"
```

---

### Task 5: Verify third-party rule sources and representative domain ownership

**Files:**
- Modify: `tests/test_surge_routing.py`
- Optionally create: `docs/routing-source-audit-2026-09-21.md`

**Interfaces:**
- This task does not change routing behavior; it verifies the external contracts the config depends on.

- [ ] **Step 1: Add source-reference assertions**

Add a test that asserts every required URL string is present exactly once or intentionally repeated only when documented. Include at least:
- Blackmatrix7 Microsoft, OneDrive, Teams, MicrosoftEdge, Bing, Copilot
- SukkaW Microsoft
- SukkaW AI
- Blackmatrix7 OpenAI, Claude, Google, GoogleVoice, Telegram, Apple
- Blackmatrix7 YouTube, Netflix, Disney, Spotify, GlobalMedia
- Blackmatrix7 Nintendo, Steam, Xbox, Sony, Epic, Battle
- Blackmatrix7 Binance
- Blackmatrix7 ChinaMax, SteamCN, Proxy

- [ ] **Step 2: Use GitHub fetch/search to verify every GitHub source exists**

For each GitHub-backed source, fetch the exact repository file from GitHub rather than trusting an inferred URL. Verify HTTP/content success and Surge-compatible rule syntax.

For Microsoft specifically verify the fetched SukkaW file contains:

```text
DOMAIN-SUFFIX,office365.com
DOMAIN-SUFFIX,outlook.com
DOMAIN-SUFFIX,outlookmobile.com
DOMAIN-SUFFIX,microsoftonline.com
DOMAIN-SUFFIX,onedrive.com
DOMAIN-SUFFIX,sharepoint.com
```

Verify the fetched SukkaW AI file contains OpenAI, Claude, Perplexity, and Gemini entries.

- [ ] **Step 3: Check representative domain ownership**

Build a manual audit table with at least these expectations:

```text
outlook.com                    -> 🪟 Microsoft
outlookmobile.com              -> 🪟 Microsoft
login.microsoftonline.com      -> 🪟 Microsoft
onedrive.com                   -> 🪟 Microsoft
sharepoint.com                 -> 🪟 Microsoft
chatgpt.com                    -> 🤖 AI 服务
claude.ai                      -> 🤖 AI 服务
gemini.google.com              -> 🤖 AI 服务
perplexity.ai                  -> 🤖 AI 服务
voice.google.com               -> 🔎 Google
telegram.org                   -> ✈️ Telegram
icloud.com                     -> 🍎 Apple
youtube.com                    -> 🎬 流媒体
netflix.com                    -> 🎬 流媒体
spotify.com                    -> 🎬 流媒体
steampowered.com               -> 🎮 游戏平台
nintendo.net                   -> 🎮 游戏平台
xboxlive.com                   -> 🎮 游戏平台
playstation.net                -> 🎮 游戏平台
epicgames.com                  -> 🎮 游戏平台
battle.net                     -> 🎮 游戏平台
binance.com                    -> 💰 币安交易
okx.com                        -> 💱 欧易交易
```

Confirm each target rule occurs before `.cn`, ChinaMax, GEOIP CN, and generic Proxy.

- [ ] **Step 4: Run the entire test suite**

Run:

```bash
python3 -m unittest tests.test_surge_routing -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the audit evidence if a doc was created**

```bash
git add tests/test_surge_routing.py docs/routing-source-audit-2026-09-21.md
git commit -m "test: verify Surge external rule sources"
```

If no audit document is created, commit only the test changes.

---

### Task 6: Produce the private final config without leaking secrets

**Files:**
- Read local-only source: conversation artifact `Surge全功能智能版-稳定性优先V2-去GV版-MITM.conf`
- Create local-only output: `/mnt/data/Surge全功能智能版-完整分流版.conf`
- Use: `tools/surge_routing.py`
- Do not commit either private file.

**Interfaces:**
- Consumes the user's current private V2 config.
- Consumes the validated public example config.
- Produces a private final config whose only routing-related replacements are `[Proxy Group]` and `[Rule]`.

- [ ] **Step 1: Materialize the user's current private config locally**

Use the conversation artifact named `Surge全功能智能版-稳定性优先V2-去GV版-MITM.conf` and materialize it to the exact local path `/mnt/data/surge-routing-private/Surge-private-source.conf`. Confirm that exact path exists before reading it; never reconstruct secrets from chat text.

- [ ] **Step 2: Write a failing private-generation check**

Before creating the output, assert the current private source does not yet contain all nine new application group names and all nine own-repo Extra references. This proves the transformation is doing work.

- [ ] **Step 3: Replace only routing sections**

Run Python using the library:

```python
from pathlib import Path
from tools.surge_routing import replace_sections

private_path = Path("/mnt/data/surge-routing-private/Surge-private-source.conf")
template_path = Path("Surge全功能智能版.example.conf")
output_path = Path("/mnt/data/Surge全功能智能版-完整分流版.conf")

private_text = private_path.read_text(encoding="utf-8")
template_text = template_path.read_text(encoding="utf-8")

result = replace_sections(
    private_text,
    template_text,
    ("Proxy Group", "Rule"),
)

output_path.write_text(result, encoding="utf-8")
```

Do not copy `[General]`, `[Proxy]`, `[MITM]`, `[SSID Setting]`, `[Script]`, or `[Panel]` from the public example over the private config.

- [ ] **Step 4: Validate the private output in private mode**

Run:

```bash
python3 tools/validate_surge_routing.py /mnt/data/Surge全功能智能版-完整分流版.conf --allow-private
```

Expected:

```text
OK: Surge routing validation passed
```

- [ ] **Step 5: Verify secret preservation locally without printing values**

Use boolean-only checks:

```python
from pathlib import Path

source = Path("/mnt/data/surge-routing-private/Surge-private-source.conf").read_text(encoding="utf-8")
output = Path("/mnt/data/Surge全功能智能版-完整分流版.conf").read_text(encoding="utf-8")

checks = {
    "mitm_section_preserved": source.split("[MITM]", 1)[1] == output.split("[MITM]", 1)[1],
    "home_proxy_entry_present": "HomeLAN-DDNS =" in output,
    "new_microsoft_group_present": "🪟 Microsoft =" in output,
    "all_extra_rules_present": all(
        f"Rules/{name}-Extra.list" in output
        for name in [
            "Microsoft", "Google", "AI", "Telegram", "Apple",
            "Media", "Games", "Binance", "OKX"
        ]
    ),
}
assert all(checks.values()), checks
print(checks)
```

Never print the source/output config contents.

- [ ] **Step 6: Compute checksum**

Run:

```bash
sha256sum /mnt/data/Surge全功能智能版-完整分流版.conf
```

Record only the SHA-256 and file size in the completion message.

---

### Task 7: Final regression verification and handoff

**Files:**
- Verify: `Scripts/surge-status.js`
- Verify: `Surge全功能智能版.example.conf`
- Verify: `Rules/*.list`
- Verify local-only final config.

**Interfaces:**
- Completion gate only; no new behavior unless a failed test requires a fix.

- [ ] **Step 1: Verify status script compatibility**

Check `Scripts/surge-status.js`:
- still references `节点选择`, Binance, and OKX correctly;
- contains no `Google Voice` group reference;
- does not require the old Chinese policy names `微软服务`, `谷歌服务`, `智能助理`, `电报信息`;
- if no incompatible reference exists, do not modify the file.

- [ ] **Step 2: Run all local tests**

```bash
python3 -m unittest tests.test_surge_routing -v
python3 tools/validate_surge_routing.py Surge全功能智能版.example.conf
python3 tools/validate_surge_routing.py /mnt/data/Surge全功能智能版-完整分流版.conf --allow-private
```

Expected: all PASS.

- [ ] **Step 3: Re-fetch committed GitHub files**

Re-fetch:
- all nine `Rules/*.list`;
- `Surge全功能智能版.example.conf`;
- any modified script;
- this spec and plan if needed for consistency.

Confirm the remote blob contents match the tested local content.

- [ ] **Step 4: Check GitHub history for accidental secrets**

Search the repository for:
- `ca-p12`
- `ca-passphrase`
- `password=`
- the private subscription host/token if known only locally

Public example placeholders are allowed only when they use `YOUR_...`. If any real private material appears, stop delivery and remove it from the commit before continuing.

- [ ] **Step 5: Deliver the final artifact and evidence**

Provide:
- sandbox link to `Surge全功能智能版-完整分流版.conf`;
- SHA-256;
- GitHub commit SHAs for the rules/config/tests;
- concise summary of Microsoft Outlook/M365 reinforcement and all nine application groups' five-region choices;
- note that the private MITM/credential-bearing config was not committed to GitHub.
