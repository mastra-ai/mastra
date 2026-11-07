#!/usr/bin/env bash
# Works out which commits a Prebuild run compares and whether it touches code. Shared by the
# `changes` job and `affected-tests`, so the affected-test detection can start at the same time
# as everything else instead of waiting for `changes`.
#
# Env: GITHUB_EVENT_NAME, GITHUB_OUTPUT, BASE_REF, PR_BASE_SHA, HEAD_SHA, FULL_SUITE.
# Writes head_sha, base_sha, full_suite and has_code to $GITHUB_OUTPUT. Needs a checkout with
# history (a blobless clone is enough: name-only diffs read trees, not blobs).
set -euo pipefail

echo "head_sha=$HEAD_SHA" >> "$GITHUB_OUTPUT"
echo "full_suite=$FULL_SUITE" >> "$GITHUB_OUTPUT"

# A stacked PR merges into another PR's branch, but its code ends up on main, so
# diff it against main to select the same tests the stack will need there.
BASE_SHA=$PR_BASE_SHA
if [ "$GITHUB_EVENT_NAME" = "pull_request" ] && [ "$BASE_REF" != "main" ] && [ "$BASE_REF" != "0.x" ]; then
  BASE_SHA=$(git merge-base origin/main "$HEAD_SHA")
  echo "Stacked on $BASE_REF; diffing against main at $BASE_SHA."
fi
echo "base_sha=$BASE_SHA" >> "$GITHUB_OUTPUT"

if [ "$FULL_SUITE" = "true" ]; then
  echo "Full suite requested; running Prebuild."
  echo "has_code=true" >> "$GITHUB_OUTPUT"
  exit 0
fi

if ! changed_files=$(git diff --name-only "$BASE_SHA...$HEAD_SHA"); then
  echo "Could not diff the PR; running affected tests fail-closed."
  echo "has_code=true" >> "$GITHUB_OUTPUT"
  exit 0
fi

code_files=$(printf '%s\n' "$changed_files" \
  | grep -vE '^(docs/|examples/|\.changeset/|explorations/)' \
  | grep -v '^$' || true)
if [ -n "$code_files" ]; then
  echo "Code changes found; running affected tests."
  echo "has_code=true" >> "$GITHUB_OUTPUT"
else
  echo "Only docs, examples, changesets or explorations changed; skipping Prebuild."
  echo "has_code=false" >> "$GITHUB_OUTPUT"
fi
