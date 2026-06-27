#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is not installed. Install it first: brew install --cask google-cloud-sdk" >&2
  exit 1
fi

if [[ -f mobile/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source mobile/.env
  set +a
fi

export GEMINI_API_KEY="${GEMINI_API_KEY:-${EXPO_PUBLIC_GEMINI_API_KEY:-}}"

if [[ -z "${GEMINI_API_KEY}" ]]; then
  echo "Missing Gemini API key. Set GEMINI_API_KEY or EXPO_PUBLIC_GEMINI_API_KEY in mobile/.env." >&2
  exit 1
fi

exec npm run deploy:cloud-run
