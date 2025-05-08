# Get list of changed package.json files in examples and e2e-tests directories
changed_files=($(git diff --name-only HEAD^ HEAD | grep -E "(examples|e2e-tests)/.*package.json" | grep -v "e2e-tests/.*/templates/" | while read file; do
  if [ -f "$(dirname "$file")/pnpm-lock.yaml" ]; then
    echo "$file"
  fi
done))

# For each changed package.json, run pnpm install in its directory
for package_json in $changed_files; do
  dir=$(dirname "$package_json")
  echo "Installing dependencies in $dir"
  cd "$dir"
  pnpm install --ignore-workspace --no-frozen-lockfile
  cd - > /dev/null
done

# Commit the changes if any were made
if [ -n "$(git status --porcelain)" ]; then
  git add .
  git commit -m "chore: update pnpm-lock.yaml files"
  git push
fi