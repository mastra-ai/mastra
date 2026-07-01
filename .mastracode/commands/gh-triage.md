---
name: gh-triage
description: Triage a GitHub issue or PR into the next debugging, review, or CODEOWNER action
goal: true
---

# GitHub Triage

Triage one open GitHub issue or active PR into the next action. Keep the top-level path short; open branch detail only when that branch is selected.

## Hard rules

- [ ] Read-only except creating/updating exactly one lifecycle file: `.mastracode/issue-triage/GH_TRIAGE_<TYPE>_<NUMBER>.md`.

- [ ] Do not post comments, label, assign, close, tag, coordinate externally, implement fixes, or commit without explicit user approval.

- [ ] Non-open issues, non-open PRs, and draft PRs stop with no triage file and no `ask_user`.

- [ ] Successful triage ends by updating the triage file, then immediately calling branch-specific `ask_user`. Do not end with `Completed`, `Verdict`, `Key findings`, or a prose-only summary.

- [ ] Use shared context files for code-accurate evidence: `.mastracode/shared/pr-review-context.md` for PR context and `.mastracode/shared/issue-debug-context.md` for issue debug context.

- [ ] Shared context files are read-only instructions, not output artifacts. Do not create, copy, or update any second triage/context/review/debug file.

- [ ] Branch B/C/D gather context inline from the shared context files, then update the single triage file and call branch-specific `ask_user`.

## Triage file

Create only this lifecycle file for the whole run. Do not create any second triage, context, review, or debug artifact.

Create the directory only after `<TYPE>` and `<NUMBER>` are resolved and the input is confirmed open/active:

```bash
mkdir -p .mastracode/issue-triage
TRIAGE_FILE=.mastracode/issue-triage/GH_TRIAGE_<TYPE>_<NUMBER>.md
```

Use this compact lifecycle template and update it after each major step with concise decision context only. Do not dump raw bodies, full comments, logs, or diffs.

```markdown
## GitHub Triage: <issue|PR> #<number> <title>

**Severity:** <🔴 critical|🟠 high|🟡 medium|🟢 low|pending>
**Scope:** <affected package/API/feature or `Pending.`>
**Assessment:** <concise assessment or `Pending.`>
**Linked issue/PR:** <issue #|closing/fixing PR #|multiple #s|none|pending>
**CODEOWNER:** [not available]
**Recommended next step:** <maintainer comment|author pre-review|maintainer notes|maintainer PR fix-up|PR critique|compare PRs|gh-debug-issue|end triage|pending>

### Context gathered

- Input: <short issue/PR summary>
- Linked context: <closing/fixing PR or linked issue; mention-only PRs only if useful for debugging>
- Repo/history: <relevant files, APIs, tests, commits, or `Not inspected.`>

### Evidence

- <issue/PR/comment evidence>
- `<path>:<line>` — <repo evidence, if inspected>

### Branch output

<Use only selected Step 3 branch output. For Branch B/C/D include context gathered from the shared context file.>

### Prepared comments

- Author pre-review: <needed comment or `Not needed.`>
- Maintainer notes: <needed comment or `Not needed.`>
- Labels: <recommendation if inspected, otherwise `Not inspected.`>
```

### Comment style, only when preparing comments

- Author pre-review: tag the PR author when known, be concise/action-oriented, and request only concrete changes the author needs to make. Do not ask authors to confirm tests, verification, or maintainer review readiness.
- Maintainer notes: start with a severity-titled heading like `## 🟠 High: Maintainer notes`; use short sections such as `Scope`, `Context`, `Evidence checked`, and `Observations`; keep observations declarative and keep author actions out of maintainer notes.
- For PR branches, always prepare maintainer notes. Do not write `Maintainer notes: Not needed.` for Branch B or Branch C.
- Do not present maintainer notes as final approval or rejection.

## Step 1: Resolve and check input

- [ ] Ensure `$ARGUMENTS` contains one issue/PR number or URL. If missing, ask for it and stop.

- [ ] Resolve `<TYPE>` and `<NUMBER>` before naming the triage file.
  - `/issues/<n>` → `ISSUE`; `/pull/<n>` → `PR`.
  - `issue <n>` / `pr <n>` use the explicit prefix.
  - Bare number / `#<n>`: call the issue API first; if the response has `pull_request`, treat it as a PR.

```bash
INPUT="$ARGUMENTS"
OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
OWNER=${OWNER_REPO%/*}
REPO=${OWNER_REPO#*/}

gh api "repos/$OWNER/$REPO/issues/<number>" --jq '{number, state, isPr: has("pull_request")}'
```

- [ ] Fetch title, body, state, comments/activity, and linked issue/PR references.

```bash
# ISSUE input
gh issue view "$ISSUE" --comments --json number,title,state,author,assignees,createdAt,updatedAt,body,comments,url

# PR input
gh pr view "$PR" --comments --json number,title,state,isDraft,author,assignees,createdAt,updatedAt,body,comments,url,reviewRequests,reviews,mergeStateStatus,statusCheckRollup,closingIssuesReferences
```

- [ ] Stop immediately if issue `state != OPEN`, PR `state != OPEN`, or PR `isDraft == true`. Tell the user this command only triages open issues or active PRs.

- [ ] If open/active, create the triage file and save the initial Input/Context fields.

## Step 2: Gather only needed context

Gather enough context to choose a branch and severity. Stop searching once the branch and assessment are clear.

### Linked issue/PR discovery

- [ ] For issue input, find PRs that explicitly close/fix the issue. These drive routing.

- [ ] Treat mention-only/cross-referenced PRs as debugging context only; they do not route to PR critique.

- [ ] For PR input, fetch linked/closing issues and changed files before any full diff.

```bash
# Closing/fixing refs for an issue
ISSUE_NODE_ID=$(gh issue view "$ISSUE" --json id -q .id)
gh api graphql -f query='query($id:ID!){ node(id:$id){ ... on Issue { closedByPullRequestsReferences(first:20){ nodes{ number title state url } } } } }' -f id="$ISSUE_NODE_ID"

# Timeline cross-references, debug context only
gh api "repos/$OWNER/$REPO/issues/$ISSUE/timeline" --paginate --jq '.[] | select(.event=="cross-referenced") | {source:.source.issue | {number,title,state,pull_request,url}}'

# PR context
gh pr view "$PR" --json number,title,state,isDraft,url,author,body,comments,reviewRequests,reviews,mergeStateStatus,statusCheckRollup,closingIssuesReferences,files
```

### PR maintainer-fix checks

For Branch B/C PRs, do this before branch output or `ask_user`. Do not modify branches, apply suggestions, resolve conflicts, or run broad checks without approval.

- [ ] Check conflicts, failed `statusCheckRollup` lint/typecheck/format/test/CI, and applicable inline suggestions/review nits; ignore unrelated Vercel failures.
- [ ] If a relevant failure is unclear or stale and the affected package is obvious, run only the narrowest local check needed to confirm it.
- [ ] Record concise results in `Context gathered` and `Evidence`, using `None found.` when nothing applies.
- [ ] If a small low/medium-severity fix-up is found, set `Recommended next step` to `maintainer PR fix-up` and include matching final `ask_user` option(s).

### Repo/history context

- [ ] Inspect repo files/history only as needed for severity, scope, routing, or maintainer notes.

- [ ] Prefer narrow search and recent history over broad exploration.

- [ ] Ignore Vercel CI failures unless directly relevant to the issue, PR, or deployment behavior.

```bash
git grep -n "<error text|API|symbol>" -- '<likely/pathspec>'
git log --oneline --decorate -- '<relevant/path>' | head -20
git log -p --max-count=5 -- '<relevant/path>'
```

### Severity

Choose severity from all gathered issue/PR, repo, history, and linked context:

- `🔴 critical` — security issue, data loss/corruption, production outage, or core path broken for many users.
- `🟠 high` — major feature broken, serious regression, or high-impact workflow blocked.
- `🟡 medium` — real issue with limited surface area, workaround, or meaningful docs/behavior confusion.
- `🟢 low` — minor bug, typo, small docs gap, support/question, duplicate, invalid, unsupported, spam, unrelated, or low-risk test/coverage work.

Save severity, scope, assessment, linked context, and evidence before branching.

## Step 3: Choose one branch

- Branch A — irrelevant/non-actionable input.
- Branch B — exactly one closing/fixing PR, or input is a PR.
- Branch C — multiple closing/fixing PRs.
- Branch D — issue input with no closing/fixing PR.

Follow only the selected branch.

### Branch A: Irrelevant input

Use for spam, unrelated, invalid, unsupported, or clearly non-actionable items.

- [ ] Write Branch output: severity, assessment, draft maintainer comment, recommended `pending close` label, and label recommendations only if labels were inspected.

- [ ] Do not continue to PR critique or debugging.

- [ ] Update the triage file, then call `ask_user` with exactly:
  - `Draft/post maintainer comment`
  - `End triage`

### Branch B: One linked/input PR

Use when exactly one PR clearly closes/fixes the issue, or when the input itself is a PR.

- [ ] Use `.mastracode/shared/pr-review-context.md` to gather code-accurate PR context inline.

- [ ] Immediately update the triage file's `Context gathered` and `Evidence` sections with the PR context findings before writing branch conclusions.

- [ ] Write Branch output with severity/assessment/scope, issue summary, PR relevance, evidence checked, review observations, PR maintainer-fix check results, optional author pre-review, optional maintainer PR fix-up, and required maintainer notes.

- [ ] Update the triage file, then call `ask_user` with exactly the relevant Branch B options:
  - `Post author pre-review comment`
  - `Post maintainer notes comment`
  - `Post both comments`
  - `Fix conflicts as maintainer, then post maintainer notes` (only if found)
  - `Fix lint/CI failures as maintainer, then post maintainer notes` (only if found)
  - `Apply inline suggestions as maintainer, then post maintainer notes` (only if found)
  - `End triage`

### Branch C: Multiple linked PRs

Use when multiple PRs clearly close/fix the issue.

- [ ] Use `.mastracode/shared/pr-review-context.md` to gather concise context for each routing-relevant PR.

- [ ] Immediately update the triage file's `Context gathered` and `Evidence` sections with each PR context finding before writing comparison conclusions.

- [ ] Write Branch output with severity/assessment/scope, issue summary, PR list, evidence checked, comparison notes, PR maintainer-fix check results, optional maintainer PR fix-up, and required maintainer notes.

- [ ] Update the triage file, then call `ask_user` with exactly the relevant Branch C options:
  - `Post maintainer notes comment`
  - `Fix conflicts as maintainer, then post maintainer notes` (only if found)
  - `Fix lint/CI failures as maintainer, then post maintainer notes` (only if found)
  - `Apply inline suggestions as maintainer, then post maintainer notes` (only if found)
  - `End triage`

### Branch D: No linked PR

Use for issue input when no PR clearly closes/fixes the issue.

- [ ] Use `.mastracode/shared/issue-debug-context.md` to gather code-accurate issue/debug context inline.

- [ ] Immediately update the triage file's `Context gathered` and `Evidence` sections with the issue/debug context findings before writing branch conclusions.

- [ ] Write Branch output with severity/assessment, issue summary, likely affected area, evidence checked, debugging theory, likely reproduction path, and prepared maintainer comment if needed.

- [ ] Update the triage file, then call `ask_user` with exactly:
  - `Draft/post maintainer comment`
  - `Tag CODEOWNER` (unsupported until CODEOWNER mapping exists)
  - `Pass to MastraCode` (unsupported for now)
  - `End triage`
