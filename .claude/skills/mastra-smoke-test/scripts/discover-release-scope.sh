#!/bin/bash
#
# Discover release smoke-test scope by exporting merged PRs since a release cutoff.
#
# Usage:
#   ./discover-release-scope.sh [--release-tag <tag>] [--cutoff <iso-timestamp>] [--date <YYYY-MM-DD>] [--workspace <dir>]
#
# Examples:
#   ./discover-release-scope.sh --release-tag '@mastra/core@1.28.0'
#   ./discover-release-scope.sh --cutoff 2026-04-24T08:53:08Z
#   ./discover-release-scope.sh --date 2026-04-28 --release-tag '@mastra/core@1.28.0'

set -euo pipefail

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required dependency '$1' is not installed." >&2
    exit 1
  fi
}

SMOKE_DATE="$(date +%F)"
WORKSPACE=""
RELEASE_TAG=""
CUTOFF=""
LIMIT="200"

while [ $# -gt 0 ]; do
  case "$1" in
    --release-tag|--tag)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "Error: $1 requires a value." >&2
        exit 1
      fi
      RELEASE_TAG="$2"
      shift 2
      ;;
    --cutoff)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "Error: --cutoff requires a value." >&2
        exit 1
      fi
      CUTOFF="$2"
      shift 2
      ;;
    --date)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "Error: --date requires a value." >&2
        exit 1
      fi
      SMOKE_DATE="$2"
      shift 2
      ;;
    --workspace)
      if [ $# -lt 2 ] || [ -z "${2:-}" ]; then
        echo "Error: --workspace requires a value." >&2
        exit 1
      fi
      WORKSPACE="$2"
      shift 2
      ;;
    --limit)
      if [ $# -lt 2 ] || ! [[ "${2:-}" =~ ^[1-9][0-9]*$ ]]; then
        echo "Error: --limit requires a positive integer." >&2
        exit 1
      fi
      LIMIT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_cmd gh
require_cmd git
require_cmd jq

if [ -z "$WORKSPACE" ]; then
  WORKSPACE="$HOME/mastra-smoke-tests/$SMOKE_DATE"
fi

mkdir -p "$WORKSPACE/logs"

if [ -f "$WORKSPACE/merged-prs.tsv" ]; then
  cp "$WORKSPACE/merged-prs.tsv" "$WORKSPACE/merged-prs.previous.tsv"
fi

if [ -z "$RELEASE_TAG" ]; then
  RELEASE_TAG=$(gh release list \
    --limit 50 \
    --json tagName,isPrerelease,isDraft \
    --jq '.[] | select(.isDraft == false and .isPrerelease == false and (.tagName | startswith("@mastra/core@"))) | .tagName' \
    | head -n 1)
fi

if [ -z "$RELEASE_TAG" ] && [ -z "$CUTOFF" ]; then
  echo "Error: could not infer a release tag. Pass --release-tag or --cutoff." >&2
  exit 1
fi

if [ -z "$CUTOFF" ]; then
  CUTOFF=$(gh release view "$RELEASE_TAG" --json createdAt --jq '.createdAt')
fi

if [ -z "$CUTOFF" ]; then
  echo "Error: could not determine cutoff. Pass --cutoff." >&2
  exit 1
fi

echo "Smoke workspace: $WORKSPACE"
echo "Release tag:     ${RELEASE_TAG:-'(none; cutoff supplied)'}"
echo "Cutoff:          $CUTOFF"
echo "Limit:           $LIMIT"
echo ""

if [ -n "$RELEASE_TAG" ]; then
  gh release view "$RELEASE_TAG" \
    --json tagName,name,createdAt,publishedAt,targetCommitish,url \
    --jq . \
    > "$WORKSPACE/release.json"

  git show -s --format='%H%n%ci%n%D%n%s' "$RELEASE_TAG" > "$WORKSPACE/release-git.txt" || true
fi

gh pr list \
  --state merged \
  --limit "$LIMIT" \
  --search "merged:>=$CUTOFF -author:app/dependabot" \
  --json number,title,author,mergedAt,labels \
  --jq '. | sort_by(.mergedAt) | .[] | [.mergedAt, ("#"+(.number|tostring)), .author.login, .title, (([.labels[].name] | join(",")))] | @tsv' \
  > "$WORKSPACE/merged-prs.tsv"

PR_COUNT=$(wc -l < "$WORKSPACE/merged-prs.tsv" | tr -d ' ')

cat > "$WORKSPACE/smoke-scope.md" <<EOF
# Release Smoke Scope

- Workspace: \`$WORKSPACE\`
- Release tag: \`${RELEASE_TAG:-none; cutoff supplied}\`
- Cutoff: \`$CUTOFF\`
- Merged PR export: \`merged-prs.tsv\`
- Non-Dependabot PR count: $PR_COUNT

## Categorization

Group every PR in \`merged-prs.tsv\` using the buckets from \`.claude/skills/mastra-smoke-test/SKILL.md\`, then add the targeted checks here before running smoke tests.

## Targeted checks

- [ ] Always: setup, agents, tools, workflows, traces, scorers, memory, MCP, errors
- [ ] CLI/create-mastra changes: fresh project at \`$WORKSPACE/smoke-project\`
- [ ] Server/API changes: curl checks for health, agents, tools, workflows, custom/invalid routes
- [ ] Studio/Playground changes: browser smoke affected pages
- [ ] Auth/permissions/Agent Builder changes: authenticated cloud smoke
- [ ] Storage/provider changes: package install/import or provider-specific smoke
- [ ] Mastra Code changes: separate Mastra Code/TUI smoke path
EOF

echo "Wrote:"
echo "  $WORKSPACE/merged-prs.tsv ($PR_COUNT PRs)"
echo "  $WORKSPACE/smoke-scope.md"
if [ -f "$WORKSPACE/merged-prs.previous.tsv" ]; then
  PREVIOUS_COUNT=$(wc -l < "$WORKSPACE/merged-prs.previous.tsv" | tr -d ' ')
  echo "  $WORKSPACE/merged-prs.previous.tsv ($PREVIOUS_COUNT PRs)"
fi

if [ "$PR_COUNT" -ge "$LIMIT" ]; then
  echo "" >&2
  echo "Warning: PR count reached --limit ($LIMIT). Page or narrow by date range; do not silently truncate scope." >&2
fi
