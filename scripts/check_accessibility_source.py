#!/usr/bin/env python3
"""Fast, dependency-free accessibility guardrails for committed web source."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    failures: list[str] = []
    tsx_files = sorted(path for path in ROOT.rglob("*.tsx") if ".next" not in path.parts)
    for path in tsx_files:
        source = path.read_text(encoding="utf-8")
        for match in re.finditer(r"<img\b[^>]*>", source, re.IGNORECASE | re.DOTALL):
            if not re.search(r"\balt\s*=", match.group(0)):
                failures.append(f"{path.relative_to(ROOT)}: image is missing alt text")
        for match in re.finditer(r"<(div|span)\b[^>]*\bonClick\s*=", source, re.IGNORECASE):
            failures.append(
                f"{path.relative_to(ROOT)}: clickable {match.group(1)} must be a native control"
            )

    layout = (ROOT / "app/layout.tsx").read_text(encoding="utf-8")
    if "export const viewport" not in layout and '<meta name="viewport"' not in layout:
        failures.append("app/layout.tsx: responsive viewport declaration is missing")

    css = (ROOT / "app/styles.css").read_text(encoding="utf-8")
    for selector in ("button:focus-visible", "a:focus-visible", "input:focus"):
        if selector not in css:
            failures.append(f"app/styles.css: {selector} styling is missing")
    if "prefers-reduced-motion" not in css:
        failures.append("app/styles.css: reduced-motion override is missing")

    if failures:
        print("Accessibility source policy failed:")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)
    print(f"Accessibility source policy passed across {len(tsx_files)} TSX files.")


if __name__ == "__main__":
    main()

