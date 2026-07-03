---
name: gh-triage
description: Route a GitHub issue or PR to the right understanding command with a scoped handoff file
goal: true
---

# GitHub Triage

Route one open GitHub issue or active PR. `/gh-triage` owns routing and handoff setup only; `/understand-pr` and `/understand-issue` own the downstream investigation, conclusions, drafts, and posting decisions.

## Hard rules

- [ ] Read-only except creating/updating exactly one scoped handoff file:
  - PR handoff: `.pr-review/GH_TRIAGE_PR_<pr-number>.md`
  - Issue handoff: `.issue-review/GH_TRIAGE_ISSUE_<issue-number>.md`
- [ ] Do not post comments, label, assign, close, tag, coordinate externally, implement fixes, or commit without explicit user approval.
- [ ] Non-open issues, non-open PRs, and draft PRs stop with no handoff file.
- [ ] Keep `/gh-triage` short: resolve the input, find closing/fixing PRs, choose a branch, seed the handoff file, and print the next command.
- [ ] Do not perform downstream investigation or draft comments in `/gh-triage`. Put needed downstream outputs in the handoff file's instructions.
- [ ] For PR handoffs, check whether maintainer notes already exist. Record only a pointer or one-line summary as prior context.

## Handoff file

Create the file only after the input is confirmed open/active and the route target is known.

Use this skeleton plus only the selected route's action block. Keep `Context` factual and concise. Put the old triage lifecycle work under `Handoff instructions` as action items for the downstream command.

```markdown
# GitHub Triage Handoff

## Route

- Source: <issue|PR> #<number> — <title>
- Selected route: <Branch B: understand-pr|Branch C: understand-pr after PR selection|Branch D: understand-issue>
- Reason: <why this route was selected>
- Next command: `<exact /understand-* command>`

## Context

- Issue: <issue # + short summary, or `None linked.`>
- PR: <PR # + short summary, or `None selected.`>
- Current state: <open/active state, draft status if PR, obvious route blockers>
- Linked candidates: <closing/fixing PRs, multiple candidates, or `None.`>
- Existing maintainer notes: <link/pointer/one-line summary, or `None found.`>
- Triage notes: <minimal routing facts only; no downstream conclusions>

## Handoff instructions

<Insert only the selected PR or issue action block below.>

## Workspace

<Downstream command writes findings here.>
```

### PR handoff action block

Use only for `.pr-review/GH_TRIAGE_PR_<pr-number>.md` files.

```markdown
Run the normal `/understand-pr` review lifecycle, then update this file and present the user with the relevant next actions.

Action items:

- Determine severity/scope/assessment for maintainer context, using:
  - `🔴 critical` — security issue, data loss/corruption, production outage, or core path broken for many users.
  - `🟠 high` — major feature broken, serious regression, or high-impact workflow blocked.
  - `🟡 medium` — real issue with limited surface area, workaround, or meaningful docs/behavior confusion.
  - `🟢 low` — minor bug, typo, small docs gap, support/question, duplicate, invalid, unsupported, spam, unrelated, or low-risk test/coverage work.
- Evaluate issue summary, PR relevance, evidence checked, changed areas, checks/local verification, and unresolved risks.
- Identify maintainer fix-up candidates from the old triage path, such as conflicts, relevant check/lint/CI failures, or inline suggestions.
- Prepare maintainer notes using this structure:

  ## <severity>: Maintainer notes

  **Merge confidence:** <x/5> — <ready to merge|mergeable with non-blocking follow-up|needs review changes|blocked>

  **Why:**
  - <1-3 bullets with concrete evidence supporting the assessment>

  **Why not higher:**
  - <explicit missing evidence or unresolved risk; mark blocking vs non-blocking>

  **Required before merge:**
  - <required change/check/review, or `None.`>

  **Non-blocking follow-ups:**
  - <follow-up, or `None.`>

  **Author comments:**
  - <author-facing action needed, or `None.`>

  **Prior maintainer notes:**
  - <reuse/supersede/update decision, or `None found.`>

- At any stop/final prompt, include the applicable posting/fix-up options below, even if notes are only provisional or not ready.
- Ask the user whether to post the maintainer notes after review.
- If maintainer fix-up candidates exist, ask whether to fix conflicts, relevant lint/check/CI failures, or inline suggestions before/with maintainer notes.
- Do not post comments or modify code without explicit user approval.
```

### Issue handoff action block

Use only for `.issue-review/GH_TRIAGE_ISSUE_<issue-number>.md` files.

```markdown
Run the normal `/understand-issue` investigation lifecycle, then update this file and present the user with the relevant next actions.

Action items:

- Determine severity/scope/assessment for maintainer context, using the same severity rubric above.
- Evaluate issue summary, likely affected area, evidence checked, debugging theory, and likely reproduction path.
- Identify likely root cause or current best diagnosis.
- Record unknowns and recommended next action.
- Prepare an issue-comment draft if a maintainer response is useful.
- Ask the user whether to post the issue comment after investigation.
- Do not post comments or modify code without explicit user approval.
```

## Step 1: Resolve and check input

- [ ] Ensure `$ARGUMENTS` contains one issue/PR number or URL. If missing, ask for it and stop.
- [ ] Resolve whether the input is an issue or PR.
  - `/issues/<n>` → issue input.
  - `/pull/<n>` → PR input.
  - `issue <n>` / `pr <n>` use the explicit prefix.
  - Bare number / `#<n>`: call the issue API first; if the response has `pull_request`, treat it as a PR.

```bash
INPUT="$ARGUMENTS"
OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
OWNER=${OWNER_REPO%/*}
REPO=${OWNER_REPO#*/}

gh api "repos/$OWNER/$REPO/issues/<number>" --jq '{number, state, isPr: has("pull_request")}'
```

- [ ] Fetch only enough metadata to confirm state and route.

```bash
# ISSUE input
gh issue view "$ISSUE" --comments --json number,title,state,author,assignees,createdAt,updatedAt,body,comments,url

# PR input
gh pr view "$PR" --comments --json number,title,state,isDraft,author,assignees,createdAt,updatedAt,body,comments,url,mergeStateStatus,statusCheckRollup,closingIssuesReferences,files
```

- [ ] Stop immediately if issue `state != OPEN`, PR `state != OPEN`, or PR `isDraft == true`. Tell the user this command only triages open issues or active PRs.

## Step 2: Find routing context

Gather only enough context to choose Branch A/B/C/D and seed a useful handoff.

- [ ] For issue input, find PRs that explicitly close/fix the issue. These drive routing.
- [ ] Treat mention-only/cross-referenced PRs as context, not as routing targets unless they clearly close/fix the issue.
- [ ] For PR input, fetch linked/closing issues and changed file names.
- [ ] For PR routes, inspect comments enough to identify whether an existing maintainer-notes comment is present.
- [ ] Record obvious route blockers only when they affect handoff selection, such as closed/non-open state, draft PR, conflicts, or clearly failing relevant checks. Do not diagnose or fix them here.

```bash
# Closing/fixing refs for an issue
ISSUE_NODE_ID=$(gh issue view "$ISSUE" --json id -q .id)
gh api graphql -f query='query($id:ID!){ node(id:$id){ ... on Issue { closedByPullRequestsReferences(first:20){ nodes{ number title state url } } } } }' -f id="$ISSUE_NODE_ID"

# Timeline cross-references, context only
gh api "repos/$OWNER/$REPO/issues/$ISSUE/timeline" --paginate --jq '.[] | select(.event=="cross-referenced") | {source:.source.issue | {number,title,state,pull_request,url}}'

# PR route context
gh pr view "$PR" --json number,title,state,isDraft,url,author,body,comments,reviews,mergeStateStatus,statusCheckRollup,closingIssuesReferences,files
```

## Step 3: Choose one branch

- Branch A — irrelevant/non-actionable input.
- Branch B — exactly one closing/fixing PR, or input is a PR.
- Branch C — multiple closing/fixing PRs.
- Branch D — issue input with no closing/fixing PR.

Follow only the selected branch.

### Branch A: Irrelevant input

Use for spam, unrelated, invalid, unsupported, or clearly non-actionable items.

- [ ] Do not create a handoff file.
- [ ] Tell the user briefly why no `/understand-*` handoff is needed.

### Branch B: One linked/input PR

Use when exactly one PR clearly closes/fixes the issue, or when the input itself is a PR.

- [ ] Create/update `.pr-review/GH_TRIAGE_PR_<pr-number>.md` using the skeleton plus the PR handoff action block only.
- [ ] Put issue/PR/link/check/comment facts in `Context`.
- [ ] Do not include the issue handoff action block.
- [ ] End by telling the user the exact next command:

```text
/understand-pr <pr-number> --working-file .pr-review/GH_TRIAGE_PR_<pr-number>.md
```

### Branch C: Multiple linked PRs

Use when multiple PRs clearly close/fix the issue.

- [ ] Record candidate PRs and routing facts concisely.
- [ ] If one active fixing PR is unambiguous, select it and create/update `.pr-review/GH_TRIAGE_PR_<pr-number>.md`.
- [ ] If selection is ambiguous, ask the user which PR should receive the handoff. Do not compare implementations deeply.
- [ ] Once selected, use the Branch B PR handoff shape and end with:

```text
/understand-pr <pr-number> --working-file .pr-review/GH_TRIAGE_PR_<pr-number>.md
```

### Branch D: No linked PR

Use for issue input when no PR clearly closes/fixes the issue.

- [ ] Create/update `.issue-review/GH_TRIAGE_ISSUE_<issue-number>.md` using the skeleton plus the issue handoff action block only.
- [ ] Put issue/link/comment facts in `Context`.
- [ ] Do not include the PR handoff action block.
- [ ] In `Context`, write `None selected.` for the PR field.
- [ ] End by telling the user the exact next command:

```text
/understand-issue <issue-number> --working-file .issue-review/GH_TRIAGE_ISSUE_<issue-number>.md
```
