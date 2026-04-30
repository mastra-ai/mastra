#!/bin/bash
#
# Spot check a Changesets versioning PR before an alpha release.
#
# Usage:
#   ./check-versioning-pr.sh <pr-number> [--workspace <dir>]
#
# Examples:
#   ./check-versioning-pr.sh 15857
#   ./check-versioning-pr.sh 15857 --workspace ~/mastra-smoke-tests/2026-04-28

set -euo pipefail

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required dependency '$1' is not installed." >&2
    exit 1
  fi
}

PR_NUMBER=""
WORKSPACE="$HOME/mastra-smoke-tests/$(date +%F)"

while [ $# -gt 0 ]; do
  case "$1" in
    --workspace)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "Error: --workspace requires a value." >&2
        exit 1
      fi
      WORKSPACE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -z "$PR_NUMBER" ]; then
        PR_NUMBER="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        echo "" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if [ -z "$PR_NUMBER" ]; then
  usage >&2
  exit 1
fi

require_cmd gh
require_cmd python3

LOG_DIR="$WORKSPACE/logs"
mkdir -p "$LOG_DIR"

FILES_PATH="$LOG_DIR/pr-$PR_NUMBER-files.txt"
DIFF_PATH="$LOG_DIR/pr-$PR_NUMBER-full.diff"
SUMMARY_PATH="$LOG_DIR/pr-$PR_NUMBER-version-summary.tsv"

printf 'Checking PR #%s\n' "$PR_NUMBER"
printf 'Workspace: %s\n\n' "$WORKSPACE"

gh pr diff "$PR_NUMBER" --name-only > "$FILES_PATH"
gh pr diff "$PR_NUMBER" > "$DIFF_PATH"

python3 - "$FILES_PATH" "$DIFF_PATH" "$SUMMARY_PATH" <<'PY'
import pathlib
import re
import sys

files_path = pathlib.Path(sys.argv[1])
diff_path = pathlib.Path(sys.argv[2])
summary_path = pathlib.Path(sys.argv[3])

files = [line.strip() for line in files_path.read_text().splitlines() if line.strip()]
diff = diff_path.read_text(errors="ignore")
diff = re.sub(r"\x1b\[[0-9;]*m", "", diff)

version_rows = []
current = None
old = None
new = None

for line in diff.splitlines():
    match = re.match(r"diff --git a/(.*?package\.json) b/(.*?package\.json)", line)
    if match:
        if current and (old or new):
            version_rows.append((current, old or "", new or ""))
        current = match.group(1)
        old = None
        new = None
        continue

    if current:
        old_match = re.match(r'-\s+"version": "([^"]+)"', line)
        new_match = re.match(r'\+\s+"version": "([^"]+)"', line)
        if old_match:
            old = old_match.group(1)
        if new_match:
            new = new_match.group(1)

if current and (old or new):
    version_rows.append((current, old or "", new or ""))

changelog_versions = []
for line in diff.splitlines():
    match = re.match(r"\+## ([^\s]+)", line)
    if match:
        changelog_versions.append(match.group(1))

non_release_files = [
    f
    for f in files
    if not (
        f == ".changeset/pre.json"
        or f == "package.json"
        or f == "CHANGELOG.md"
        or f.endswith("/package.json")
        or f.endswith("/CHANGELOG.md")
    )
]

major_bumps = []
non_alpha_new_versions = []
stable_to_alpha = []

semver_re = re.compile(r"^(\d+)\.(\d+)\.(\d+)(-.+)?$")
for package_file, old_version, new_version in version_rows:
    old_match = semver_re.match(old_version)
    new_match = semver_re.match(new_version)
    if old_match and new_match:
        old_major = int(old_match.group(1))
        new_major = int(new_match.group(1))
        if new_major > old_major:
            major_bumps.append((package_file, old_version, new_version))
    if new_version and "-alpha." not in new_version:
        non_alpha_new_versions.append((package_file, old_version, new_version))
    if old_version and "-" not in old_version and "-alpha." in new_version:
        stable_to_alpha.append((package_file, old_version, new_version))

with summary_path.open("w") as f:
    f.write("package_json\told_version\tnew_version\n")
    for row in version_rows:
        f.write("\t".join(row) + "\n")

print("Changed files:", len(files))
print("Package version changes:", len(version_rows))
print("Changelog version headings:", len(changelog_versions))
print("Non release/version files:", len(non_release_files))
print("Major version bumps:", len(major_bumps))
print("New versions without -alpha:", len(non_alpha_new_versions))
print("Stable -> alpha transitions:", len(stable_to_alpha))
print()

print("Version changes:")
for package_file, old_version, new_version in version_rows:
    print(f"  {package_file}: {old_version} -> {new_version}")
print()

if stable_to_alpha:
    print("Stable -> alpha transitions to review:")
    for package_file, old_version, new_version in stable_to_alpha:
        print(f"  {package_file}: {old_version} -> {new_version}")
    print()

if major_bumps:
    print("WARNING: major version bumps found:")
    for package_file, old_version, new_version in major_bumps:
        print(f"  {package_file}: {old_version} -> {new_version}")
    print()

if non_alpha_new_versions:
    print("WARNING: new versions without -alpha found:")
    for package_file, old_version, new_version in non_alpha_new_versions:
        print(f"  {package_file}: {old_version} -> {new_version}")
    print()

if non_release_files:
    print("WARNING: files outside .changeset/pre.json, package.json, and CHANGELOG.md changed:")
    for file in non_release_files:
        print(f"  {file}")
    print()

if not major_bumps and not non_alpha_new_versions and not non_release_files:
    print("Summary: no major bumps, non-alpha new versions, or non-release files detected.")
else:
    print("Summary: review warnings above before approving/merging.")
PY

printf '\nWrote:\n'
printf '  %s\n' "$FILES_PATH"
printf '  %s\n' "$DIFF_PATH"
printf '  %s\n' "$SUMMARY_PATH"
