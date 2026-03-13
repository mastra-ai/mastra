# PR Triage Task

You are triaging a single open PR for the mastra-ai/mastra repository. Your goal is to analyze it thoroughly and write a structured JSON report.

## PR to Triage

- **Number**: __NUMBER__
- **Title**: __TITLE__
- **Author**: __AUTHOR__
- **Created**: __CREATED__
- **Updated**: __UPDATED__
- **Draft**: __DRAFT__
- **Review Decision**: __REVIEW__
- **Additions**: __ADDITIONS__, **Deletions**: __DELETIONS__, **Changed Files**: __CHANGED__
- **Branch**: __HEAD__ -> __BASE__
- **Labels**: __LABELS__
- **URL**: __URL__

## Steps

1. Run these commands to gather full PR details:
   ```
   gh pr view __NUMBER__ --json body,comments,reviews,commits,statusCheckRollup,mergeable,reviewRequests
   gh pr checks __NUMBER__
   gh pr diff __NUMBER__ | head -500
   ```

2. Analyze the PR:
   - What does this PR do? Read the description and diff.
   - Is the author a bot (dependabot, renovate, app/*)? A maintainer (org member)?
   - Is the PR stale (no meaningful activity in 30+ days)?
   - Has a similar fix already been merged? Check with: `gh pr list --state merged --search "<keywords>" --limit 5`
   - Are there merge conflicts? Is CI passing?
   - Does it have tests, description, changesets?
   - Is the scope reasonable or is it too large/unfocused?

3. Calculate dates — **today's date is $(date +%Y-%m-%d)**:
   - ageInDays: days between opened date and today. Double-check your arithmetic.
   - daysSinceLastUpdate: days between last updated and today
   - Use these same values consistently in `maintainerNotes` text (don't recalculate separately)
   - size category: XS (<10 total lines), S (<50), M (<200), L (<500), XL (500+)

4. Determine triage category:
   - `ready-to-merge`: Approved, CI passing, no conflicts
   - `needs-maintainer-review`: Waiting for maintainer to review
   - `needs-author-action`: Changes requested or author needs to fix something
   - `stale`: No activity in 30+ days, unclear if still relevant
   - `likely-superseded`: Similar work was already merged or a newer PR exists
   - `draft-in-progress`: Author is still working on it
   - `blocked`: Waiting on something external
   - `auto-dependency-update`: Automated dep bump (renovate/dependabot)
   - `close-candidate`: Should probably be closed (poor quality, abandoned, etc.)

5. Use ONLY these enum values (strict — no synonyms, no free-form text):
   - **quality**: `high`, `good`, `fair`, `needs-work`, `poor`
   - **ciStatus**: `passing`, `failing`, `pending`, `unknown`
   - **mergeableState**: `mergeable`, `conflicting`, `blocked`, `unknown` (always lowercase)
   - **suggestedAction**: `merge`, `review`, `request-changes`, `close`, `wait`, `rebase`, `ping-author`

6. Write the JSON file to `maintainers/prs/__NUMBER__.json` with this exact structure:

```json
{
  "number": __NUMBER__,
  "title": "",
  "url": "__URL__",
  "author": {
    "login": "",
    "isBot": false,
    "isMaintainer": false
  },
  "dates": {
    "opened": "",
    "lastUpdated": "",
    "ageInDays": 0,
    "daysSinceLastUpdate": 0
  },
  "size": {
    "additions": 0,
    "deletions": 0,
    "changedFiles": 0,
    "category": "M"
  },
  "labels": [],
  "isDraft": false,
  "branch": {
    "head": "",
    "base": ""
  },
  "status": {
    "reviewDecision": "REVIEW_REQUIRED",
    "ciStatus": "unknown",
    "mergeConflicts": false,
    "mergeableState": "unknown"
  },
  "triage": {
    "category": "needs-maintainer-review",
    "priority": "medium",
    "quality": "good",
    "qualitySignals": {
      "hasTests": false,
      "hasDescription": false,
      "hasChangesets": false,
      "followsConventions": false,
      "scopeIsReasonable": false
    },
    "isStale": false,
    "similarOrDuplicatePRs": [],
    "relatedIssues": []
  },
  "summary": "",
  "maintainerNotes": "",
  "suggestedAction": "review | merge | request-changes | close | wait | rebase | ping-author",
  "triageDate": "$(date +%Y-%m-%dT00:00:00Z)"
}
```

**IMPORTANT**: The file MUST be valid JSON. Write it to `maintainers/prs/__NUMBER__.json`. Be concise but thorough in `summary` and `maintainerNotes`.
