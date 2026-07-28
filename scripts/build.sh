#!/usr/bin/env bash
# Build CSS then fingerprint assets. Run this instead of the raw tailwind command.
set -e
cd "$(dirname "$0")/.."
npx -y tailwindcss@3 -c tailwind.config.js -i src/input.css -o assets/tailwind.min.css --minify
python3 scripts/fingerprint.py
