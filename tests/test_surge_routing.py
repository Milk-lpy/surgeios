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
        template = """[Proxy Group]\n🪟 Microsoft = select, Microsoft默认, 节点选择, 🇺🇸 美国节点, DIRECT\n\n[Rule]\nRULE-SET,https://raw.githubusercontent.com/Milk-lpy/surgeios/main/Rules/Microsoft-Extra.list,🪟 Microsoft\nFINAL,DIRECT\n"""
        result = replace_sections(private, template, ("Proxy Group", "Rule"))
        self.assertIn("ca-passphrase = PRIVATE_TEST_ONLY", result)
        self.assertIn("password=PRIVATE_TEST_ONLY", result)
        self.assertIn("[Proxy Group]", result)
        self.assertIn("🪟 Microsoft", result)
        self.assertIn("[Rule]", result)
        self.assertIn("Rules/Microsoft-Extra.list", result)

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

    def test_games_extra_does_not_capture_steam_cn(self):
        text = (ROOT / "Rules/Games-Extra.list").read_text(encoding="utf-8")
        self.assertNotIn("steamchina", text.lower())
        self.assertNotIn("steamserver.net", text.lower())

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

    def test_stable_v2_general_and_script_settings_remain(self):
        text = EXAMPLE.read_text(encoding="utf-8")
        active = "\n".join(
            line for line in text.splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        )
        self.assertIn("encrypted-dns-server = https://dns.alidns.com/dns-query", active)
        self.assertNotIn("doh.pub", active)
        self.assertIn("auto-suspend = false", active)
        self.assertNotIn("event-name=network-changed", active)
        self.assertNotIn("event-name=engine-started", active)

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

    def test_status_script_uses_current_trade_group_names(self):
        text = (ROOT / "Scripts/surge-status.js").read_text(encoding="utf-8")
        self.assertIn('decisions["💰 币安交易"]', text)
        self.assertIn('decisions["💱 欧易交易"]', text)
        self.assertIn('lookup("💰 币安交易"', text)
        self.assertIn('lookup("💱 欧易交易"', text)
        self.assertNotIn('decisions["币安交易"]', text)
        self.assertNotIn('decisions["欧易交易"]', text)
        self.assertNotIn('lookup("币安交易"', text)
        self.assertNotIn('lookup("欧易交易"', text)

    def test_specific_media_and_game_rules_precede_broad_vendor_rules(self):
        text = EXAMPLE.read_text(encoding="utf-8")
        self.assertLess(text.index("Rules/Media-Extra.list"), text.index("Rules/Google-Extra.list"))
        self.assertLess(text.index("Rules/Games-Extra.list"), text.index("Rules/Microsoft-Extra.list"))
        self.assertLess(text.index("/SteamCN/SteamCN.list"), text.index("Rules/Games-Extra.list"))

    def test_region_groups_use_smart_b_priority(self):
        text = EXAMPLE.read_text(encoding="utf-8")
        groups = parse_policy_groups(text)
        for region in REGIONS:
            self.assertIn(region, groups)
            line = groups[region]
            self.assertTrue(line.startswith("smart,"))
            self.assertIn('policy-priority="(?i)B[0-9]+:0.45"', line)
            self.assertIn("evaluate-before-use=true", line)
            self.assertNotIn("tolerance=100", line)

if __name__ == "__main__":
    unittest.main()
