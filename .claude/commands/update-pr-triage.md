# Update PR Triage Dashboard

Refresh the maintainers PR triage dashboard by syncing with the current state of open PRs. Removes closed PRs, triages new PRs, and re-triages PRs that have been updated since the last triage.

## Overview

The dashboard lives in `maintainers/`:
- `maintainers/prs/index.json` — manifest of all tracked PR numbers
- `maintainers/prs/<number>.json` — individual triage reports
- `maintainers/dashboard/index.html` — interactive dashboard UI
- `maintainers/triage-prompt.md` — prompt template for new PR triage
- `maintainers/schema.json` — JSON schema for triage reports

## Step 1: Fetch current open PRs

```bash
gh pr list --state open --limit 500 --json number,title,author,createdAt,updatedAt,isDraft,reviewDecision,additions,deletions,changedFiles,headRefName,baseRefName,labels,url | cat
```

Store the result. This is the source of truth for what's currently open.

## Step 2: Determine what changed

Compare the fetched PR list against existing triage files in `maintainers/prs/`:

### 2a. Closed PRs (delete)
Any `maintainers/prs/<number>.json` file where `<number>` is NOT in the fetched open PR list — that PR was closed/merged. Delete the JSON file.

### 2b. New PRs (triage from scratch)
Any PR number from the fetched list that has NO corresponding `maintainers/prs/<number>.json` file. These need full triage.

### 2c. Updated PRs (re-triage)
Any PR where **both** of these are true:
- A `maintainers/prs/<number>.json` file exists
- The PR's `updatedAt` from GitHub is **newer** than the `triageDate` in the existing JSON file

These need a re-triage with the existing report as context.

Report a summary table to the user:
```
| Action   | Count | Details                    |
|----------|-------|----------------------------|
| Delete   | X     | Closed/merged PRs          |
| New      | Y     | Need fresh triage           |
| Update   | Z     | Updated since last triage   |
| No change| W     | Already up to date          |
```

## Step 3: Delete closed PR files

For each closed PR, delete `maintainers/prs/<number>.json`.

## Step 4: Update the manifest

Write the complete list of currently-open PR numbers to `maintainers/prs/index.json`.

## Step 5: Generate prompts and launch `mc` instances

### For NEW PRs — use the standard triage prompt

Generate a prompt file at `maintainers/prompts/<number>.md` using the template from `maintainers/triage-prompt.md`, filling in the PR metadata placeholders. Use today's date for date calculations.

### For UPDATED PRs — use an update prompt

Generate a prompt file at `maintainers/prompts/<number>.md` with this template:

```
# PR Triage Update

You previously triaged PR #<NUMBER> and the report is saved at `maintainers/prs/<NUMBER>.json`. The PR has been updated since then.

## Current PR Info
- **Number**: <NUMBER>
- **Title**: <TITLE>
- **Author**: <AUTHOR>
- **Created**: <CREATED>
- **Updated**: <UPDATED> (was last triaged on <PREVIOUS_TRIAGE_DATE>)
- **URL**: <URL>

## Steps

1. Read the existing triage report:
   ```
   cat maintainers/prs/<NUMBER>.json
   ```

2. Gather the latest PR state:
   ```
   gh pr view <NUMBER> --json body,comments,reviews,commits,statusCheckRollup,mergeable,reviewRequests
   gh pr checks <NUMBER>
   gh pr diff <NUMBER> | head -500
   ```

3. Determine what changed since the last triage:
   - New comments or reviews?
   - CI status changed?
   - New commits pushed?
   - Review decision changed?
   - Merge conflicts appeared or resolved?

4. Update the triage report. Preserve the existing structure but update:
   - `dates.lastUpdated` and `dates.daysSinceLastUpdate`
   - `dates.ageInDays` (recalculate from today)
   - `status` fields (reviewDecision, ciStatus, mergeConflicts, mergeableState)
   - `triage.category` if the situation changed
   - `triage.priority` if warranted
   - `triage.isStale` (recalculate)
   - `summary` — append a brief note about what changed, or rewrite if significantly different
   - `maintainerNotes` — update with current actionable advice
   - `suggestedAction` — update based on current state
   - `triageDate` — set to today's ISO timestamp
   - Any other fields that are now different

5. Write the updated JSON to `maintainers/prs/<NUMBER>.json`.

**IMPORTANT**: 
- The file MUST be valid JSON. Keep the same schema structure. Be concise but thorough.
- Use ONLY these enum values (strict — no synonyms, no free-form text):
  - **quality**: `high`, `good`, `fair`, `needs-work`, `poor`
  - **ciStatus**: `passing`, `failing`, `pending`, `unknown`
  - **mergeableState**: `mergeable`, `conflicting`, `blocked`, `unknown` (always lowercase)
  - **suggestedAction**: `merge`, `review`, `request-changes`, `close`, `wait`, `rebase`, `ping-author`
```

## Step 6: Launch `mc` instances in batches

Spawn `mc` headless instances to process the prompts. Use this invocation:

```bash
pnpx tsx /Users/daniellew/Documents/Mastra/mastra2/mastracode/src/main.ts --timeout 600 --prompt "$(cat maintainers/prompts/<NUMBER>.md)"
```

Run each as a **background process** via `execute_command` with `background: true` and `timeout: 1800`.

**Batch size: 20 at a time.** Launch 20, then monitor.

## Step 7: Monitor batches

Check all running processes every 4 minutes:

1. Count how many new/updated JSON files exist in `maintainers/prs/`
2. For any process that exited without writing its file, note it for retry
3. When all processes in a batch have exited:
   - Report results to the user (how many succeeded, how many need retry)
   - Retry any failed PRs in the next batch
   - Launch the next batch of 20

Continue until all new and updated PRs are processed.

## Step 8: Final report

Once all batches are complete, report:

```
## PR Triage Update Complete

| Metric            | Count |
|-------------------|-------|
| Previously triaged| X     |
| Closed (removed)  | Y     |
| New (triaged)     | Z     |
| Updated (re-triaged)| W  |
| Failed (no report)| F    |
| Total open PRs    | T     |

Dashboard: run `pnpm dashboard:prs` and open http://localhost:8787/dashboard/
```

## Key Rules

- **20 `mc` instances per batch** — all can run in parallel (IO-bound)
- **No worktrees or branches** — this is read-only triage, not coding
- **Always use `background: true`** on `execute_command` — do NOT append `&` to the shell command
- **Set `execute_command` timeout to 1800** to avoid killing `mc` instances prematurely
- **Retry failed PRs** — if an `mc` instance exits without writing its JSON file, include it in the next batch
- **Update `index.json`** before launching `mc` instances so the dashboard reflects the current PR list immediately
- **Check for ANSI codes** — when parsing `gh` CLI JSON output, strip ANSI color codes before parsing: pipe through `sed 's/\x1b\[[0-9;]*m//g'` or use `--color=never`
