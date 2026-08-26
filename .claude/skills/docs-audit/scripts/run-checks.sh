#!/usr/bin/env bash
# Run narrow deterministic checks for one or more audited Mastra docs files.
#
# Run from anywhere; paths may be repository-relative or absolute.
#
# Usage:
#   bash .claude/skills/docs-audit/scripts/run-checks.sh --docs docs/src/content/en/docs/index.mdx
#   bash .claude/skills/docs-audit/scripts/run-checks.sh --docs docs/a.mdx --docs docs/b.mdx
#
# Exit codes:
#   0 — audited targets passed (warnings or proven unrelated validation failures may exist)
#   1 — an audited target or checker execution failed
#   2 — bad CLI usage

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_WORKTREE_ROOT="$(cd -- "${SKILL_ROOT}/../../.." && pwd)"
WORKTREE_ROOT="${DOCS_AUDIT_WORKTREE_ROOT:-$DEFAULT_WORKTREE_ROOT}"
DOCS_DIR="${DOCS_AUDIT_DOCS_DIR:-$WORKTREE_ROOT/docs}"
TMP_PARENT="${DOCS_AUDIT_TMP_ROOT:-${TMPDIR:-/tmp}}"
DOCS=()

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
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

run_capture() {
  local outfile="$1"
  shift
  (
    cd "$DOCS_DIR" && "$@"
  ) >"$outfile" 2>&1
}

print_diagnostics() {
  local name="$1"
  local file="$2"
  if [ -s "$file" ]; then
    printf '%s diagnostics:\n' "$name"
    sed 's/^/  /' "$file"
  fi
}

add_validation_tokens() {
  local doc="$1"
  local without_prefix="${doc#src/content/en/}"
  local family="${without_prefix%%/*}"
  local id="${without_prefix#*/}"
  local route

  id="${id%.mdx}"
  id="${id%/index}"
  if [ "$id" = "index" ]; then id=""; fi
  case "$family" in
    docs) route="${id:+/docs/$id}" ;;
    integrations) route="${id:+/integrations/$id}" ;;
    reference) route="${id:+/reference/$id}" ;;
    *) route="" ;;
  esac

  VALIDATION_TOKENS+=("$doc" "docs/$doc")
  if [ -n "$id" ]; then VALIDATION_TOKENS+=("$id"); fi
  if [ -n "$route" ]; then VALIDATION_TOKENS+=("$route"); fi
}

validation_mentions_target() {
  local file="$1"
  local token
  for token in "${VALIDATION_TOKENS[@]}"; do
    if grep -F -q -- "$token" "$file"; then return 0; fi
  done
  return 1
}

validation_has_attributed_diagnostics() {
  local file="$1"
  grep -E -q 'src/content/en/(docs|integrations|reference)/[^[:space:]]+\.mdx|\((docs|integrations|reference)?/?[[:alnum:]_.@/-]+\)|/(docs|integrations|reference)/[[:alnum:]_.@/-]+' "$file"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --docs)
      shift
      if [ $# -eq 0 ] || [[ "$1" == --* ]]; then
        echo "run-checks: --docs requires at least one doc path" >&2
        exit 2
      fi
      while [ $# -gt 0 ] && [[ "$1" != --* ]]; do
        DOCS+=("$1")
        shift
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

if [ ${#DOCS[@]} -eq 0 ]; then
  echo "run-checks: --docs requires at least one doc path" >&2
  exit 2
fi
if [ ! -d "$DOCS_DIR" ]; then
  echo "run-checks: docs directory does not exist: $DOCS_DIR" >&2
  exit 1
fi
if [ ! -d "$TMP_PARENT" ]; then
  echo "run-checks: temporary root does not exist: $TMP_PARENT" >&2
  exit 1
fi
WORKTREE_ROOT="$(cd "$WORKTREE_ROOT" && pwd -P)"
DOCS_DIR="$(cd "$DOCS_DIR" && pwd -P)"
TMP_PARENT="$(cd "$TMP_PARENT" && pwd -P)"

CHECK_DIR="$(mktemp -d "$TMP_PARENT/docs-audit-checks.XXXXXX")" || {
  echo "run-checks: failed to create temporary directory" >&2
  exit 1
}
cleanup() {
  rm -rf "$CHECK_DIR"
}
trap cleanup EXIT

DOCS_REL=()
VALIDATION_TOKENS=()
for doc in "${DOCS[@]}"; do
  rel="$(resolve_doc_for_docs_cwd "$doc")" || exit 2
  DOCS_REL+=("$rel")
  add_validation_tokens "$rel"
done

format_state=pass
remark_state=pass
vale_state=pass
validate_state=pass
repo_wide_failures=none
overall=0

format_out="$CHECK_DIR/format.txt"
run_capture "$format_out" pnpm exec oxfmt-mdx --check "${DOCS_REL[@]}"
format_code=$?
if [ "$format_code" -ne 0 ]; then
  format_state=fail
  overall=1
  print_diagnostics format-target "$format_out"
  if [ "$format_code" -eq 126 ] || [ "$format_code" -eq 127 ]; then
    printf 'format-target checker execution failed with exit code %s\n' "$format_code" >&2
  fi
fi

remark_out="$CHECK_DIR/remark.txt"
run_capture "$remark_out" pnpm exec remark --no-stdout --frail --quiet --ext mdx "${DOCS_REL[@]}"
remark_code=$?
if [ "$remark_code" -ne 0 ]; then
  remark_state=fail
  overall=1
  print_diagnostics remark-target "$remark_out"
  if [ "$remark_code" -eq 126 ] || [ "$remark_code" -eq 127 ]; then
    printf 'remark-target checker execution failed with exit code %s\n' "$remark_code" >&2
  fi
fi

vale_out="$CHECK_DIR/vale.txt"
if [ ! -x "$DOCS_DIR/scripts/vale/bin/vale" ]; then
  vale_state=warn
  printf 'vale-target diagnostics:\n  Vale binary missing at docs/scripts/vale/bin/vale; run pnpm vale:download or pnpm vale:sync\n'
else
  run_capture "$vale_out" scripts/vale/bin/vale --minAlertLevel=error --output=line "${DOCS_REL[@]}"
  vale_code=$?
  if [ "$vale_code" -ne 0 ]; then
    vale_state=fail
    overall=1
    print_diagnostics vale-target "$vale_out"
    if [ "$vale_code" -eq 126 ] || [ "$vale_code" -eq 127 ]; then
      printf 'vale-target checker execution failed with exit code %s\n' "$vale_code" >&2
    fi
  fi
fi

validate_out="$CHECK_DIR/validate.txt"
run_capture "$validate_out" pnpm validate
validate_code=$?
if [ "$validate_code" -ne 0 ]; then
  if [ "$validate_code" -eq 126 ] || [ "$validate_code" -eq 127 ]; then
    validate_state=fail
    overall=1
    print_diagnostics validate-target "$validate_out"
    printf 'validate-target checker execution failed with exit code %s\n' "$validate_code" >&2
  elif validation_mentions_target "$validate_out"; then
    validate_state=fail
    overall=1
    print_diagnostics validate-target "$validate_out"
  elif validation_has_attributed_diagnostics "$validate_out"; then
    validate_state=pass
    repo_wide_failures=validate
  else
    validate_state=warn
    repo_wide_failures=validate-ambiguous
    print_diagnostics validate-target "$validate_out"
  fi
fi

printf 'format-target=%s\n' "$format_state"
printf 'remark-target=%s\n' "$remark_state"
printf 'vale-target=%s\n' "$vale_state"
printf 'validate-target=%s\n' "$validate_state"
printf 'repo-wide-failures=%s\n' "$repo_wide_failures"

exit "$overall"
