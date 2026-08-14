#!/usr/bin/env python3
"""Reject unintended user-facing references to the former product name."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXT_SUFFIXES = {".html", ".json", ".md", ".py", ".ts", ".tsx", ".yaml", ".yml"}
EXCLUDED_PARTS = {".git", ".next", "node_modules"}
FORMER_NAME = "nest" + "ledger"

ALLOWED = {
    "lib/client.ts": ("LEGACY_SERVER_URL_KEY", "LEGACY_SESSION_KEY"),
}

REQUIRED_ASSETS = (
    "public/brand/tallystead-icon.svg",
    "public/brand/tallystead-icon-dark.svg",
    "public/brand/tallystead-horizontal.svg",
    "public/brand/tallystead-horizontal-dark.svg",
    "public/brand/tallystead-lockup.svg",
    "public/brand/tallystead-lockup-dark.svg",
    "public/icons/favicon.svg",
    "public/icons/favicon.ico",
    "public/icons/apple-touch-icon.png",
    "public/icons/pwa-192x192.png",
    "public/icons/pwa-512x512.png",
    "public/icons/pwa-maskable-192x192.png",
    "public/icons/pwa-maskable-512x512.png",
    "public/icons/safari-pinned-tab.svg",
)


def files():
    for path in ROOT.rglob("*"):
        if path.is_file() and path.suffix in TEXT_SUFFIXES and not EXCLUDED_PARTS.intersection(path.parts):
            yield path


def main() -> int:
    failures: list[str] = []
    for relative in REQUIRED_ASSETS:
        if not (ROOT / relative).is_file():
            failures.append(f"{relative}: required Tallystead asset is missing")
    for path in files():
        relative = path.relative_to(ROOT).as_posix()
        allowed = ALLOWED.get(relative, ())
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if FORMER_NAME in line.lower() and not any(value in line for value in allowed):
                failures.append(f"{relative}:{number}: {line.strip()}")
    if failures:
        print("Unapproved former-brand references found:")
        print("\n".join(failures))
        return 1
    print("Tallystead brand reference check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

