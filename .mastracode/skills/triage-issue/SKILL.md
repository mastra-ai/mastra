---
name: triage-issue
description: Classify and route a GitHub issue, post/update an issue triage comment, and manage auto-triage lifecycle labels
---

# Triage Issue

Classify one open GitHub issue, post/update an issue triage comment, and manage the issue's auto-triage lifecycle labels.

Use this skill when `gh-triage` delegates an issue, when a GitHub `issues.opened` webhook starts an automatic run, or when a maintainer starts/continues issue triage from the Factory Triage page.

## Label Policy

The exact label names for this lifecycle are:

- `auto-triaged` — issue entered the automatic triage queue.
- `in-triage` — active maintainer/agent triage work has started.
- `needs-approval` — triage/review output is ready but needs maintainer approval.
- `done` — triage lifecycle is complete.

Rules:

- Add `auto-triaged` to every newly auto-processed issue before or alongside the triage output.
- Add `in-triage` when beginning active issue investigation or continuing triage work.
- Add `needs-approval` when the next action requires maintainer approval.
- Add `done` when the issue triage lifecycle is complete.
- Do not remove lifecycle labels unless the user explicitly asks or the issue is being moved to a later lifecycle state in the same run.
- After successfully posting/updating the triage output, remove `status: needs triage` if present.

## Rules

- Require one issue number or issue URL. Missing input: ask and stop; in headless mode, fail clearly.
- Triage creates no local files.
- Triage must always end with one GitHub-visible output: an issue comment. Do not create or update a Maintainer's Triage Note for issue triage.
- Stop on non-open issues unless the user explicitly asks for a note.
- Stop if the author is a core contributor (`authorAssociation` is `OWNER`, `MEMBER`, or `COLLABORATOR`) unless the user explicitly asks for triage.
- Do not modify code, assignees, milestones, branches, issue state, or unrelated labels.
- Do not invent evidence. Say what was not checked.
- In `--headless`, classify, post the selected triage output, apply labels, and exit.

## Issue Comment

Use one GitHub issue comment for issue triage. Update the same auto-triage comment across lifecycle runs when possible. Do not use the PR Maintainer's Triage Note format for issues.

```markdown
Thanks for opening this.

**Triage:** <bug|feature request|docs|question/support|maintenance|duplicate|invalid|spam|other> — <one-sentence summary>
**Route:** <Review PR #n|Investigate issue #n|Ask author for info|Close as duplicate/invalid/spam|Approve CI checks before Review|Select fixing PR|Other>
**Severity:** <🔴 critical|🟠 high|🟡 medium|🟢 low> — <short reason>
**Next step:** <concise maintainer-facing next action>

<Concise maintainer-facing response: what was found, what is needed, why this route was chosen, or why this is not actionable.>

<If asking for info, list exactly what is needed. If duplicate, link the duplicate/closed issue or PR. If candidate PRs exist, link them. If spam/invalid, keep it brief and neutral.>
```

Severity: critical = security/data loss/outage/core path broken; high = serious regression/workflow blocked; medium = real limited issue or docs/behavior confusion; low = minor/support/duplicate/invalid/spam/unclear.

Post/update an issue comment only after explicit approval in interactive mode. In `--headless` triage, choose the required output from the classification case and post it without asking.

## Workflow

### 1. Resolve input

- Parse the issue number or URL.
- Fetch enough issue context to classify and write the output:

```bash
gh issue view "$ISSUE" --comments --json number,title,state,author,authorAssociation,assignees,labels,createdAt,updatedAt,body,comments,url
```

- Find PRs that explicitly close/fix the issue.
- Treat mention-only/cross-referenced PRs as context unless they clearly close/fix.
- Check recent git history for the relevant area to inform next steps, severity, and likely reviewers. Default to 90 days; widen only if the area is quiet or recurrence/regression context is still unclear. Keep this high-level; do not inspect implementation deeply during Triage. Do not set confidence during Triage.

```bash
ISSUE_NODE_ID=$(gh issue view "$ISSUE" --json id -q .id)
gh api graphql -f query='query($id:ID!){ node(id:$id){ ... on Issue { closedByPullRequestsReferences(first:20){ nodes{ number title state url isDraft } } } } }' -f id="$ISSUE_NODE_ID"
gh api "repos/$OWNER/$REPO/issues/$ISSUE/timeline" --paginate --jq '.[] | select(.event=="cross-referenced") | {source:.source.issue | {number,title,state,pull_request,url}}'
```

### 2. Classify and route

Choose one case. Triage must finish with exactly one primary output route.

#### Case A: Irrelevant, duplicate, resolved, unclear, suspicious, or non-actionable

Use when no Review should start yet: spam, unrelated, invalid, unsupported, out of scope, unclear/missing details, duplicate, already resolved, or suspicious/security-risky attached code.

Next Step: `Close as <reason>`, `Ask author for info`, `Escalate suspicious security risk`, `Approve CI checks before Review`, or `Wait for author/checks`.

Output: issue comment only. Explain why Review is not starting, cite duplicates/resolution when present, ask for exact missing details, or briefly state why normal Review cannot proceed.

#### Case C/D: One or more candidate PRs

Use when one or more active PRs clearly close/fix the issue.

Next Step: `Review PR #<n>`, `Select one fixing PR for Review`, or `Approve CI checks before Review`.

Output: issue comment only. Include candidate PRs, linked issue state, CI approval recommendation when relevant, and why the PR route was chosen. If CI workflows have not been approved, do not list failing checks; recommend approving CI before Review.

#### Case E: Issue investigation

Use for an open issue with no active PR that clearly closes/fixes it, and enough information for investigation.

Next Step: `Investigate issue #<n>`.

Output: issue comment only. Include likely area, known evidence, missing-but-nonblocking context, and why issue investigation comes before PR Review.

### 3. Post/update output and labels

- Case A: post/update the issue comment, add/update lifecycle labels as needed, remove `status: needs triage` if present, and stop.
- Cases C-E: post/update the issue comment, add/update lifecycle labels as needed, remove `status: needs triage` if present, and stop unless the user explicitly asks to continue.
- If posting automatically, replace lettered options with a short summary of what was posted and the next step, then stop.
- If interactive approval is needed before posting, add `needs-approval` and stop with concise lettered options.
