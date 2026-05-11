#!/usr/bin/env bash
# Print `auth=on` if WorkOS env vars are set, otherwise `auth=off`.
# Inspects:
#   - current shell env
#   - examples/agent/.env (if present, relative to repo root)
set -euo pipefail

has_var() {
  local name="$1"
  # check env
  if [ -n "${!name:-}" ]; then
    return 0
  fi
  # check examples/agent/.env
  if [ -f "examples/agent/.env" ] && grep -E "^${name}=" "examples/agent/.env" | grep -vqE "^${name}=$"; then
    return 0
  fi
  return 1
}

if has_var WORKOS_CLIENT_ID && has_var WORKOS_API_KEY; then
  echo "auth=on"
else
  echo "auth=off"
fi
