#!/usr/bin/env python3
"""Build static site for local/dev deployment with runtime env injection."""

from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

IGNORED_DIRS = {
    ".git",
    ".github",
    ".vscode",
    "dist",
    "scripts",
    "secrets",
    "venv",
    ".venv",
}
IGNORED_FILES = {
    ".env",
    ".env.local",
    ".env.example",
    ".env.local.example",
}


def parse_env_file(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        env[key] = value
    return env


def get_runtime_values(mode: str) -> dict[str, dict[str, str]]:
    values: dict[str, str] = {}

    if mode == "local":
        values.update(parse_env_file(ROOT / ".env.local"))

    for key in [
        "GOOGLE_CALENDAR_API_KEY",
        "GOOGLE_CALENDAR_ID",
        "FIREBASE_API_KEY",
        "FIREBASE_AUTH_DOMAIN",
        "FIREBASE_PROJECT_ID",
        "FIREBASE_STORAGE_BUCKET",
        "FIREBASE_MESSAGING_SENDER_ID",
        "FIREBASE_APP_ID",
        "FIREBASE_MEASUREMENT_ID",
    ]:
        env_val = os.environ.get(key)
        if env_val:
            values[key] = env_val

    return {
        "google": {
            "calendarApiKey": values.get("GOOGLE_CALENDAR_API_KEY", ""),
            "calendarId": values.get("GOOGLE_CALENDAR_ID", ""),
        },
        "firebase": {
            "apiKey": values.get("FIREBASE_API_KEY", ""),
            "authDomain": values.get("FIREBASE_AUTH_DOMAIN", ""),
            "projectId": values.get("FIREBASE_PROJECT_ID", ""),
            "storageBucket": values.get("FIREBASE_STORAGE_BUCKET", ""),
            "messagingSenderId": values.get("FIREBASE_MESSAGING_SENDER_ID", ""),
            "appId": values.get("FIREBASE_APP_ID", ""),
            "measurementId": values.get("FIREBASE_MEASUREMENT_ID", ""),
        },
    }


def should_ignore(path: Path) -> bool:
    if any(part in IGNORED_DIRS for part in path.parts):
        return True
    if path.name in IGNORED_FILES:
        return True
    if path.suffix in {".pyc", ".pyo"}:
        return True
    return False


def copy_workspace() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    for item in ROOT.iterdir():
        if should_ignore(item):
            continue

        target = DIST / item.name
        if item.is_dir():
            shutil.copytree(
                item,
                target,
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo"),
            )
        else:
            shutil.copy2(item, target)


def write_runtime_config(runtime_values: dict[str, dict[str, str]]) -> None:
    runtime_path = DIST / "js" / "runtime-config.js"
    runtime_path.parent.mkdir(parents=True, exist_ok=True)
    js = (
        "window.__RUNTIME_CONFIG__ = "
        + json.dumps(runtime_values, ensure_ascii=False, indent=2)
        + ";\n\nexport const RUNTIME_CONFIG = window.__RUNTIME_CONFIG__;\n"
    )
    runtime_path.write_text(js, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build static files for GitHub Pages deployment")
    parser.add_argument("--mode", choices=["local", "ci"], default="local")
    args = parser.parse_args()

    copy_workspace()
    runtime_values = get_runtime_values(mode=args.mode)
    write_runtime_config(runtime_values)

    print(f"[INFO] Built site to: {DIST}")


if __name__ == "__main__":
    main()
