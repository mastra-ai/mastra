---
name: gh-issue-triage
description: Triage a GitHub issue from first contact into a concise next action
goal: true
---

# GitHub Issue Triage

Triage one open GitHub issue into a clear next action. Follow the steps in order. Use the checkboxes as execution state. Do not skip the final `ask_user` step unless the issue is not open.

## Hard rules

- [ ] Keep triage read-only except creating/updating `.mastracode/issue-triage/ISSUE_TRIAGE_<NUMBER>.md`.

- [ ] Do not post comments, label, assign, close, tag people, coordinate externally, implement fixes, or commit changes without explicit user approval.

- [ ] For open issues, end with `ask_user` using the selected branch options; do not end with a prose-only summary.

## Triage file

Create the directory if needed, then create/update exactly this file throughout the lifecycle:

```bash
mkdir -p .mastracode/issue-triage
.mastracode/issue-triage/ISSUE_TRIAGE_<NUMBER>.md
```

Use this structure from the start and fill it in as each step/branch gathers context:

```markdown
## Issue Triage: #<number> <title>

**Severity:** <🔴 critical|🟠 high|🟡 medium|🟢 low|pending>
**Scope:** <affected package/API/feature or `Pending.`>
**Assessment:** <concise assessment comment or `Pending.`>
**Linked PR:** <none|#<number>|multiple: #<numbers>|pending>
**CODEOWNER:** [not available]
**Recommended next step:** <draft maintainer comment|author pre-review|maintainer triage context|PR critique|compare PRs|gh-debug-issue|end triage|pending>

### Issue summary

<short summary or `Pending.`>

### Context gathered

#### Issue context

- <concise issue and activity context or `Pending.`>

#### Linked PR context

- <concise PR context or `Pending.`>

#### Repo context

- <relevant files/APIs/tests/docs or `Not inspected.`>

#### History context

- <recent commits/changes/diffs summary or `No relevant recent changes found.`>

### Evidence

- <issue/comment evidence>
- `<path>:<line>` — <repo evidence, if inspected>

### Branch output

<Use only the selected Step 3 branch output. Keep concise.>

### Labels

- <label recommendation if labels were inspected, otherwise `Not inspected.`>

### Prepared comments

#### Author pre-review comment

<concise author-facing PR review comment if action is needed from the PR author, otherwise `Not needed.`>

#### Maintainer triage context comment

<maintainer/codeowner-facing triage context if useful, otherwise `Not needed.`>

When PR critique finds something the PR author should address, prepare a separate author pre-review comment before the maintainer triage context. The author pre-review comment must:

- tag the PR author when known
- be concise and action-oriented
- state the specific requested change or verification
- include only the minimum issue context needed to explain why it matters
- avoid broad triage metadata unless it helps the author act

For maintainer triage context comments, write review notes for a human maintainer/codeowner. Make the comment readable at a glance:

- start with a clear title that includes the severity emoji and label, for example `## 🟠 High: PR triage context` or `## 🟡 Medium: Maintainer review notes`
- use short headed sections or bold labels such as `Scope`, `Context`, `Evidence checked`, `Needs verification`, and `Recommended action`
- keep paragraphs short; prefer bullets for observations and verification prompts
- include why the PR appears relevant
- include what evidence was checked
- include what still needs human verification
- include the recommended maintainer action

Do not present triage context as final approval or rejection. Make observations and verification prompts a human can run with.
```

## Inputs

- [ ] Confirm `$ARGUMENTS` contains one GitHub issue number or URL.

- [ ] If `$ARGUMENTS` is empty, ask the user for one issue number or URL and stop until they provide it.

## Step 1: Check issue

- [ ] Create or update `.mastracode/issue-triage/ISSUE_TRIAGE_<NUMBER>.md` throughout the triage lifecycle.

- [ ] After each major step, save concise context to the file before continuing.

- [ ] Keep saved context brief and decision-oriented; do not dump raw issue bodies, full comments, or full diffs.

- [ ] Fetch issue context: title, body, state, activity/comments, and linked PR references.

```bash
gh issue view <ISSUE> --comments --json number,title,state,author,assignees,createdAt,updatedAt,body,comments,url
```

- [ ] If `state != OPEN` → stop immediately.
  - [ ] Do not write `.mastracode/issue-triage/ISSUE_TRIAGE_<NUMBER>.md`.

  - [ ] Do not call `ask_user`.

  - [ ] Tell the user the command only triages open issues.

- [ ] If `state == OPEN` → proceed.

- [ ] Identify linked PRs from issue body/comments/timeline references/explicit PR links.

- [ ] For each linked PR, fetch PR context:

```bash
gh pr view <PR> --comments --json number,title,state,author,labels,assignees,reviewRequests,reviews,mergeStateStatus,statusCheckRollup,body,comments,url
```

- [ ] If a linked PR needs critique context, inspect changed files first:

```bash
gh pr diff <PR> --name-only
```

- [ ] If changed files are not enough, inspect the diff:

```bash
gh pr diff <PR>
```

- [ ] If issue or PR plausibility needs repo evidence, search narrowly:

```bash
git grep -n "<error message | API name | config key | referenced symbol>"
```

## Step 2: Assess issue and gather context

- [ ] Gather structured issue context from the title, body, comments, and linked PR references.

- [ ] Gather repo context only where needed to validate the report or identify the likely area.

- [ ] Gather relevant history: commits, recent changes, and notable diffs for files or areas that appear central to the issue.

Use narrow commands for repo and history context:

```bash
git grep -n "<error message | API name | config key | referenced symbol>"
git log --oneline --decorate --max-count=10 -- <relevant-file-or-directory>
git log --stat --max-count=5 -- <relevant-file-or-directory>
git log -p --max-count=3 -- <relevant-file-or-directory>
```

- [ ] Add a concise `Context gathered` section to `.mastracode/issue-triage/ISSUE_TRIAGE_<NUMBER>.md` before choosing a branch.

- [ ] Structure the saved context under these headings:
  - `Issue context` — what was reported and what activity matters
  - `Linked PR context` — linked PRs found, if any
  - `Repo context` — relevant files, APIs, tests, docs, or missing coverage around issue and linked PR
  - `History context` — recent commits, changed files, notable diffs, or notable lack of recent changes around issue and linked PR

- [ ] Keep context concise. Summarize findings; do not paste raw logs, full comments, or full diffs.

- [ ] Use the gathered issue, repo, history, and linked PR context to choose exactly one severity.

- [ ] Do not assign severity from the issue title alone.

- [ ] Base severity on observed user impact, affected area, evidence strength, recent-change context, and whether an active PR already addresses it.

Severity values:

- `🔴 critical` — security issue, data loss/corruption, production outage, or core path broken for many users.
- `🟠 high` — major feature broken, serious regression, or high-impact workflow blocked.
- `🟡 medium` — real issue with limited surface area, workaround, or meaningful docs/behavior confusion.
- `🟢 low` — minor bug, typo, small docs gap, support/question, duplicate, invalid, unsupported, spam, unrelated, or low-risk test/coverage work.

- [ ] Write one concise assessment paragraph explaining how the gathered context supports the severity and next action.

Assessment fields must be only:

```markdown
**Severity:** <🔴 critical|🟠 high|🟡 medium|🟢 low>
**Scope:** <affected package/API/feature>
**Assessment:** <concise assessment comment>
```

- [ ] Set CODEOWNER exactly to:

```markdown
**CODEOWNER:** [not available]
```

## Step 3: Choose exactly one branch

- [ ] Choose exactly one branch: `A`, `B`, `C`, or `D`.

- [ ] Follow only the chosen branch.

- [ ] Do not end with a prose-only recommendation.

- [ ] Do not end with a `Completed`, `Verdict`, `Key findings`, or summary-only message.

- [ ] Every branch must update `.mastracode/issue-triage/ISSUE_TRIAGE_<NUMBER>.md` and then immediately call `ask_user` with the exact choices listed for that branch.

- [ ] The last user-visible action for an open issue must be `ask_user`, not a text summary.

### Branch A: Irrelevant issue

Use when the issue is spam, unrelated, invalid, unsupported, or clearly non-actionable.

- [ ] Gather branch output:
  - severity + assessment
  - draft maintainer comment
  - recommended status label: `pending close`
  - label recommendations only if labels were fetched later for this branch

- [ ] Do not continue to PR critique.

- [ ] Do not continue to debugging.

- [ ] After updating the triage file, immediately call `ask_user` with exactly:
  - `Draft/post maintainer comment`
  - `End triage`

- [ ] Do not print a final `Completed` or `Key findings` summary before asking.

### Branch B: One linked PR

Use when exactly one relevant linked PR exists.

- [ ] Run the actual `goal/critique-pr` command for the linked PR and pass on the full issue triage context.

- [ ] Gather branch output:
  - severity + assessment
  - issue scope / affected area
  - issue assessment summary
  - PR relevance summary
  - PR critique summary
  - human verification checklist
  - recommended maintainer action
  - author pre-review comment, if the PR author needs to change or verify something
  - maintainer triage context comment that starts with a titled heading containing the severity emoji/label and uses readable sections for scope, context, evidence checked, human verification notes, and recommended action
  - `CODEOWNER tagging: Skipped: CODEOWNER unavailable`

- [ ] After updating the triage file, immediately call `ask_user` with exactly:
  - `Post author pre-review comment`
  - `Post maintainer triage context comment`
  - `Post both PR comments`
  - `End triage`

### Branch C: Multiple linked PRs

Use when multiple relevant linked PRs exist.

- [ ] Run the actual `goal/critique-pr` command for each linked PR and pass on the full issue triage context.

- [ ] Compare the PRs.

- [ ] State the recommended path.

- [ ] State whether one PR should be closed or superseded.

- [ ] Gather branch output:
  - severity + assessment
  - issue scope / affected area
  - issue assessment summary
  - critique summary for each PR
  - comparison and recommended path
  - note if one PR should be closed or superseded
  - human verification checklist
  - recommended maintainer action
  - author pre-review comment(s), if any PR author needs to change or verify something
  - maintainer triage context comment(s) that start with titled headings containing the severity emoji/label and use readable sections for scope, context, evidence checked, human verification notes, and recommended action
  - `CODEOWNER tagging: Skipped: CODEOWNER unavailable`

- [ ] After updating the triage file, immediately call `ask_user` with exactly:
  - `Post author pre-review comment(s)`
  - `Post maintainer triage context comment(s)`
  - `Post all PR comments`
  - `End triage`

### Branch D: No linked PR

Use when no relevant linked PR exists.

- [ ] Run the actual `goal/gh-debug-issue` command for the issue and pass on the full issue triage context.

- [ ] Gather branch output:
  - severity + assessment
  - issue assessment summary
  - debug/reproduction summary from `goal/gh-debug-issue`
  - label recommendations only if labels were fetched later for this branch

- [ ] After updating the triage file, immediately call `ask_user` with exactly:
  - `Continue from debug findings`
  - `Tag CODEOWNER` — unsupported for now
  - `Pass to MastraCode` — unsupported for now
  - `End triage`
