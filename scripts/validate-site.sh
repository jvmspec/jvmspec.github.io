#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

python3 tests/site_contract.py

if command -v npm >/dev/null 2>&1 && [[ -d node_modules/playwright ]]; then
  node tests/browser-check.mjs
else
  printf '%s\n' 'INFO: browser validation skipped (run npm ci first).'
fi

git diff --check
printf '%s\n' 'SITE VALIDATION: PASS'
