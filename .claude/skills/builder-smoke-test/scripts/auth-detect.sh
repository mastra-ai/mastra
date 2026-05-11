#!/usr/bin/env bash
# Print the auth mode the running `mastra dev` server will see.
#
# Because `mastra dev` overwrites process.env from examples/agent/.env at
# boot, ONLY .env determines the server's mode. Shell-exported AUTH_PROVIDER
# does not enable WorkOS auth in the server.
#
# Output:
#   mode=off                            — AUTH_PROVIDER absent/commented in .env
#   mode=on:workos                      — AUTH_PROVIDER=workos in .env
#   mode=on:<other>                     — AUTH_PROVIDER=<other-provider> in .env
#   mode=ambiguous                      — AUTH_PROVIDER set in shell only,
#                                          not in .env (server runs auth-off
#                                          but shell value will leak elsewhere)
#
# Exit codes:
#   0 — clear mode (off, on:*)
#   1 — ambiguous

set -uo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../../.." && pwd)"
EXAMPLE_ENV="${REPO_ROOT}/examples/agent/.env"

env_value() {
  local name="$1"
  [ -f "${EXAMPLE_ENV}" ] || return 1
  local line
  line=$(grep -E "^[[:space:]]*${name}=" "${EXAMPLE_ENV}" | head -n1 || true)
  [ -n "${line}" ] || return 1
  local val="${line#*=}"
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  [ -n "${val}" ] || return 1
  printf '%s' "${val}"
}

env_provider=""
if val=$(env_value AUTH_PROVIDER); then
  env_provider="${val}"
fi

shell_provider="${AUTH_PROVIDER:-}"

if [ -n "${env_provider}" ]; then
  echo "mode=on:${env_provider}"
  exit 0
fi

if [ -n "${shell_provider}" ]; then
  echo "mode=ambiguous"
  exit 1
fi

echo "mode=off"
exit 0
