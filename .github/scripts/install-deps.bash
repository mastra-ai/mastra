#!/bin/bash

# Get the base SHA from the first argument
BASE_SHA=$1

if [ -z "$BASE_SHA" ]; then
  echo "Error: Base SHA not provided"
  exit 1
fi

echo "Using base SHA: $BASE_SHA"


# Get list of changed package.json files in examples and e2e-tests directories
changed_files=$(git diff --name-only $BASE_SHA HEAD | grep -E "(examples|e2e-tests|integration-tests)/.*package.json" | grep -v "e2e-tests/.*/templates/")

echo "changed_files: $changed_files"

# For each changed package.json, run pnpm install in its directory
for package_json in $changed_files; do
  if [ -f "$(dirname "$package_json")/pnpm-lock.yaml" ]; then
    dir=$(dirname "$package_json")
    echo "Installing dependencies in $dir"
    cd "$dir"
    pnpm install --ignore-workspace --no-frozen-lockfile
    cd - > /dev/null
  fi
done

# Commit the changes if any were made
if [ -n "$(git status --porcelain)" ]; then
  git add .
  git commit -m "chore: update pnpm-lock.yaml files"
  git push
fi