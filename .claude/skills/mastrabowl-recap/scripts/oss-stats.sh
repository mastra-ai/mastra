#!/usr/bin/env bash
# MastraBowl Recap — Open Source stats puller
#
# Usage:
#   scripts/oss-stats.sh [SINCE]
#
# SINCE: ISO date (YYYY-MM-DD) for the start of the week window.
#        Defaults to the most recent Friday (the week being recapped).
#
# Requires: gh CLI (authenticated), jq.
# Note: this repo's gh predates `gh search`, so we use `gh api search/issues`.

set -euo pipefail

# --- resolve the week window -------------------------------------------------
if [[ "${1:-}" != "" ]]; then
  SINCE="$1"
else
  # Default: the past 7 days (the week being recapped on Friday).
  # macOS/BSD date and GNU date differ; handle both.
  if date -v-7d >/dev/null 2>&1; then
    SINCE=$(date -v-7d +%Y-%m-%d)   # BSD/macOS
  else
    SINCE=$(date -d "7 days ago" +%Y-%m-%d)  # GNU
  fi
fi

count() {
  # $1 = full search query
  gh api -X GET search/issues -f q="$1" --jq '.total_count'
}

echo "## Open Source — week since ${SINCE}"
echo

for repo in mastra-ai/mastra mastra-ai/platform; do
  merged=$(count "repo:${repo} is:pr is:merged merged:>=${SINCE}")
  open_prs=$(count "repo:${repo} is:pr is:open")
  open_issues=$(count "repo:${repo} is:issue is:open")
  echo "### ${repo}"
  echo "- PRs merged this week: **${merged}**"
  echo "- Open PRs (EoW): **${open_prs}**"
  echo "- Open Issues (EoW): **${open_issues}**"
  echo
done

# --- releases this week ------------------------------------------------------
# Markdown bullets linking to each GitHub release published in the window.
echo "### Releases since ${SINCE} (mastra-ai/mastra)"
releases=$(gh api "repos/mastra-ai/mastra/releases?per_page=100" \
  --jq "[.[] | select(.published_at >= \"${SINCE}\")] | sort_by(.published_at) | reverse | .[] | \"- [\(.tag_name)](\(.html_url)) — \(.published_at[0:10])\"" 2>/dev/null)
if [[ -n "$releases" ]]; then
  echo "$releases"
else
  echo "- (none in window / unable to fetch)"
fi
echo
echo "_Fill EoW totals line as: **EoW <issues> Issues Open | <prs> PRs Open** using mastra-ai/mastra numbers above._"
