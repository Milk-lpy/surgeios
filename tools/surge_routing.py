from __future__ import annotations

import re
from typing import Iterable

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

_HEADER_RE = re.compile(r"(?m)^\[([^\]\r\n]+)\]\s*$")


def _section_spans(text: str) -> list[tuple[str, int, int]]:
    matches = list(_HEADER_RE.finditer(text))
    spans: list[tuple[str, int, int]] = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        spans.append((match.group(1), start, end))
    return spans


def parse_sections(text: str) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for name, start, end in _section_spans(text):
        block = text[start:end]
        lines = block.splitlines()[1:]
        result[name] = lines
    return result


def parse_policy_groups(text: str) -> dict[str, str]:
    groups: dict[str, str] = {}
    for raw in parse_sections(text).get("Proxy Group", []):
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        groups[name.strip()] = value.strip()
    return groups


def parse_rule_lines(text: str) -> list[str]:
    return [
        line.strip()
        for line in parse_sections(text).get("Rule", [])
        if line.strip() and not line.lstrip().startswith("#")
    ]


def validate_app_groups(text: str) -> list[str]:
    groups = parse_policy_groups(text)
    errors: list[str] = []
    for app, default in APP_GROUPS.items():
        line = groups.get(app)
        if line is None:
            errors.append(f"missing application group: {app}")
            continue
        if default not in line:
            errors.append(f"{app} missing default group {default}")
        if "节点选择" not in line:
            errors.append(f"{app} missing 节点选择")
        if "DIRECT" not in line:
            errors.append(f"{app} missing DIRECT")
        for region in REGION_GROUPS:
            if region not in line:
                errors.append(f"{app} missing region {region}")
    return errors


def _first_index(lines: list[str], marker: str) -> int | None:
    for i, line in enumerate(lines):
        if marker in line:
            return i
    return None


def validate_rule_order(text: str) -> list[str]:
    lines = parse_rule_lines(text)
    errors: list[str] = []
    app_positions: list[int] = []
    for marker in APP_RULE_MARKERS:
        idx = _first_index(lines, marker)
        if idx is None:
            errors.append(f"missing application rule marker: {marker}")
        else:
            app_positions.append(idx)

    china_positions = [idx for marker in CHINA_MARKERS if (idx := _first_index(lines, marker)) is not None]
    if not china_positions:
        errors.append("missing China protection marker")
    elif app_positions:
        first_china = min(china_positions)
        for idx in app_positions:
            if idx >= first_china:
                errors.append("application rule appears after China protection")
                break

    steam_cn = _first_index(lines, "/SteamCN/SteamCN.list")
    steam_global = _first_index(lines, "/Steam/Steam.list")
    if steam_cn is not None and steam_global is not None and steam_cn >= steam_global:
        errors.append("SteamCN must precede global Steam")
    return errors


def validate_no_public_secrets(text: str) -> list[str]:
    errors: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        lower = line.lower()
        if lower.startswith("ca-p12"):
            errors.append("public config contains ca-p12")
        if lower.startswith("ca-passphrase"):
            errors.append("public config contains ca-passphrase")
        for match in re.finditer(r"\bpassword\s*=\s*([^,\s]+)", line, flags=re.I):
            if "YOUR_" not in match.group(1):
                errors.append("public config contains non-placeholder password")
        if "policy-path=" in lower or "subscription" in lower:
            urls = re.findall(r"https?://[^,\s]+", line)
            for url in urls:
                if re.search(r"[?&](?:token|key|auth|secret)=", url, flags=re.I):
                    errors.append("public config contains credentialized subscription URL")
    return errors


def _get_section_block(text: str, name: str) -> str | None:
    for section_name, start, end in _section_spans(text):
        if section_name == name:
            return text[start:end]
    return None


def replace_sections(base_text: str, template_text: str, section_names: Iterable[str]) -> str:
    replacements = {name: _get_section_block(template_text, name) for name in section_names}
    missing = [name for name, block in replacements.items() if block is None]
    if missing:
        raise ValueError(f"template missing sections: {', '.join(missing)}")

    spans = _section_spans(base_text)
    pieces: list[str] = []
    cursor = 0
    replaced: set[str] = set()
    for name, start, end in spans:
        pieces.append(base_text[cursor:start])
        if name in replacements:
            pieces.append(replacements[name] or "")
            replaced.add(name)
        else:
            pieces.append(base_text[start:end])
        cursor = end
    pieces.append(base_text[cursor:])

    missing_in_base = [name for name in replacements if name not in replaced]
    if missing_in_base:
        suffix = "" if not pieces or pieces[-1].endswith("\n") else "\n"
        pieces.append(suffix + "\n".join(replacements[name] or "" for name in missing_in_base))
    return "".join(pieces)
