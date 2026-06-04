#!/usr/bin/env bash
# Scaffold a clean, hermetic builder-smoke-test project at $PROJECT_DIR,
# linked against the current mastra worktree so it exercises in-tree code.
#
# Project dir resolution (first wins):
#   1. --dir <path> flag
#   2. $BUILDER_SMOKE_TEST_DIR env var
#   3. ~/mastra-builder-smoke-tests/builder-smoke  (default)
#
# What this does:
#   1. Resolve the mastra worktree root from this script's location.
#      The script lives at <worktree>/.claude/skills/builder-smoke-test/scripts/scaffold.sh
#      so the worktree root is four levels up.
#   2. Create $PROJECT_DIR (unless --reuse is passed and it already exists and is healthy).
#   3. Copy templates from .../builder-smoke-test/assets/template/ into $PROJECT_DIR.
#   4. Render package.json with link:<worktree>/... overrides for all @mastra/* deps.
#   5. Render .env: OPENAI_API_KEY (from --openai-key, $OPENAI_API_KEY, or prompt).
#      If --workos-* flags are passed, write AUTH_PROVIDER=workos and WORKOS_* keys.
#   6. Run `pnpm install --ignore-workspace` inside $PROJECT_DIR.
#   7. Print PROJECT_DIR=... AUTH_MODE=on|off for downstream scripts.
#
# Usage:
#   bash scaffold.sh                                  # auth off, prompt for openai key
#   bash scaffold.sh --reuse                          # skip install if project already healthy
#   bash scaffold.sh --dir /custom/path               # use a custom project dir
#   BUILDER_SMOKE_TEST_DIR=/custom/path bash scaffold.sh  # via env var
#   bash scaffold.sh --openai-key sk-...              # supply key inline
#   bash scaffold.sh \
#     --workos-api-key sk_test_... \
#     --workos-client-id client_... \
#     --workos-organization-id org_...                # auth on
#
# Exit codes:
#   0 — scaffold complete (or reused), printed PROJECT_DIR=... AUTH_MODE=...
#   1 — failed; stderr explains which step

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
WORKTREE_ROOT="$(cd -- "${SKILL_ROOT}/../../.." && pwd)"
TEMPLATE_DIR="${SKILL_ROOT}/assets/template"
DEFAULT_PROJECT_DIR="${HOME}/mastra-builder-smoke-tests/builder-smoke"

PROJECT_DIR=""
REUSE="no"
OPENAI_KEY="${OPENAI_API_KEY:-}"
WORKOS_API_KEY=""
WORKOS_CLIENT_ID=""
WORKOS_ORG_ID=""

usage() {
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) PROJECT_DIR="${2:-}"; shift 2 ;;
    --dir=*) PROJECT_DIR="${1#--dir=}"; shift ;;
    --reuse) REUSE="yes"; shift ;;
    --openai-key) OPENAI_KEY="${2:-}"; shift 2 ;;
    --openai-key=*) OPENAI_KEY="${1#--openai-key=}"; shift ;;
    --workos-api-key) WORKOS_API_KEY="${2:-}"; shift 2 ;;
    --workos-api-key=*) WORKOS_API_KEY="${1#--workos-api-key=}"; shift ;;
    --workos-client-id) WORKOS_CLIENT_ID="${2:-}"; shift 2 ;;
    --workos-client-id=*) WORKOS_CLIENT_ID="${1#--workos-client-id=}"; shift ;;
    --workos-organization-id) WORKOS_ORG_ID="${2:-}"; shift 2 ;;
    --workos-organization-id=*) WORKOS_ORG_ID="${1#--workos-organization-id=}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "scaffold: unknown arg '$1'" >&2; exit 2 ;;
  esac
done

# Resolve project dir: --dir flag > BUILDER_SMOKE_TEST_DIR env > default.
PROJECT_DIR="${PROJECT_DIR:-${BUILDER_SMOKE_TEST_DIR:-$DEFAULT_PROJECT_DIR}}"

# 1. Verify worktree root looks like a mastra worktree.
if [ ! -f "${WORKTREE_ROOT}/pnpm-workspace.yaml" ] || [ ! -d "${WORKTREE_ROOT}/packages/core" ]; then
  echo "✗ scaffold: not a mastra worktree at ${WORKTREE_ROOT} (missing pnpm-workspace.yaml or packages/core)" >&2
  exit 1
fi
echo "✓ worktree: ${WORKTREE_ROOT}"

# 2. Verify template dir exists.
if [ ! -d "${TEMPLATE_DIR}" ]; then
  echo "✗ scaffold: template dir missing at ${TEMPLATE_DIR}" >&2
  exit 1
fi

# 3. Decide auth mode from WorkOS flags.
AUTH_MODE="off"
if [ -n "${WORKOS_API_KEY}" ] || [ -n "${WORKOS_CLIENT_ID}" ] || [ -n "${WORKOS_ORG_ID}" ]; then
  if [ -z "${WORKOS_API_KEY}" ] || [ -z "${WORKOS_CLIENT_ID}" ] || [ -z "${WORKOS_ORG_ID}" ]; then
    echo "✗ scaffold: when enabling auth, all three of --workos-api-key, --workos-client-id, --workos-organization-id are required" >&2
    exit 1
  fi
  AUTH_MODE="on"
fi
echo "✓ auth mode: ${AUTH_MODE}"

# 4. Resolve OPENAI key if not provided. Prompt fails fast in non-interactive contexts.
if [ -z "${OPENAI_KEY}" ]; then
  if [ -t 0 ]; then
    printf "Enter OPENAI_API_KEY (or press Enter to abort): " >&2
    read -r OPENAI_KEY
  fi
fi
if [ -z "${OPENAI_KEY}" ]; then
  echo "✗ scaffold: OPENAI_API_KEY missing (pass --openai-key, export OPENAI_API_KEY, or supply at prompt)" >&2
  exit 1
fi
echo "✓ openai key: present"

# 5. Detect reuse path.
needs_install="yes"
if [ "${REUSE}" = "yes" ] && [ -d "${PROJECT_DIR}/node_modules/@mastra/core" ] && [ -f "${PROJECT_DIR}/package.json" ]; then
  echo "✓ reusing existing project at ${PROJECT_DIR}"
  needs_install="no"
fi

# 6. Create project dir if needed.
mkdir -p "${PROJECT_DIR}/src/mastra/agents" \
         "${PROJECT_DIR}/src/mastra/tools" \
         "${PROJECT_DIR}/src/mastra/workflows" \
         "${PROJECT_DIR}/src/mastra/public"

# 7. Render templates. Template files use the literal token __WORKTREE_ROOT__
#    which we substitute for the absolute worktree path so pnpm link: paths resolve.
render() {
  local src="$1" dst="$2"
  sed -e "s#__WORKTREE_ROOT__#${WORKTREE_ROOT}#g" "${src}" > "${dst}"
}

render "${TEMPLATE_DIR}/package.json" "${PROJECT_DIR}/package.json"
render "${TEMPLATE_DIR}/tsconfig.json" "${PROJECT_DIR}/tsconfig.json"
render "${TEMPLATE_DIR}/src/mastra/index.ts" "${PROJECT_DIR}/src/mastra/index.ts"
render "${TEMPLATE_DIR}/src/mastra/auth.ts" "${PROJECT_DIR}/src/mastra/auth.ts"
render "${TEMPLATE_DIR}/src/mastra/agents/index.ts" "${PROJECT_DIR}/src/mastra/agents/index.ts"
render "${TEMPLATE_DIR}/src/mastra/tools/index.ts" "${PROJECT_DIR}/src/mastra/tools/index.ts"
render "${TEMPLATE_DIR}/src/mastra/workflows/index.ts" "${PROJECT_DIR}/src/mastra/workflows/index.ts"

# 8. Render .env. We always write it fresh so prior runs can't poison the next.
{
  echo "# Generated by .claude/skills/builder-smoke-test/scripts/scaffold.sh"
  echo "OPENAI_API_KEY=${OPENAI_KEY}"
  if [ "${AUTH_MODE}" = "on" ]; then
    # Derive a stable cookie password from the project dir so sessions survive
    # `mastra dev` restarts within the same scaffolded project. 64 hex chars.
    cookie_password="$(printf '%s' "mastra-builder-smoke:${PROJECT_DIR}" | shasum -a 256 | awk '{print $1}')"
    echo "AUTH_PROVIDER=workos"
    echo "WORKOS_API_KEY=${WORKOS_API_KEY}"
    echo "WORKOS_CLIENT_ID=${WORKOS_CLIENT_ID}"
    echo "WORKOS_ORGANIZATION_ID=${WORKOS_ORG_ID}"
    echo "WORKOS_REDIRECT_URI=http://localhost:4111/api/auth/callback"
    echo "WORKOS_COOKIE_PASSWORD=${cookie_password}"
    # Enable the smoke-test cookie leak route. The route is opt-in and only
    # mounted when this is set at `mastra dev` boot time. Required by
    # references/auth.md step 0 (cookie extraction for curl).
    echo "SMOKE_TEST_COOKIE_LEAK=1"
  fi
} > "${PROJECT_DIR}/.env"
chmod 600 "${PROJECT_DIR}/.env"
echo "✓ wrote .env"

# 9. Install deps.
if [ "${needs_install}" = "yes" ]; then
  echo "→ pnpm install --ignore-workspace (this can take ~30-90s)"
  if ! pushd "${PROJECT_DIR}" >/dev/null; then
    echo "✗ scaffold: could not cd into ${PROJECT_DIR}" >&2
    exit 1
  fi
  if ! pnpm install --ignore-workspace 2>&1; then
    popd >/dev/null || true
    echo "✗ scaffold: pnpm install failed in ${PROJECT_DIR}" >&2
    exit 1
  fi
  popd >/dev/null || true
  echo "✓ install complete"
fi

# 10. Emit the variables downstream scripts need.
echo
echo "PROJECT_DIR=${PROJECT_DIR}"
echo "WORKTREE_ROOT=${WORKTREE_ROOT}"
echo "AUTH_MODE=${AUTH_MODE}"
exit 0
