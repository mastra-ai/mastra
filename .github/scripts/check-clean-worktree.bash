#!/usr/bin/env bash
set -euo pipefail

if [[ -z "$(git status --short --untracked-files=all)" ]]; then
  echo "Working tree is clean after build."
  exit 0
fi

echo "Build left uncommitted changes in the working tree. Commit generated files before merging." >&2
echo >&2

echo "git status --short:" >&2
git status --short --untracked-files=all >&2

echo >&2
if ! git diff --stat --exit-code >&2; then
  echo >&2
fi

exit 1
