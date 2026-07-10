#!/bin/bash
set -euo pipefail

# Get the base SHA from the first argument
BASE_SHA=${1:-}

if [ -z "$BASE_SHA" ]; then
  echo "Error: Base SHA not provided"
  exit 1
fi

echo "Using base SHA: $BASE_SHA"

# Get list of changed package.json files in examples and e2e-tests directories
changed_files=$(git diff --name-only "$BASE_SHA" HEAD | grep -E "(examples|e2e-tests|integration-tests)/.*package.json" | grep -v -E "e2e-tests/.*/templates?/" || true)

echo "changed_files: $changed_files"

# For each changed package.json, run pnpm install in its directory
for package_json in $changed_files; do
  if [ -f "$(dirname "$package_json")/pnpm-lock.yaml" ]; then
    dir=$(dirname "$package_json")
    echo "Installing dependencies in $dir"
    cd "$dir"
    if [ -f "pnpm-workspace.yaml" ]; then
      # Standalone packages with their own pnpm-workspace.yaml rely on its
      # overrides (link:...) to resolve workspace:* deps. --ignore-workspace
      # would ignore that file and break resolution.
      pnpm install --no-frozen-lockfile
    else
      pnpm install --ignore-workspace --no-frozen-lockfile
    fi
    cd - > /dev/null
  fi
done

workspace_changes=$(git status --porcelain -- ':(glob)**/pnpm-workspace.yaml')
if [ -n "$workspace_changes" ]; then
  echo "Error: pnpm install unexpectedly modified pnpm-workspace.yaml files"
  echo "$workspace_changes"
  git diff -- ':(glob)**/pnpm-workspace.yaml'
  exit 1
fi

lockfile_changes=$(git status --porcelain -- ':(glob)**/pnpm-lock.yaml')
if [ -n "$lockfile_changes" ]; then
  git add -- ':(glob)**/pnpm-lock.yaml'
  git commit -m "chore: update pnpm-lock.yaml files"
  git push
fi
