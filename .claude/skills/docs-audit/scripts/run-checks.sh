#!/usr/bin/env bash
# Run deterministic docs-audit checks and capture raw output.
#
# Runs docs validation, remark lint, Vale AI lint, and a file-scoped Prettier
# check for audited docs. Outputs are written to $RUN_DIR/commands/.
#
# Run from anywhere; resolves paths relative to this script's location.
#
# Usage:
#   bash .claude/skills/docs-audit/scripts/run-checks.sh --run-dir "$RUN_DIR" --docs docs/src/content/en/reference/core/getAgentById.mdx
#   bash .claude/skills/docs-audit/scripts/run-checks.sh --run-dir "$RUN_DIR" --docs docs/a.mdx docs/b.mdx
#
# Exit codes:
#   0 — no failing check (warnings may be present)
#   1 — at least one check failed
#   2 — bad CLI usage

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
WORKTREE_ROOT="$(cd -- "${SKILL_ROOT}/../../.." && pwd)"
DOCS_DIR="$WORKTREE_ROOT/docs"

RUN_DIR=""
DOCS=()

usage() {
  sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
}

resolve_doc_for_docs_cwd() {
  local input="$1"
  local abs rel dir base

  case "$input" in
    /*) abs="$input" ;;
    *) abs="$WORKTREE_ROOT/$input" ;;
  esac
  dir="$(dirname -- "$abs")"
  base="$(basename -- "$abs")"
  if [ ! -d "$dir" ]; then
    echo "run-checks: doc directory does not exist: $dir" >&2
    return 1
  fi
  if ! dir="$(cd "$dir" && pwd -P)"; then
    echo "run-checks: failed to resolve doc directory: $dir" >&2
    return 1
  fi
  abs="$dir/$base"

  case "$abs" in
    "$DOCS_DIR"/*) rel="${abs#"$DOCS_DIR"/}" ;;
    *)
      echo "run-checks: doc must be under docs/: $input" >&2
      return 1
      ;;
  esac

  if [ ! -f "$abs" ]; then
    echo "run-checks: doc file does not exist: docs/$rel" >&2
    return 1
  fi
  printf '%s\n' "$rel"
}

run_check() {
  local name="$1"
  local outfile="$2"
  shift 2
  local exit_code

  printf '$ %s\n\n' "$*" > "$outfile"
  (
    cd "$DOCS_DIR" && "$@"
  ) >> "$outfile" 2>&1
  exit_code=$?

  if [ $exit_code -eq 0 ]; then
    printf '%s=pass\n' "$name"
    return 0
  fi

  printf '\n[docs-audit] command exited with code %s\n' "$exit_code" >> "$outfile"
  printf '%s=fail\n' "$name"
  return 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --run-dir)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "run-checks: --run-dir requires a directory" >&2
        exit 2
      fi
      RUN_DIR="$2"
      shift 2
      ;;
    --docs)
      shift
      while [ $# -gt 0 ]; do
        case "$1" in
          --*) break ;;
          *) DOCS+=("$1"); shift ;;
        esac
      done
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "run-checks: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$RUN_DIR" ]; then
  echo "run-checks: --run-dir is required" >&2
  exit 2
fi
if [ ! -d "$RUN_DIR" ]; then
  echo "run-checks: run directory does not exist: $RUN_DIR" >&2
  exit 2
fi
if [ ! -d "$DOCS_DIR" ]; then
  echo "run-checks: docs directory does not exist: $DOCS_DIR" >&2
  exit 1
fi
if [ ${#DOCS[@]} -eq 0 ]; then
  echo "run-checks: --docs requires at least one doc path" >&2
  exit 2
fi

COMMANDS_DIR="$RUN_DIR/commands"
if ! mkdir -p "$COMMANDS_DIR"; then
  echo "run-checks: failed to create commands directory: $COMMANDS_DIR" >&2
  exit 1
fi

DOCS_REL=()
for doc in "${DOCS[@]}"; do
  rel="$(resolve_doc_for_docs_cwd "$doc")" || exit 2
  DOCS_REL+=("$rel")
done

overall=0

run_check validate "$COMMANDS_DIR/validate.txt" pnpm validate || overall=1
run_check lint-remark "$COMMANDS_DIR/lint-remark.txt" pnpm lint:remark || overall=1

vale_out="$COMMANDS_DIR/lint-vale-ai.txt"
if [ ! -x "$DOCS_DIR/scripts/vale/bin/vale" ]; then
  {
    printf '$ pnpm lint:vale:ai\n\n'
    printf 'warn — vale binary missing at docs/scripts/vale/bin/vale; run pnpm vale:download or pnpm vale:sync\n'
  } > "$vale_out"
  printf 'lint-vale-ai=warn\n'
else
  run_check lint-vale-ai "$vale_out" pnpm lint:vale:ai || overall=1
fi

run_check prettier-check "$COMMANDS_DIR/prettier-check.txt" pnpm exec prettier --check "${DOCS_REL[@]}" || overall=1

if [ $overall -eq 0 ]; then
  exit 0
fi
exit 1
