#!/usr/bin/env bash
# Format audited docs using the docs package Prettier config.
#
# Run from anywhere; resolves paths relative to this script's location and
# executes Prettier from docs/ so docs/.prettierrc and docs/.prettierignore apply.
#
# Usage:
#   bash .claude/skills/docs-audit/scripts/format-doc.sh --docs docs/src/content/en/reference/core/getAgentById.mdx
#   bash .claude/skills/docs-audit/scripts/format-doc.sh --docs docs/a.mdx docs/b.mdx
#
# Exit codes:
#   0 — formatting succeeded
#   1 — formatting failed
#   2 — bad CLI usage

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
WORKTREE_ROOT="$(cd -- "${SKILL_ROOT}/../../.." && pwd)"
DOCS_DIR="$WORKTREE_ROOT/docs"

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
  if [ ! -d "$dir" ]; then
    echo "format-doc: doc directory does not exist: $dir" >&2
    return 1
  fi
  if ! dir="$(cd "$dir" && pwd -P)"; then
    echo "format-doc: failed to resolve doc directory: $dir" >&2
    return 1
  fi
  abs="$dir/$base"

  case "$abs" in
    "$DOCS_DIR"/*) rel="${abs#"$DOCS_DIR"/}" ;;
    *)
      echo "format-doc: doc must be under docs/: $input" >&2
      return 1
      ;;
  esac

  if [ ! -f "$abs" ]; then
    echo "format-doc: doc file does not exist: docs/$rel" >&2
    return 1
  fi
  printf '%s\n' "$rel"
}

while [ $# -gt 0 ]; do
  case "$1" in
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
      echo "format-doc: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ ! -d "$DOCS_DIR" ]; then
  echo "format-doc: docs directory does not exist: $DOCS_DIR" >&2
  exit 1
fi
if [ ${#DOCS[@]} -eq 0 ]; then
  echo "format-doc: --docs requires at least one doc path" >&2
  exit 2
fi

DOCS_REL=()
for doc in "${DOCS[@]}"; do
  rel="$(resolve_doc_for_docs_cwd "$doc")" || exit 2
  DOCS_REL+=("$rel")
done

(
  cd "$DOCS_DIR" && pnpm exec prettier --write "${DOCS_REL[@]}"
)
