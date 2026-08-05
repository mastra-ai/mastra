#!/usr/bin/env bash
# Run TypeScript typechecking for a docs-audit eval project.
#
# Appends the exact command, timestamp, output, and result to commands.log.
# A failed typecheck prints RESULT=failed but exits 0 because doc-caused eval
# failures are audit findings, not script execution failures.
#
# Run from anywhere; resolves paths relative to this script's location.
#
# Usage:
#   bash .claude/skills/docs-audit/scripts/eval-typecheck.sh --job-dir "$JOB_DIR"
#
# Exit codes:
#   0 — typecheck ran; RESULT=passed or RESULT=failed printed
#   1 — environment/tooling failure
#   2 — bad CLI usage

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
WORKTREE_ROOT="$(cd -- "${SKILL_ROOT}/../../.." && pwd)"

JOB_DIR=""

usage() {
  sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --job-dir)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "eval-typecheck: --job-dir requires a directory" >&2
        exit 2
      fi
      JOB_DIR="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "eval-typecheck: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$JOB_DIR" ]; then
  echo "eval-typecheck: --job-dir is required" >&2
  exit 2
fi
if [ ! -d "$JOB_DIR" ]; then
  echo "eval-typecheck: job directory does not exist: $JOB_DIR" >&2
  exit 2
fi
PROJECT_DIR="$JOB_DIR/project"
if [ ! -d "$PROJECT_DIR" ]; then
  echo "eval-typecheck: project directory does not exist: $PROJECT_DIR" >&2
  exit 2
fi
if [ ! -f "$PROJECT_DIR/tsconfig.json" ]; then
  echo "eval-typecheck: tsconfig.json missing: $PROJECT_DIR/tsconfig.json" >&2
  exit 2
fi

if [ -x "$PROJECT_DIR/node_modules/.bin/tsc" ]; then
  TSC="$PROJECT_DIR/node_modules/.bin/tsc"
elif [ -x "$WORKTREE_ROOT/node_modules/.bin/tsc" ]; then
  TSC="$WORKTREE_ROOT/node_modules/.bin/tsc"
else
  echo "eval-typecheck: no tsc binary found in eval project or worktree node_modules" >&2
  exit 1
fi

LOG="$JOB_DIR/commands.log"
{
  printf '\n# %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf 'pwd: %s\n' "$PROJECT_DIR"
  printf '$ %s -p tsconfig.json --noEmit\n\n' "$TSC"
} >> "$LOG"

(
  cd "$PROJECT_DIR" && "$TSC" -p tsconfig.json --noEmit
) >> "$LOG" 2>&1
code=$?

if [ $code -eq 0 ]; then
  printf 'RESULT=passed\n'
  printf '\n[docs-audit] RESULT=passed\n' >> "$LOG"
else
  printf 'RESULT=failed\n'
  printf '\n[docs-audit] RESULT=failed exit_code=%s\n' "$code" >> "$LOG"
fi

exit 0
