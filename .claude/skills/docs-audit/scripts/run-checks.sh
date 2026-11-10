#!/usr/bin/env bash
# Run narrow deterministic checks for one or more audited Mastra docs files.
# Wraps `pnpm check --format json` (docs/styleguides/CHECKS.md) and reduces its
# findings to per-target states. Read-only: never passes --fix.
#
# Run from anywhere; paths may be repository-relative or absolute.
#
# Usage:
#   bash .claude/skills/docs-audit/scripts/run-checks.sh --docs docs/src/content/en/docs/index.mdx
#   bash .claude/skills/docs-audit/scripts/run-checks.sh --docs docs/a.mdx --docs docs/b.mdx
#
# Exit codes:
#   0 — audited targets have no errors (warnings or unrelated repo-wide errors may exist)
#   1 — an audited target has an error, or the checker failed to run
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
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
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
  if [ ! -d "$dir" ] || ! dir="$(cd "$dir" && pwd -P)"; then
    echo "run-checks: doc directory does not exist: $dir" >&2
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

DOCS_REL=()
for doc in "${DOCS[@]}"; do
  rel="$(resolve_doc_for_docs_cwd "$doc")" || exit 2
  DOCS_REL+=("$rel")
done

REPORT="$(mktemp "$TMP_PARENT/docs-audit-check.XXXXXX")" || {
  echo "run-checks: failed to create temporary file" >&2
  exit 1
}
trap 'rm -f "$REPORT" "$REPORT.err"' EXIT

(cd "$DOCS_DIR" && pnpm --silent check --format json "${DOCS_REL[@]}") >"$REPORT" 2>"$REPORT.err"
check_code=$?

# pnpm check exits 0 (no errors) or 1 (errors anywhere); anything else means it did not run.
if [ "$check_code" -gt 1 ] || [ ! -s "$REPORT" ]; then
  echo "run-checks: pnpm check failed with exit code $check_code" >&2
  sed 's/^/  /' "$REPORT.err" "$REPORT" >&2
  printf 'format-target=fail\nremark-target=fail\nvale-target=fail\nvalidate-target=fail\nrepo-wide-failures=none\n'
  exit 1
fi

# Reduce the JSON report to the five-line summary contract. Findings in an audited
# file count against that target; errors elsewhere are repo-wide; errors without a
# file cannot be attributed and make validate-target=warn.
node - "$REPORT" "${DOCS_REL[@]}" <<'NODE'
const fs = require('node:fs')
const [reportPath, ...targets] = process.argv.slice(2)
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
const targetSet = new Set(targets)
const rank = { pass: 0, warn: 1, fail: 2 }
const state = { format: 'pass', remark: 'pass', vale: 'pass', validate: 'pass' }
const diagnostics = { format: [], remark: [], vale: [], validate: [] }
const repoWide = new Set()
const raise = (target, next) => {
  if (rank[next] > rank[state[target]]) state[target] = next
}

const targetFor = f => {
  if (f.ruleId === 'mastra/format') return 'format'
  if (f.ruleId.startsWith('mastra/vale-')) return 'vale'
  if (f.ruleId.startsWith('mastra/remark-') || f.category === 'structure' || f.category === 'prose') return 'remark'
  return 'validate'
}

for (const f of report.findings) {
  if (f.severity === 'info') continue
  const target = targetFor(f)
  const where = f.file ? `${f.file}${f.line ? `:${f.line}${f.column ? `:${f.column}` : ''}` : ''}` : '(no file)'
  const line = `${where} ${f.severity} ${f.ruleId}: ${f.message}${f.suggestion ? ` (${f.suggestion})` : ''}`
  if (f.file && targetSet.has(f.file)) {
    raise(target, f.severity === 'error' ? 'fail' : 'warn')
    diagnostics[target].push(line)
  } else if (f.severity === 'error') {
    if (f.file) {
      repoWide.add(target)
    } else {
      raise('validate', 'warn')
      repoWide.add('validate-ambiguous')
      diagnostics.validate.push(line)
    }
  }
}

for (const skipped of report.summary.skipped) {
  if (skipped.check.startsWith('mastra/vale')) {
    raise('vale', 'warn')
    diagnostics.vale.push(`Vale skipped: ${skipped.reason}`)
  } else {
    raise('validate', 'warn')
    diagnostics.validate.push(`${skipped.check} skipped: ${skipped.reason}`)
  }
}

for (const [target, lines] of Object.entries(diagnostics)) {
  if (lines.length === 0) continue
  console.log(`${target}-target diagnostics:`)
  for (const line of lines) console.log(`  ${line}`)
}
for (const [target, value] of Object.entries(state)) console.log(`${target}-target=${value}`)
console.log(`repo-wide-failures=${repoWide.size ? [...repoWide].join(',') : 'none'}`)
process.exit(Object.values(state).includes('fail') ? 1 : 0)
NODE
