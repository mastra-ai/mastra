#!/usr/bin/env bash
# Preflight environment detector for the builder-smoke-test skill.
#
# This script ONLY DETECTS state. It never edits files, never sources rc files,
# never copies values from shell to .env. When something is wrong it prints a
# clear diagnosis and exits non-zero — the agent decides whether to ask the user
# to fix it manually or to do a targeted .env edit on the user's behalf.
#
# Background: `mastra dev` loads examples/agent/.env via dotenv and unconditionally
# overwrites process.env with those values (packages/cli/src/commands/dev/dev.ts).
# That means:
#   - Inline `FOO=bar pnpm mastra:dev` is silently clobbered if FOO is in .env.
#   - Shell-only env vars survive into the child ONLY if .env doesn't redefine them.
#   - examples/agent/.env is therefore the source of truth for the running server.
#
# Usage:
#   bash scripts/preflight.sh                  # detect-only, no mode expectation
#   bash scripts/preflight.sh --expect off     # expect auth-off mode
#   bash scripts/preflight.sh --expect on      # expect auth-on (WorkOS) mode
#
# Exit codes:
#   0 — required vars present AND (no --expect given OR detected mode matches)
#   1 — required vars missing, or shell/.env collision, or mode mismatch

set -uo pipefail

EXPECT_MODE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --expect)
      EXPECT_MODE="${2:-}"
      shift 2
      ;;
    --expect=*)
      EXPECT_MODE="${1#--expect=}"
      shift
      ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      echo "preflight.sh: unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [ -n "${EXPECT_MODE}" ] && [ "${EXPECT_MODE}" != "off" ] && [ "${EXPECT_MODE}" != "on" ]; then
  echo "preflight.sh: --expect must be 'off' or 'on', got '${EXPECT_MODE}'" >&2
  exit 2
fi

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../../.." && pwd)"
EXAMPLE_DIR="${REPO_ROOT}/examples/agent"
EXAMPLE_ENV="${EXAMPLE_DIR}/.env"

# Repo-shape sanity check. The skill operates on this checkout — unlike the
# smoke-test skill it does NOT scaffold a new project. Refuse to run from the
# wrong tree so we don't silently chase phantom paths.
if [ ! -f "${REPO_ROOT}/pnpm-workspace.yaml" ] || [ ! -f "${EXAMPLE_DIR}/package.json" ]; then
  echo "✗ Preflight: repo shape doesn't look like the mastra monorepo."
  echo "  Expected pnpm-workspace.yaml and examples/agent/package.json under:"
  echo "    ${REPO_ROOT}"
  echo "  cd into your mastra worktree before running this skill."
  exit 1
fi

# Workspace install check. examples/agent uses link: overrides to ../../packages/*
# so it MUST be installed with --ignore-workspace (per AGENTS.md). A missing
# node_modules here means the dev server will fail with module-resolution errors
# long before any HTTP probe.
if [ ! -d "${EXAMPLE_DIR}/node_modules" ]; then
  echo "✗ Preflight: examples/agent/node_modules is missing."
  echo "  examples/agent pins to local packages via link: overrides and must be"
  echo "  installed standalone:"
  echo
  echo "    cd ${EXAMPLE_DIR#${REPO_ROOT}/}"
  echo "    pnpm i --ignore-workspace"
  echo
  echo "  Do NOT run pnpm install from the repo root for this example — the"
  echo "  workspace resolver will replace the link: overrides."
  exit 1
fi

# --- helpers ------------------------------------------------------------------

# Returns 0 if VAR is set in the current shell (exported or otherwise present
# in this script's process env), 1 otherwise.
in_shell() {
  [ -n "${!1:-}" ]
}

# Returns 0 if VAR has a non-empty uncommented assignment in .env.
# Prints the raw value (with quotes stripped) on stdout.
in_envfile() {
  local name="$1"
  local file="${2:-${EXAMPLE_ENV}}"
  [ -f "${file}" ] || return 1
  local line
  # Match `NAME=...` not preceded by `#`. We do NOT strip leading whitespace
  # before `#` — a commented entry like `# AUTH_PROVIDER=workos` is treated as
  # absent, which is exactly what dotenv does.
  line=$(grep -E "^[[:space:]]*${name}=" "${file}" | head -n1 || true)
  [ -n "${line}" ] || return 1
  local val="${line#*=}"
  # Strip surrounding single or double quotes.
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  [ -n "${val}" ] || return 1
  printf '%s' "${val}"
}

# --- env table ----------------------------------------------------------------
#
# We track each var's presence in (a) the shell and (b) examples/agent/.env
# separately. This is the only way to detect the gotchas:
#   - var only in shell, but .env has empty `VAR=` → mastra dev will clobber it
#   - AUTH_PROVIDER set in shell but absent from .env → mode ambiguous
#   - AUTH_PROVIDER value differs between shell and .env → .env wins

ALWAYS_REQUIRED=("OPENAI_API_KEY")
WORKOS_VARS=("AUTH_PROVIDER" "WORKOS_API_KEY" "WORKOS_CLIENT_ID" "WORKOS_ORGANIZATION_ID")
INFORMATIONAL=("ANTHROPIC_API_KEY" "WORKOS_COOKIE_PASSWORD" "WORKOS_REDIRECT_URI" "BROWSERBASE_API_KEY" "BROWSERBASE_PROJECT_ID")

shell_has=()
envfile_has=()
envfile_value=()

snapshot_var() {
  local v="$1"
  local s_has="no" e_has="no" e_val=""
  in_shell "$v" && s_has="yes"
  if e_val=$(in_envfile "$v"); then e_has="yes"; fi
  shell_has+=("${v}=${s_has}")
  envfile_has+=("${v}=${e_has}")
  envfile_value+=("${v}=${e_val}")
}

get_field() {
  # get_field VAR ARRAY_NAME  → echoes the trailing value for VAR=...
  local name="$1"; shift
  local arr_name="$1"; shift
  local entry
  eval "for entry in \"\${${arr_name}[@]}\"; do
    case \"\$entry\" in
      ${name}=*) printf '%s' \"\${entry#${name}=}\"; return 0 ;;
    esac
  done"
  return 1
}

ALL_TRACKED=("${ALWAYS_REQUIRED[@]}" "${WORKOS_VARS[@]}" "${INFORMATIONAL[@]}")
for v in "${ALL_TRACKED[@]}"; do snapshot_var "$v"; done

# --- print status table -------------------------------------------------------

print_row() {
  local v="$1"
  local s e val display_src
  s=$(get_field "$v" shell_has)
  e=$(get_field "$v" envfile_has)
  val=$(get_field "$v" envfile_value)
  if [ "$e" = "yes" ]; then
    display_src=".env"
  elif [ "$s" = "yes" ]; then
    display_src="shell-only ⚠"
  else
    display_src="— unset"
  fi
  printf '  %-28s %s\n' "$v" "$display_src"
}

echo "Preflight: examples/agent/.env is the source of truth for mastra dev."
echo "(Shell-only vars are listed for awareness but will NOT reach the server"
echo " unless they're also in .env or .env has no entry for the same key.)"
echo
echo "Required (always):"
for v in "${ALWAYS_REQUIRED[@]}"; do print_row "$v"; done
echo
echo "WorkOS (required only when --expect on):"
for v in "${WORKOS_VARS[@]}"; do print_row "$v"; done
echo
echo "Informational:"
for v in "${INFORMATIONAL[@]}"; do print_row "$v"; done
echo

# --- detection logic ----------------------------------------------------------

errors=0
warnings=0

err() { echo "✗ $*"; errors=$((errors + 1)); }
warn() { echo "⚠ $*"; warnings=$((warnings + 1)); }

# 1. OPENAI_API_KEY must be reachable by the server.
oa_shell=$(get_field OPENAI_API_KEY shell_has)
oa_env=$(get_field OPENAI_API_KEY envfile_has)
if [ "$oa_env" != "yes" ] && [ "$oa_shell" != "yes" ]; then
  err "OPENAI_API_KEY is not set in examples/agent/.env nor in the current shell."
  echo "    The server crashes at boot inside OpenAIVoice without it."
  echo "    Ask the user to either add it to examples/agent/.env or export it"
  echo "    in their shell, then re-run preflight."
elif [ "$oa_env" != "yes" ] && [ "$oa_shell" = "yes" ]; then
  warn "OPENAI_API_KEY is only in the shell, not in examples/agent/.env."
  echo "    This works only if .env has no OPENAI_API_KEY= line at all."
  echo "    If .env has an empty 'OPENAI_API_KEY=' line, mastra dev will overwrite"
  echo "    your shell value with empty and the server will crash. Ask the user"
  echo "    to confirm .env has no such line, or to copy the value into .env."
fi

# 2. AUTH_PROVIDER shell-vs-.env collision detection.
ap_shell_val="${AUTH_PROVIDER:-}"
ap_env_val=$(get_field AUTH_PROVIDER envfile_value)
ap_env_present=$(get_field AUTH_PROVIDER envfile_has)

if [ "$ap_env_present" = "yes" ]; then
  detected_mode="on:${ap_env_val}"
elif [ -n "$ap_shell_val" ]; then
  detected_mode="ambiguous"
else
  detected_mode="off"
fi

if [ "$detected_mode" = "ambiguous" ]; then
  err "AUTH_PROVIDER is set in your shell ('${ap_shell_val}') but absent from examples/agent/.env."
  echo "    mastra dev only reads from .env, so the running server has no auth"
  echo "    provider — but the shell value will leak into anything else you run."
  echo "    Ask the user to either:"
  echo "      (a) unset AUTH_PROVIDER in this shell (\`unset AUTH_PROVIDER\`), or"
  echo "      (b) add AUTH_PROVIDER=<value> to examples/agent/.env to make it explicit."
fi

# 3. If shell AND .env both have AUTH_PROVIDER, warn if they disagree.
if [ -n "$ap_shell_val" ] && [ "$ap_env_present" = "yes" ] && [ "$ap_shell_val" != "$ap_env_val" ]; then
  warn "AUTH_PROVIDER differs between shell ('${ap_shell_val}') and .env ('${ap_env_val}')."
  echo "    .env wins for the running server. Heads-up only — no action needed"
  echo "    if you intended this."
fi

# 4. Mode expectation cross-check.
if [ -n "${EXPECT_MODE}" ]; then
  case "$detected_mode" in
    off)
      effective_mode="off"
      ;;
    on:workos)
      effective_mode="on"
      ;;
    on:*)
      effective_mode="on-other"
      ;;
    ambiguous)
      effective_mode="ambiguous"
      ;;
  esac

  echo
  echo "Detected mode: ${detected_mode}    Expected: ${EXPECT_MODE}"

  if [ "${EXPECT_MODE}" = "off" ] && [ "${effective_mode}" != "off" ]; then
    err "Expected auth-off mode, but examples/agent/.env has AUTH_PROVIDER=${ap_env_val:-${ap_shell_val}}."
    echo "    Ask the user to comment out (or delete) the AUTH_PROVIDER line in"
    echo "    examples/agent/.env. Restart mastra dev afterwards. Then re-run"
    echo "    preflight --expect off."
  fi

  if [ "${EXPECT_MODE}" = "on" ]; then
    if [ "${effective_mode}" = "off" ]; then
      err "Expected auth-on mode, but examples/agent/.env has no AUTH_PROVIDER."
      echo "    Ask the user to add 'AUTH_PROVIDER=workos' to examples/agent/.env,"
      echo "    along with WorkOS credentials (see below). Restart mastra dev,"
      echo "    then re-run preflight --expect on."
    elif [ "${effective_mode}" = "on-other" ]; then
      warn "Expected auth-on (WorkOS), but AUTH_PROVIDER='${ap_env_val}' selects a different provider."
      echo "    This skill's auth-on test paths assume WorkOS specifically."
      echo "    Ask the user whether to switch to AUTH_PROVIDER=workos for this run."
    elif [ "${effective_mode}" = "on" ]; then
      missing_workos=()
      for w in WORKOS_API_KEY WORKOS_CLIENT_ID WORKOS_ORGANIZATION_ID; do
        if [ "$(get_field "$w" envfile_has)" != "yes" ]; then
          missing_workos+=("$w")
        fi
      done
      if [ ${#missing_workos[@]} -gt 0 ]; then
        err "AUTH_PROVIDER=workos but these WorkOS vars are missing from examples/agent/.env:"
        for m in "${missing_workos[@]}"; do echo "      - $m"; done
        echo "    Ask the user to add them to examples/agent/.env, or to dictate"
        echo "    the values to you for a targeted edit. Restart mastra dev,"
        echo "    then re-run preflight --expect on."
      fi
    fi
  fi
fi

echo
if [ "$errors" -gt 0 ]; then
  echo "✗ Preflight failed: ${errors} error(s), ${warnings} warning(s)."
  echo "  See messages above — each one names a concrete action the user (or you,"
  echo "  with their explicit consent) should take. Do NOT auto-edit .env without"
  echo "  the user telling you to."
  exit 1
fi

if [ "$warnings" -gt 0 ]; then
  echo "✓ Preflight passed with ${warnings} warning(s). Review them before proceeding."
else
  echo "✓ Preflight passed."
fi
exit 0
