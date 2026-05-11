#!/usr/bin/env bash
# Preflight for the builder-smoke-test skill.
#
# Three checks:
#   1. We're in a mastra worktree (has pnpm-workspace.yaml + examples/agent/).
#   2. examples/agent/node_modules exists.
#   3. examples/agent/.env has OPENAI_API_KEY (or it's exported in the shell).
#
# For auth-mode detection, call scripts/auth-detect.sh — preflight does NOT
# duplicate that logic. Pass --expect off|on to additionally fail when
# auth-detect reports a different mode.
#
# Run from anywhere; resolves paths relative to this script's location.
#
# Exit codes:
#   0 — all checks pass (and mode matches --expect if given)
#   1 — at least one check failed
#
# On failure, see SKILL.md "Detection: run preflight before each section"
# for the agent-facing remediation for each error code emitted below.

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../../.." && pwd)"
EXAMPLE_DIR="${REPO_ROOT}/examples/agent"

EXPECT_MODE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --expect) EXPECT_MODE="${2:-}"; shift 2 ;;
    --expect=*) EXPECT_MODE="${1#--expect=}"; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "preflight: unknown arg '$1'" >&2; exit 2 ;;
  esac
done

errors=0
err() { echo "✗ $*" >&2; errors=$((errors + 1)); }
ok()  { echo "✓ $*"; }

# 1. Repo shape
if [ ! -f "${REPO_ROOT}/pnpm-workspace.yaml" ] || [ ! -d "${EXAMPLE_DIR}" ]; then
  err "error: not-in-mastra-repo (no pnpm-workspace.yaml + examples/agent/ at ${REPO_ROOT})"
else
  ok "repo: mastra worktree at ${REPO_ROOT}"
fi

# 2. examples/agent installed
if [ ! -d "${EXAMPLE_DIR}/node_modules" ]; then
  err "error: examples-agent-not-installed (run: cd examples/agent && pnpm i --ignore-workspace)"
else
  ok "deps: examples/agent/node_modules present"
fi

# 3. OPENAI_API_KEY reachable
env_has_openai=no
if [ -f "${EXAMPLE_DIR}/.env" ] && grep -qE '^[[:space:]]*OPENAI_API_KEY=.+' "${EXAMPLE_DIR}/.env"; then
  env_has_openai=yes
fi
if [ "${env_has_openai}" = "yes" ]; then
  ok "env: OPENAI_API_KEY in examples/agent/.env"
elif [ -n "${OPENAI_API_KEY:-}" ]; then
  ok "env: OPENAI_API_KEY in shell (mastra dev will pass through since .env has no entry)"
else
  err "error: openai-key-missing"
fi

# 4. Mode expectation (delegated to auth-detect.sh)
if [ -n "${EXPECT_MODE}" ]; then
  detected=$(bash "${SCRIPT_DIR}/auth-detect.sh" 2>/dev/null || echo "mode=unknown")
  detected_mode="${detected#mode=}"
  case "${EXPECT_MODE}" in
    off)
      if [ "${detected_mode}" = "off" ]; then
        ok "mode: off (as expected)"
      else
        err "error: mode-mismatch (expected off, detected ${detected_mode})"
      fi
      ;;
    on)
      if [[ "${detected_mode}" == on:* ]]; then
        ok "mode: ${detected_mode} (as expected)"
      else
        err "error: mode-mismatch (expected on, detected ${detected_mode})"
      fi
      ;;
    *)
      err "error: bad-expect-value '${EXPECT_MODE}' (use off or on)"
      ;;
  esac
fi

echo
if [ "${errors}" -gt 0 ]; then
  echo "✗ Preflight failed: ${errors} error(s)."
  echo "  See SKILL.md → 'Detection: run preflight before each section'"
  echo "  for what each error code means and what to do."
  exit 1
fi
ok "Preflight passed."
exit 0
