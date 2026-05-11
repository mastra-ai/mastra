#!/usr/bin/env bash
# Print `auth=on` if WorkOS env vars are resolvable, otherwise `auth=off`.
#
# Resolution order (matches preflight.sh):
#   1. shell env
#   2. $BUILDER_SMOKE_RC (rc file path, never sourced — only inspected)
#   3. examples/agent/.env
#   4. repo-root .env, .env.local
set -uo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../../.." && pwd)"
EXAMPLE_ENV="${REPO_ROOT}/examples/agent/.env"
ROOT_ENV="${REPO_ROOT}/.env"
ROOT_ENV_LOCAL="${REPO_ROOT}/.env.local"
RC_FILE="${BUILDER_SMOKE_RC:-}"

has_var() {
  local name="$1"
  if [ -n "${!name:-}" ]; then return 0; fi
  for f in "${RC_FILE}" "${EXAMPLE_ENV}" "${ROOT_ENV}" "${ROOT_ENV_LOCAL}"; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    if grep -E "^[[:space:]]*(export[[:space:]]+)?${name}=" "$f" | grep -vqE "=$|=\"\"|=''"; then
      return 0
    fi
  done
  return 1
}

if has_var WORKOS_CLIENT_ID && has_var WORKOS_API_KEY; then
  echo "auth=on"
else
  echo "auth=off"
fi
