#!/usr/bin/env bash
# Preflight for the builder-smoke-test skill.
#
# Calls scripts/scaffold.sh to ensure a hermetic project exists, then
# validates the resulting .env matches --expect off|on.
#
# Project dir resolution (first wins):
#   1. --dir <path> flag (forwarded to scaffold)
#   2. $BUILDER_SMOKE_TEST_DIR env var
#   3. ~/mastra-builder-smoke-tests/builder-smoke  (default)
#
# Run from anywhere; resolves paths relative to this script's location.
#
# Usage:
#   bash preflight.sh                         # scaffold auth-off (prompts for openai if missing)
#   bash preflight.sh --reuse                 # reuse existing project if healthy
#   bash preflight.sh --expect off            # extra check: .env must say auth off
#   bash preflight.sh --expect on \
#     --workos-api-key sk_test_... \
#     --workos-client-id client_... \
#     --workos-organization-id org_...        # scaffold auth-on
#   bash preflight.sh --dir /custom/path      # custom project dir
#   BUILDER_SMOKE_TEST_DIR=/custom/path bash preflight.sh
#   bash preflight.sh --skip-scaffold         # inspect an already-scaffolded project; no install, no .env rewrite
#
# All --openai-key, --workos-*, --dir, --reuse flags are forwarded to scaffold.sh.
# --skip-scaffold short-circuits scaffold.sh entirely and just validates the
# existing $PROJECT_DIR (deps present, .env has OPENAI_API_KEY, auth mode
# matches --expect). Use this when re-checking mid-run without disturbing
# the project state.
#
# Exit codes:
#   0 — scaffold + checks passed (mode matches --expect if given)
#   1 — at least one check failed
#   2 — bad CLI usage

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

EXPECT_MODE=""
SKIP_SCAFFOLD="no"
PROJECT_DIR_OVERRIDE=""
SCAFFOLD_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --expect)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "preflight: --expect requires a value (on|off)" >&2
        exit 2
      fi
      case "$2" in
        on|off) ;;
        *)
          echo "preflight: --expect must be 'on' or 'off' (got: $2)" >&2
          exit 2 ;;
      esac
      EXPECT_MODE="$2"; shift 2 ;;
    --expect=*)
      val="${1#--expect=}"
      case "$val" in
        on|off) ;;
        *)
          echo "preflight: --expect must be 'on' or 'off' (got: $val)" >&2
          exit 2 ;;
      esac
      EXPECT_MODE="$val"; shift ;;
    --skip-scaffold) SKIP_SCAFFOLD="yes"; shift ;;
    --dir)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "preflight: --dir requires a path value" >&2
        exit 2
      fi
      PROJECT_DIR_OVERRIDE="$2"; SCAFFOLD_ARGS+=("$1" "$2"); shift 2 ;;
    --dir=*) PROJECT_DIR_OVERRIDE="${1#--dir=}"; SCAFFOLD_ARGS+=("$1"); shift ;;
    -h|--help) sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) SCAFFOLD_ARGS+=("$1"); shift ;;
  esac
done

# If --expect on and no --workos-* flags were passed, fill them from env so
# the caller doesn't have to repeat values that are already in the shell.
has_flag() {
  local needle="$1"
  for a in ${SCAFFOLD_ARGS[@]+"${SCAFFOLD_ARGS[@]}"}; do
    case "$a" in "${needle}"|"${needle}="*) return 0 ;; esac
  done
  return 1
}
if [ "${EXPECT_MODE}" = "on" ]; then
  if ! has_flag --workos-api-key && [ -n "${WORKOS_API_KEY:-}" ]; then
    SCAFFOLD_ARGS+=(--workos-api-key "${WORKOS_API_KEY}")
  fi
  if ! has_flag --workos-client-id && [ -n "${WORKOS_CLIENT_ID:-}" ]; then
    SCAFFOLD_ARGS+=(--workos-client-id "${WORKOS_CLIENT_ID}")
  fi
  if ! has_flag --workos-organization-id && [ -n "${WORKOS_ORGANIZATION_ID:-}" ]; then
    SCAFFOLD_ARGS+=(--workos-organization-id "${WORKOS_ORGANIZATION_ID}")
  fi
fi

errors=0
err() { echo "✗ $*" >&2; errors=$((errors + 1)); }
ok()  { echo "✓ $*"; }

PROJECT_DIR=""
AUTH_MODE=""
DEFAULT_PROJECT_DIR="${HOME}/mastra-builder-smoke-tests/builder-smoke"

if [ "${SKIP_SCAFFOLD}" = "yes" ]; then
  # 1. Resolve PROJECT_DIR without running scaffold.
  PROJECT_DIR="${PROJECT_DIR_OVERRIDE:-${BUILDER_SMOKE_TEST_DIR:-$DEFAULT_PROJECT_DIR}}"
  echo "→ skip-scaffold: inspecting ${PROJECT_DIR}"
  if [ ! -d "${PROJECT_DIR}" ]; then
    err "error: project-dir-missing (${PROJECT_DIR})"
    echo
    echo "✗ Preflight failed."
    exit 1
  fi
  # Detect auth mode from the existing .env.
  if grep -qE '^[[:space:]]*AUTH_PROVIDER=workos' "${PROJECT_DIR}/.env" 2>/dev/null; then
    AUTH_MODE="on"
  else
    AUTH_MODE="off"
  fi
  ok "project: ${PROJECT_DIR} (auth mode detected from .env: ${AUTH_MODE})"
else
  # 1. Run scaffold. Capture its output so we can extract PROJECT_DIR + AUTH_MODE.
  echo "→ scaffolding builder-smoke test project"
  scaffold_out=$(bash "${SCRIPT_DIR}/scaffold.sh" ${SCAFFOLD_ARGS[@]+"${SCAFFOLD_ARGS[@]}"} 2>&1)
  scaffold_rc=$?
  echo "${scaffold_out}"
  if [ "${scaffold_rc}" -ne 0 ]; then
    err "error: scaffold-failed (rc=${scaffold_rc})"
    echo
    echo "✗ Preflight failed."
    exit 1
  fi

  PROJECT_DIR=$(echo "${scaffold_out}" | grep -E '^PROJECT_DIR=' | tail -n1 | cut -d= -f2-)
  AUTH_MODE=$(echo "${scaffold_out}" | grep -E '^AUTH_MODE=' | tail -n1 | cut -d= -f2-)
fi

if [ -z "${PROJECT_DIR}" ] || [ ! -d "${PROJECT_DIR}" ]; then
  err "error: project-dir-missing (${PROJECT_DIR:-<unset>})"
fi

# 2. Confirm project deps are installed (linked @mastra/core resolvable).
if [ ! -d "${PROJECT_DIR}/node_modules/@mastra/core" ]; then
  err "error: project-deps-missing (re-run without --reuse to install)"
else
  ok "deps: ${PROJECT_DIR}/node_modules/@mastra/core present"
fi

# 3. Confirm .env has OPENAI_API_KEY.
if grep -qE '^[[:space:]]*OPENAI_API_KEY=.+' "${PROJECT_DIR}/.env" 2>/dev/null; then
  ok "env: OPENAI_API_KEY present in ${PROJECT_DIR}/.env"
else
  err "error: openai-key-missing-in-project-env"
fi

# 4. Auth mode expectation.
if [ -n "${EXPECT_MODE}" ]; then
  case "${EXPECT_MODE}" in
    off)
      if [ "${AUTH_MODE}" = "off" ]; then
        ok "mode: off (as expected)"
      else
        err "error: mode-mismatch (expected off, scaffold produced ${AUTH_MODE})"
      fi
      ;;
    on)
      if [ "${AUTH_MODE}" = "on" ]; then
        # Also confirm all WorkOS vars landed in .env
        missing=""
        for k in AUTH_PROVIDER WORKOS_API_KEY WORKOS_CLIENT_ID WORKOS_ORGANIZATION_ID; do
          grep -qE "^[[:space:]]*${k}=.+" "${PROJECT_DIR}/.env" 2>/dev/null || missing="${missing} ${k}"
        done
        if [ -n "${missing}" ]; then
          err "error: workos-keys-missing-in-project-env (missing:${missing})"
        else
          ok "mode: on (as expected; AUTH_PROVIDER + WORKOS_* in .env)"
        fi
      else
        err "error: mode-mismatch (expected on, scaffold produced ${AUTH_MODE}; pass --workos-* flags)"
      fi
      ;;
    *)
      err "error: bad-expect-value '${EXPECT_MODE}' (use off or on)"
      ;;
  esac
fi

echo
echo "PROJECT_DIR=${PROJECT_DIR}"
echo "AUTH_MODE=${AUTH_MODE}"
echo

if [ "${errors}" -gt 0 ]; then
  echo "✗ Preflight failed: ${errors} error(s)."
  echo "  See SKILL.md → 'Detection: run preflight before each section'"
  echo "  for what each error code means and what to do."
  exit 1
fi
ok "Preflight passed."
exit 0
