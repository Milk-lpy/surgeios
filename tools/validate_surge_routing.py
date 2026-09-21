#!/usr/bin/env python3
import argparse
import pathlib

try:
    from tools.surge_routing import (
        validate_app_groups,
        validate_no_public_secrets,
        validate_rule_order,
    )
except ModuleNotFoundError:
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
