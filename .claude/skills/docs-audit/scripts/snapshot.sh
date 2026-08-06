#!/usr/bin/env bash
# Copy audited docs into a docs-audit snapshot stage.
#
# Copies repository-local doc files into:
#   $RUN_DIR/snapshots/original-docs/
# or:
#   $RUN_DIR/snapshots/improved-docs/
# preserving each file's repository-relative path.
#
# Run from anywhere; resolves paths relative to this script's location.
#
# Usage:
#   bash .claude/skills/docs-audit/scripts/snapshot.sh --run-dir "$RUN_DIR" --stage original --docs docs/src/content/en/reference/core/getAgentById.mdx
#   bash .claude/skills/docs-audit/scripts/snapshot.sh --run-dir "$RUN_DIR" --stage improved --docs docs/a.mdx docs/b.mdx
#
# Exit codes:
#   0 — snapshot copied and SNAPSHOT_DIR=... printed
#   1 — copy or filesystem failure
#   2 — bad CLI usage

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
WORKTREE_ROOT="$(cd -- "${SKILL_ROOT}/../../.." && pwd)"

RUN_DIR=""
STAGE=""
DOCS=()

usage() {
  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
}

resolve_doc() {
  local input="$1"
  local abs rel dir base

  case "$input" in
    /*) abs="$input" ;;
    *) abs="$WORKTREE_ROOT/$input" ;;
  esac

  dir="$(dirname -- "$abs")"
  base="$(basename -- "$abs")"
  if [ ! -d "$dir" ]; then
    echo "snapshot: doc directory does not exist: $dir" >&2
    return 1
  fi
  if ! dir="$(cd "$dir" && pwd -P)"; then
    echo "snapshot: failed to resolve doc directory: $dir" >&2
    return 1
  fi
  abs="$dir/$base"

  case "$abs" in
    "$WORKTREE_ROOT"/*) rel="${abs#"$WORKTREE_ROOT"/}" ;;
    *)
      echo "snapshot: refusing path outside worktree: $input" >&2
      return 1
      ;;
  esac

  if [ ! -f "$abs" ]; then
    echo "snapshot: doc file does not exist: $rel" >&2
    return 1
  fi

  printf '%s\t%s\n' "$abs" "$rel"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --run-dir)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "snapshot: --run-dir requires a directory" >&2
        exit 2
      fi
      RUN_DIR="$2"
      shift 2
      ;;
    --stage)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "snapshot: --stage requires original|improved" >&2
        exit 2
      fi
      STAGE="$2"
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
      echo "snapshot: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$RUN_DIR" ]; then
  echo "snapshot: --run-dir is required" >&2
  exit 2
fi
if [ ! -d "$RUN_DIR" ]; then
  echo "snapshot: run directory does not exist: $RUN_DIR" >&2
  exit 2
fi
case "$STAGE" in
  original|improved) ;;
  *)
    echo "snapshot: --stage must be original or improved" >&2
    exit 2
    ;;
esac
if [ ${#DOCS[@]} -eq 0 ]; then
  echo "snapshot: --docs requires at least one doc path" >&2
  exit 2
fi

target_dir="$RUN_DIR/snapshots/${STAGE}-docs"
if ! mkdir -p "$target_dir"; then
  echo "snapshot: failed to create snapshot directory: $target_dir" >&2
  exit 1
fi

count=0
for doc in "${DOCS[@]}"; do
  resolved="$(resolve_doc "$doc")" || exit 1
  abs="${resolved%%$'\t'*}"
  rel="${resolved#*$'\t'}"
  dest="$target_dir/$rel"
  if ! mkdir -p "$(dirname -- "$dest")"; then
    echo "snapshot: failed to create destination directory for: $rel" >&2
    exit 1
  fi
  if ! cp "$abs" "$dest"; then
    echo "snapshot: failed to copy $rel" >&2
    exit 1
  fi
  count=$((count + 1))
done

printf 'SNAPSHOT_DIR=%s\n' "$target_dir"
printf 'SNAPSHOT_COUNT=%s\n' "$count"
