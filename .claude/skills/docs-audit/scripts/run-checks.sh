#!/usr/bin/env bash
# Run deterministic docs-audit checks and capture raw output.
#
# Runs docs validation, repo-wide remark/Vale checks, target-scoped
# remark/Vale checks, and a file-scoped Prettier check for audited docs.
# Outputs are written to $RUN_DIR/commands/.
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

count_target_hits() {
  local file="$1"
  local count=0
  local doc

  if [ ! -f "$file" ]; then
    printf '0\n'
    return
  fi

  for doc in "${DOCS_REL[@]}"; do
    count=$((count + $(grep -F -- "$doc" "$file" | grep -F -v '$ ' | wc -l | tr -d ' ' || true)))
  done
  printf '%s\n' "$count"
}

validate_target_state() {
  local validate_state="$1"
  local file="$COMMANDS_DIR/validate.txt"
  local doc base

  if [ "$validate_state" = "pass" ]; then
    printf 'pass\n'
    return
  fi

  for doc in "${DOCS_REL[@]}"; do
    base="$(basename -- "$doc")"
    if grep -F -q -- "$doc" "$file" || grep -F -q -- "$base" "$file"; then
      printf 'fail\n'
      return
    fi
  done

  printf 'pass\n'
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
repo_failures=()

validate_state=pass
run_check validate "$COMMANDS_DIR/validate.txt" pnpm validate || {
  overall=1
  validate_state=fail
  repo_failures+=(validate)
}

remark_state=pass
run_check lint-remark "$COMMANDS_DIR/lint-remark.txt" pnpm lint:remark || {
  overall=1
  remark_state=fail
  repo_failures+=(remark)
}

remark_target_state=pass
run_check remark-target "$COMMANDS_DIR/remark-target.txt" pnpm exec remark --no-stdout --frail --quiet --ext mdx "${DOCS_REL[@]}" || {
  overall=1
  remark_target_state=fail
}

vale_state=pass
vale_target_state=pass
vale_target_hits=0
vale_out="$COMMANDS_DIR/lint-vale-ai.txt"
vale_target_out="$COMMANDS_DIR/vale-target.txt"
if [ ! -x "$DOCS_DIR/scripts/vale/bin/vale" ]; then
  {
    printf '$ pnpm lint:vale:ai\n\n'
    printf 'warn — vale binary missing at docs/scripts/vale/bin/vale; run pnpm vale:download or pnpm vale:sync\n'
  } > "$vale_out"
  {
    printf '$ scripts/vale/bin/vale --minAlertLevel=error --output=line %s\n\n' "${DOCS_REL[*]}"
    printf 'warn — vale binary missing at docs/scripts/vale/bin/vale; run pnpm vale:download or pnpm vale:sync\n'
  } > "$vale_target_out"
  printf 'lint-vale-ai=warn\n'
  printf 'vale-target=warn\n'
  vale_state=warn
  vale_target_state=warn
else
  run_check lint-vale-ai "$vale_out" pnpm lint:vale:ai || {
    overall=1
    vale_state=fail
    repo_failures+=(vale)
  }
  run_check vale-target "$vale_target_out" scripts/vale/bin/vale --minAlertLevel=error --output=line "${DOCS_REL[@]}" || {
    overall=1
    vale_target_state=fail
  }
  vale_target_hits="$(count_target_hits "$vale_target_out")"
fi

prettier_state=pass
run_check prettier-check "$COMMANDS_DIR/prettier-check.txt" pnpm exec prettier --check "${DOCS_REL[@]}" || {
  overall=1
  prettier_state=fail
}

validate_target_state="$(validate_target_state "$validate_state")"

repo_wide_failures="none"
if [ ${#repo_failures[@]} -gt 0 ]; then
  repo_wide_failures="$(IFS=,; printf '%s' "${repo_failures[*]}")"
fi

summary_out="$COMMANDS_DIR/summary.txt"
{
  printf 'prettier-target=%s\n' "$prettier_state"
  printf 'remark-target=%s\n' "$remark_target_state"
  printf 'vale-target=%s (%s hits)\n' "$vale_target_state" "$vale_target_hits"
  printf 'validate-target=%s\n' "$validate_target_state"
  printf 'repo-wide-failures=%s\n' "$repo_wide_failures"
} > "$summary_out"

printf 'summary written: %s\n' "$summary_out"

if [ $overall -eq 0 ]; then
  exit 0
fi
exit 1
