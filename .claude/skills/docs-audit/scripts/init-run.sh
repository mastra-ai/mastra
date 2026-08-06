#!/usr/bin/env bash
# Initialize a docs-audit run directory.
#
# Creates the standard temporary artifact tree used by the docs-audit skill:
#   <base>/mastra-docs-audit/<audit-slug>-<YYYYMMDD-HHMMSS>/
#     commands/
#     snapshots/original-docs/
#     snapshots/improved-docs/
#     evals/
#
# Run from anywhere; resolves paths relative to this script's location.
#
# Usage:
#   bash .claude/skills/docs-audit/scripts/init-run.sh --docs docs/src/content/en/reference/core/getAgentById.mdx
#   bash .claude/skills/docs-audit/scripts/init-run.sh --base-dir /tmp --docs docs/a.mdx docs/b.mdx
#
# Exit codes:
#   0 — run directory created and RUN_DIR=... printed
#   1 — filesystem failure
#   2 — bad CLI usage

set -uo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
WORKTREE_ROOT="$(cd -- "${SKILL_ROOT}/../../.." && pwd)"

BASE_DIR=""
DOCS=()

usage() {
  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g' \
    | cut -c 1-60 \
    | sed -E 's/-+$//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --base-dir)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "init-run: --base-dir requires a directory" >&2
        exit 2
      fi
      BASE_DIR="$2"
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
      echo "init-run: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ ${#DOCS[@]} -eq 0 ]; then
  echo "init-run: --docs requires at least one doc path" >&2
  usage >&2
  exit 2
fi

if [ -z "$BASE_DIR" ]; then
  if [ -n "${TMPDIR:-}" ]; then
    BASE_DIR="$TMPDIR"
  else
    BASE_DIR="/tmp"
  fi
fi

if ! BASE_DIR_ABS="$(mkdir -p "$BASE_DIR" && cd "$BASE_DIR" && pwd -P)"; then
  echo "init-run: failed to create or resolve base dir: $BASE_DIR" >&2
  exit 1
fi

first_doc="$(basename -- "${DOCS[0]}")"
slug="$(slugify "$first_doc")"
if [ -z "$slug" ]; then
  slug="docs-audit"
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
run_dir="$BASE_DIR_ABS/mastra-docs-audit/${slug}-${timestamp}"

if ! mkdir -p \
  "$run_dir/commands" \
  "$run_dir/snapshots/original-docs" \
  "$run_dir/snapshots/improved-docs" \
  "$run_dir/evals"; then
  echo "init-run: failed to create run directory tree: $run_dir" >&2
  exit 1
fi

printf 'RUN_DIR=%s\n' "$run_dir"
