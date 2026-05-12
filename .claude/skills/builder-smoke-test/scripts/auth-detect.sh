#!/usr/bin/env bash
# Print the auth mode the scaffolded builder-smoke project will boot in.
#
# Reads ONLY the project's .env — because `mastra dev` overwrites process.env
# from .env at boot, shell-exported AUTH_PROVIDER does not enable WorkOS auth
# in the server.
#
# Project dir resolution (first wins):
#   1. --dir <path> flag
#   2. $BUILDER_SMOKE_TEST_DIR env var
#   3. ~/mastra-builder-smoke-tests/builder-smoke  (default)
#
# Output:
#   mode=off                            — AUTH_PROVIDER absent in project .env
#   mode=on:workos                      — AUTH_PROVIDER=workos in project .env
#   mode=on:<other>                     — AUTH_PROVIDER=<other-provider> in project .env
#
# Usage:
#   bash auth-detect.sh                              # default project dir
#   bash auth-detect.sh --dir /custom/path           # custom project dir
#   BUILDER_SMOKE_TEST_DIR=/custom/path bash auth-detect.sh
#
# Exit codes:
#   0 — mode resolved (off or on:*)
#   1 — .env missing (run scripts/scaffold.sh first)

set -uo pipefail

DEFAULT_PROJECT_DIR="${HOME}/mastra-builder-smoke-tests/builder-smoke"
PROJECT_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) PROJECT_DIR="${2:-}"; shift 2 ;;
    --dir=*) PROJECT_DIR="${1#--dir=}"; shift ;;
    -h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "auth-detect: unknown arg '$1'" >&2; exit 2 ;;
  esac
done

PROJECT_DIR="${PROJECT_DIR:-${BUILDER_SMOKE_TEST_DIR:-$DEFAULT_PROJECT_DIR}}"
ENV_FILE="${PROJECT_DIR}/.env"

if [ ! -f "${ENV_FILE}" ]; then
  echo "mode=unknown" >&2
  echo "auth-detect: .env not found at ${ENV_FILE} (run scripts/scaffold.sh first)" >&2
  exit 1
fi

provider_line=$(grep -E '^[[:space:]]*AUTH_PROVIDER=' "${ENV_FILE}" | head -n1 || true)
if [ -z "${provider_line}" ]; then
  echo "mode=off"
  exit 0
fi

val="${provider_line#*=}"
val="${val%\"}"; val="${val#\"}"
val="${val%\'}"; val="${val#\'}"

if [ -z "${val}" ]; then
  echo "mode=off"
  exit 0
fi

echo "mode=on:${val}"
exit 0
