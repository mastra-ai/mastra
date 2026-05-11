#!/usr/bin/env bash
# Preflight environment check for the builder-smoke-test skill.
#
# Resolution order for each variable (first non-empty wins):
#   1. Already-exported shell env
#   2. $BUILDER_SMOKE_RC (path to an rc file that's `source`-d)
#   3. examples/agent/.env
#   4. repo-root .env, .env.local
#
# Does NOT mutate any environment or file. Prints a status table and exits:
#   0 — all required vars present
#   1 — one or more required vars missing
#
# Usage:
#   bash .claude/skills/builder-smoke-test/scripts/preflight.sh
#   BUILDER_SMOKE_RC=~/.config/mastra/builder-smoke.env bash .../preflight.sh
set -uo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../../.." && pwd)"
EXAMPLE_ENV="${REPO_ROOT}/examples/agent/.env"
ROOT_ENV="${REPO_ROOT}/.env"
ROOT_ENV_LOCAL="${REPO_ROOT}/.env.local"
RC_FILE="${BUILDER_SMOKE_RC:-}"

# Required vs optional for a default (auth-off) run.
REQUIRED=("OPENAI_API_KEY")
OPTIONAL=("ANTHROPIC_API_KEY" "WORKOS_CLIENT_ID" "WORKOS_API_KEY" "WORKOS_ORGANIZATION_ID" "WORKOS_COOKIE_PASSWORD" "BROWSERBASE_API_KEY" "BROWSERBASE_PROJECT_ID" "MASTRA_FGA_ENABLED" "AUTH_PROVIDER")

# Returns the source label where VAR is set, or empty string.
# Reads from files without exporting into the current shell.
locate_var() {
  local name="$1"

  if [ -n "${!name:-}" ]; then
    echo "shell-env"
    return 0
  fi

  if [ -n "${RC_FILE}" ] && [ -f "${RC_FILE}" ]; then
    if grep -E "^[[:space:]]*(export[[:space:]]+)?${name}=" "${RC_FILE}" | grep -vqE "=$|=\"\"|=''"; then
      echo "rc:${RC_FILE}"
      return 0
    fi
  fi

  if [ -f "${EXAMPLE_ENV}" ] && grep -E "^[[:space:]]*${name}=" "${EXAMPLE_ENV}" | grep -vqE "=$|=\"\"|=''"; then
    echo "examples/agent/.env"
    return 0
  fi

  if [ -f "${ROOT_ENV}" ] && grep -E "^[[:space:]]*${name}=" "${ROOT_ENV}" | grep -vqE "=$|=\"\"|=''"; then
    echo ".env"
    return 0
  fi

  if [ -f "${ROOT_ENV_LOCAL}" ] && grep -E "^[[:space:]]*${name}=" "${ROOT_ENV_LOCAL}" | grep -vqE "=$|=\"\"|=''"; then
    echo ".env.local"
    return 0
  fi

  return 1
}

missing=0
echo "Preflight: required env vars"
printf '  %-30s %s\n' "VAR" "SOURCE"
for v in "${REQUIRED[@]}"; do
  if src=$(locate_var "$v"); then
    printf '  %-30s %s\n' "$v" "✓ ${src}"
  else
    printf '  %-30s %s\n' "$v" "✗ NOT FOUND"
    missing=$((missing + 1))
  fi
done

echo
echo "Preflight: optional env vars"
printf '  %-30s %s\n' "VAR" "SOURCE"
for v in "${OPTIONAL[@]}"; do
  if src=$(locate_var "$v"); then
    printf '  %-30s %s\n' "$v" "✓ ${src}"
  else
    printf '  %-30s %s\n' "$v" "— unset"
  fi
done

# Common-gotcha cross-check.
echo
auth_provider_src=$(locate_var AUTH_PROVIDER || true)
fga_src=$(locate_var MASTRA_FGA_ENABLED || true)
if [ -n "${auth_provider_src}" ] && [ -z "${fga_src}" ]; then
  echo "⚠️  AUTH_PROVIDER is set (${auth_provider_src}) but MASTRA_FGA_ENABLED is not."
  echo "   This auto-enables FGA and will throw FGADeniedError on tool calls."
  echo "   For a non-auth smoke run, set MASTRA_FGA_ENABLED=false in examples/agent/.env."
fi

if [ "$missing" -gt 0 ]; then
  echo
  echo "✗ ${missing} required var(s) missing. Server boot will fail (e.g. OpenAIVoice ctor)."
  echo "  Set them in shell env, ${RC_FILE:-an rc file via \$BUILDER_SMOKE_RC}, or ${EXAMPLE_ENV#${REPO_ROOT}/}."
  exit 1
fi

echo "✓ All required vars present."
exit 0
