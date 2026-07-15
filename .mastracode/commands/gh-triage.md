---
name: gh-triage
description: GitHub OSS maintainer lifecycle triage, review, and approval management
goal: true
---

# GH Triage

Manage one open GitHub issue or active PR through three explicit phases:

1. **Triage** — classify, route, and always end by posting/updating either a Maintainer's Triage Note or an issue/PR comment.
2. **Review** — create one scoped working file and activate `understand-pr` or `understand-issue` with `--working-file`.
3. **Approve** — mark the note as waiting for final approval with a final approver, then stop.

Start with **Triage** only. In `--headless` mode, choose the next step, post the required Triage output, and exit.

## Rules

- [ ] Triage creates no local files. Review may create/update exactly one scoped working file:
  - PR review: `.pr-review/GH_TRIAGE_PR_<pr-number>.md`
  - Issue review: `.issue-review/GH_TRIAGE_ISSUE_<issue-number>.md`
- [ ] Triage must always end with one GitHub-visible output: either a Maintainer's Triage Note or an issue/PR comment.
- [ ] Issue Triage label policy is delegated to `triage-issue`; PR Triage label writes remain limited to removing `status: needs triage` after a successful Triage post unless critical-path rules require otherwise.
- [ ] If posting/updating a Maintainer's Triage Note on a PR that has linked/closing issue(s), also post a short comment on each linked issue saying the issue has been triaged and routed to the PR, then remove `status: needs triage` from those linked issues if present.
- [ ] Do not modify code, assignees, milestones, branches, reviews, PR/issue state, or merge/close anything, except issue lifecycle labels managed by `triage-issue` and the critical-path actions required by `.mastracode/resources/CRITICAL_PATHS.md`.
- [ ] The only GitHub writes are approved Maintainer's Triage Note updates, required linked-issue triage comments, approved issue/PR comments, issue lifecycle labels managed by `triage-issue`, critical-path reviewer/close actions required by `.mastracode/resources/CRITICAL_PATHS.md`, and `status: needs triage` label removal after posting.
- [ ] Stop on non-open issues, non-open PRs, or draft PRs unless the user explicitly asks for a note.
- [ ] Do not invent evidence. Say what was not checked.
- [ ] Keep interactive responses short and end with lettered options.

## Maintainer's Triage Note

Use one GitHub comment for the lifecycle. Update the same comment across phases.

```markdown
## <severity symbol only> Maintainer's Triage Note

**Current Phase:** Triaged
**Next Step:** <Review PR #n|Investigate issue #n|Ask author for info|Close as duplicate/invalid/spam|Approve CI checks before Review|Select fixing PR|Critical-path owner review|Continue to Approve|Await final approval|Other>

**Triage:**

- Type: <bug|feature request|docs|question/support|maintenance|duplicate|invalid|spam|other> — <one-sentence summary>
- Maintainer read: <brief user-visible problem/goal and why this route was chosen>
- Route: <Review PR #n|Investigate issue #n|Ask author for info|Close as duplicate/invalid/spam|Approve CI checks before Review|Select fixing PR|Critical-path owner review|Other>
- Severity: <🔴 critical|🟠 high|🟡 medium|🟢 low> — <short reason>

**Review:**

- Status: <not started|in progress|complete>
- Findings: <brief implementation/root-cause/check-risk summary, or `Not reviewed yet.`>
- Confidence: <Pending Review|1/5|2/5|3/5|4/5|5/5> — <use only these exact values; no text labels>
- Follow-up: <author/maintainer follow-up needed, or `None yet.`>

**Approve:**

- Status: <not started|waiting for final approval|approved|not approved>
- Final approver: <@person or @org/team, or `Not identified yet.`>
- Notes: <approval/merge/close/reopen guidance, or `Pending Review.`>
```

Heading uses only the severity symbol: `🔴`, `🟠`, `🟡`, or `🟢`. The `Severity` field includes the symbol plus label/reason. Severity: critical = security/data loss/outage/core path broken; high = serious regression/workflow blocked; medium = real limited issue or docs/behavior confusion; low = minor/support/duplicate/invalid/spam/unclear. Confidence belongs only to Review and must be exactly `Pending Review`, `1/5`, `2/5`, `3/5`, `4/5`, or `5/5`; never use labels like `medium-high`.

## Issue/PR Comment

Use this to ask the author for information or explain duplicate/non-actionable handling. Do not use a new comment for normal Review output; Review findings go in the existing Maintainer's Triage Note unless the user asks for an author-facing comment.

```markdown
Thanks for opening this.

<Concise maintainer-facing response: what was found, what is needed, or why this is not actionable.>

<If asking for info, list exactly what is needed. If duplicate, link the duplicate/closed issue or PR. If spam/invalid, keep it brief and neutral.>
```

Post/update an issue/PR comment only after explicit approval in interactive mode. In `--headless` triage, choose the required output from the classification case and post it without asking.

When a PR triage note routes linked/closing issue(s), also post this short comment on each linked issue:

```markdown
Thanks for opening this issue.

This has been triaged and routed to PR #<n> for maintainer follow-up. Maintainers will continue the lifecycle tracking on that PR.
```

## Phase 1: Triage

### 1. Resolve input

- [ ] Require one issue/PR number or URL. Missing input: ask and stop; in headless mode, fail clearly.
- [ ] Parse flags: `--headless` runs non-interactively: classify, post the selected Triage output(s), and exit.
- [ ] Resolve type:
  - `/issues/<n>` or `issue <n>` → issue.
  - `/pull/<n>` or `pr <n>` → PR.
  - Bare number / `#<n>`: call issue API; if it has `pull_request`, treat as PR.

```bash
OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
OWNER=${OWNER_REPO%/*}
REPO=${OWNER_REPO#*/}
gh api "repos/$OWNER/$REPO/issues/<number>" --jq '{number, state, isPr: has("pull_request")}'
```

### 2. Delegate issue triage

If the resolved input is an issue, activate `triage-issue` and pass through the original issue number/URL and `--headless` flag when present. The delegated skill owns issue context gathering, classification, posting/updating issue triage output, lifecycle labels, and `status: needs triage` removal.

```text
Activate skill: triage-issue
Arguments: <issue number or URL> [--headless]
```

After `triage-issue` completes Triage, return here only if the selected next step explicitly enters Phase 2 Review.

### 3. Gather PR triage context

Fetch enough to classify and write the note. Do not do implementation review.

```bash
gh pr view "$PR" --comments --json number,title,state,isDraft,author,authorAssociation,assignees,labels,createdAt,updatedAt,body,comments,url,mergeStateStatus,statusCheckRollup,closingIssuesReferences,files
```

- [ ] Stop if PR is not open or PR is draft.
- [ ] Stop if the author is a core contributor (`authorAssociation` is `OWNER`, `MEMBER`, or `COLLABORATOR`) unless the user explicitly asks for triage.
- [ ] For PRs, fetch linked/closing issues and their current states; a PR linked only to already-closed/resolved issues is often duplicate or stale.
- [ ] Record changed files, merge/conflict status, CI approval state, and existing Maintainer's Triage Note if present.
- [ ] Ignore Vercel checks during Triage; do not cite them as blockers or failures.
- [ ] If CI workflows are waiting for approval or have not been approved, do not report individual failing/pending checks. Recommend `Approve CI checks before Review` as the next step.
- [ ] Only report non-Vercel failing checks when CI has already been approved and the check result is real.
- [ ] Check recent git history for the relevant area to inform next steps, severity, and likely reviewers. Default to 90 days; widen only if the area is quiet or recurrence/regression context is still unclear. Keep this high-level; do not inspect implementation deeply during Triage. Do not set confidence during Triage.
- [ ] For PRs, read `.mastracode/resources/CRITICAL_PATHS.md` and compare changed files against it.

```bash
ISSUE_NODE_ID=$(gh issue view "$ISSUE" --json id -q .id)
gh api graphql -f query='query($id:ID!){ node(id:$id){ ... on Issue { closedByPullRequestsReferences(first:20){ nodes{ number title state url isDraft } } } } }' -f id="$ISSUE_NODE_ID"
gh api "repos/$OWNER/$REPO/issues/$ISSUE/timeline" --paginate --jq '.[] | select(.event=="cross-referenced") | {source:.source.issue | {number,title,state,pull_request,url}}'

# PR linked issue states
gh pr view "$PR" --json closingIssuesReferences --jq '.closingIssuesReferences[]? | {number,title,state,url}'

# Relevant-area history. For PRs, use changed files; for issues, infer the narrowest likely paths from labels/title/body/comments.
RELEVANT_PATH="path/from/repo/root"
git log --since="90 days ago" --oneline --decorate -- "$RELEVANT_PATH" | head -20
git log --since="90 days ago" --format='%h %ad %an %s' --date=short -- "$RELEVANT_PATH" | head -20
```

### 3. Classify and route

Choose one case. Triage must finish with exactly one primary output route: Case A posts an issue/PR comment and stops; Case B follows the critical-path resource output; Cases C-E post/update the Maintainer's Triage Note. Critical-path matches stop after Triage unless the user explicitly asks to continue.

#### Case A: Irrelevant, duplicate, resolved, unclear, suspicious, or non-actionable

Use when no Review should start yet:

- spam, unrelated, invalid, unsupported, or clearly out of scope
- unclear or missing reproduction/details
- duplicate of an existing issue/PR
- input PR only links closed/resolved issues, suggesting the PR is duplicate, stale, or no longer needed
- issue already resolved by a closed/merged PR or prior maintainer answer
- PR code or attached snippets look suspicious, malicious, credential-seeking, exfiltration-prone, or otherwise security-risky enough that normal Review should not start

Next Steps:

- `Close as <reason>` for spam/invalid/duplicate/resolved/suspicious.
- `Ask author for info` when the item could become actionable with specific details.
- `Escalate suspicious security risk` when code appears malicious or unsafe and should not enter normal Review.
- `Approve CI checks before Review` when CI workflows have not been approved.
- `Wait for author/checks` only when the blocker is external and Review is premature.

Output:

- Issue/PR comment only: explain why Review is not starting, cite the duplicate/closed issue or PR when present, ask for the exact missing details, or state that the submitted code cannot proceed through normal Review because it appears suspicious or security-risky. Keep spam/invalid/suspicious comments brief and neutral.
- Do not create/update a Maintainer's Triage Note for Case A unless the user explicitly overrides the route.
- Interactive ask: `Does this look non-actionable, or is there context that makes it worth Review?`

#### Case B: Critical path

Use when an active PR's changed files match `.mastracode/resources/CRITICAL_PATHS.md`.

Output:

- Follow the resource: auto-close/comment for listed external-contributor paths; otherwise request/add the listed owner(s) and post/update a concise Maintainer's Triage Note that calls out the matched path, owner(s), and reason.
- Skip the Review step by default; do not activate `understand-pr` or create a review working file for this route unless the user explicitly asks.
- Interactive ask: `This touches a critical path. Post the critical-path triage output and stop here?`

#### Case C: One PR to review

Use when the input is an active PR, or exactly one active PR clearly closes/fixes the issue, and linked issue state does not make the PR obviously duplicate/stale.

Checks before selecting:

- linked/closing issue is open, or the PR independently fixes a still-valid problem
- no stronger active PR handles the same issue
- draft/non-open state has already been ruled out

Next Steps:

- `Review PR #<n>` when CI has been approved or checks are not required before Review.
- `Approve CI checks before Review` when CI workflows are waiting for approval.

Output:

- Maintainer's Triage Note: include linked issue state, changed area, non-Vercel blockers, CI approval recommendation when relevant, and why this PR is the Review target.
- If CI workflows have not been approved, do not list failing checks; set top-level `Next Step` to `Approve CI checks before Review`.
- If this is a PR with linked/closing issue(s), also prepare the linked-issue triage comment for each linked issue.
- Interactive ask: `Should this PR be the Review target?`

#### Case D: Multiple candidate PRs

Use when multiple active PRs clearly close/fix the issue or address the same live problem.

Next Steps:

- `Select one fixing PR for Review`, unless one PR is clearly the right target.
- `Approve CI checks before Review` for any selected PR whose CI workflows are waiting for approval.

Output:

- Maintainer's Triage Note: list candidate PRs with one-line next-step facts, including linked issue state, CI approval state, and obvious non-Vercel blockers. Do not compare implementations deeply.
- If CI workflows have not been approved for a candidate, recommend approving CI before Review instead of listing failing checks.
- If one PR is selected and it has linked/closing issue(s), also prepare the linked-issue triage comment for each linked issue.
- Interactive ask: `Which PR should move to Review?`

#### Case E: Issue investigation

Use for an open issue with no active PR that clearly closes/fixes it, and enough information for investigation.

Next Steps:

- `Investigate issue #<n>`.

Output:

- Maintainer's Triage Note: include likely area, known evidence, missing-but-nonblocking context, and why issue investigation comes before PR Review.
- Do not post an author-facing comment during Triage unless the route falls back to Case A because information is required before Review.
- Interactive ask: `Should this issue move to Review as an investigation?`

### 4. Post/update note or comment, then pause

- [ ] Case A: post the issue/PR comment, remove `status: needs triage` if present, and stop. Do not continue to Review.
- [ ] Case B: follow `.mastracode/resources/CRITICAL_PATHS.md`, post/update the required GitHub-visible output, remove `status: needs triage` if present, and stop. Do not enter Review unless the user explicitly asks.
- [ ] Cases C-E: update an existing Maintainer's Triage Note if present; otherwise create one. After the note is posted/updated, remove `status: needs triage` if present.
- [ ] PR note route with linked/closing issue(s): after posting/updating the PR note, post the linked-issue triage comment on each linked issue, then remove `status: needs triage` from those linked issues if present.
- [ ] `--headless`: make the classification decision, post the selected output(s), remove `status: needs triage` where applicable, and exit. Do not pause for confirmation or continue to Review.
- [ ] Interactive mode: show the selected draft(s), recommend the route, and ask before posting unless already requested.

```text
Triage output is ready: <Case A issue/PR comment|critical-path output|Maintainer's Triage Note|Maintainer's Triage Note + linked issue comment(s)>.
Recommended next step: <Review PR #n|Investigate issue #n|Ask author for info|Close as reason|Approve CI checks before Review|Select fixing PR|Critical-path owner review>.

A) Post the selected Triage output and stop here
B) Show/edit the draft before posting
C) The triage read is wrong — let me explain
D) Post the selected Triage output, then continue to Review
E) Do not post — stop here
```

Only offer D for Cases C-E. Never offer D for Cases A-B. If output was already posted automatically, replace the posting options with a short summary of what was posted and stop.

## Phase 2: Review

Only enter after explicit user selection. Do not stop after writing the working file; continue into the matching skill, finish its interactive Review flow, then update the existing Maintainer's Triage Note.

### 1. Prepare Review working file

Create/update exactly one file using the selected route:

- PR Review: `.pr-review/GH_TRIAGE_PR_<pr-number>.md`
- Issue Review: `.issue-review/GH_TRIAGE_ISSUE_<issue-number>.md`

For PR Review, build the file from the PR diff and routing context:

```bash
gh pr diff "$PR" --patch
gh pr view "$PR" --comments --json number,title,url,author,body,comments,reviews,mergeStateStatus,statusCheckRollup,closingIssuesReferences,files
```

For Issue Review, build the file from the issue body, comments, timeline, labels, candidate PRs, and routing question.

The file should contain only Review context: input URL/number, selected route, Maintainer's Triage Note comment URL/id if available, relevant facts, and questions for the skill. Do not embed the Maintainer's Triage Note template or issue/PR comment template in the working file.

The working file is internal Review context only. It is never the final Phase 2 output.

### 2. Activate the matching skill and continue through Review

After writing the working file, immediately activate the matching skill with `--working-file`. Do not end with a prep summary.

```text
Activate skill: understand-pr
Arguments: <PR number or URL> --working-file .pr-review/GH_TRIAGE_PR_<pr-number>.md
```

```text
Activate skill: understand-issue
Arguments: <issue number or URL> --working-file .issue-review/GH_TRIAGE_ISSUE_<issue-number>.md
```

After the skill finishes, return to this command and update/ask about the existing note.

For multiple PRs, ask which PR first. No-action routes do not enter Review unless the user corrects the route.

### 3. Update the existing note

Before ending Phase 2, update the existing Maintainer's Triage Note with Review findings. Do not add a separate comment or PR review as lifecycle output unless the user asks for an author-facing message.

```text
Review output is ready: update the existing Maintainer's Triage Note.

A) Update the existing Maintainer's Triage Note with Review findings
B) Show me the proposed note update first
C) Update the note, then draft a separate author-facing comment
D) Continue Review before updating anything
```

When updating, edit the same note comment: `Current Phase: Reviewed`, top-level `Next Step: Continue to Approve`, concise `Review` findings, exact Review confidence value (`1/5`-`5/5`), `Approve` still pending. After the note update, do not stop with a completion summary; ask whether to continue to Approve.

```text
Maintainer's Triage Note updated with Review findings.

A) Continue to Approve
B) Show me the updated note
C) Draft a separate author-facing comment
D) Stop here
```

## Phase 3: Approve

Only enter after Review is complete enough for final maintainer routing. Do not merge, close, label, assign, or change PR/issue state.

### 1. Identify one final approver

- [ ] Use reviewed files/area from the working file.
- [ ] Check CODEOWNERS first: `.github/CODEOWNERS`, `CODEOWNERS`, then `docs/CODEOWNERS`.
- [ ] Do not list docs maintainers unless the PR explicitly changes docs or introduces/changes a feature that needs docs follow-up.
- [ ] If CODEOWNERS is clear, use one matching `@user` or `@org/team` mention.
- [ ] Otherwise use recent history for affected paths and choose one person with recent context; only use `@` for a confirmed GitHub handle.
- [ ] If unclear, say `No clear final approver identified` with a short reason.

```bash
find .github . docs -name CODEOWNERS -maxdepth 2 2>/dev/null
git log --since="6 months ago" --format='%an <%ae>' -- <path> | sort | uniq -c | sort -rn | head -10
```

### 2. Present Approve options

```text
Review is ready for final approval routing.
Final approver: <@person/@org/team or no clear approver> — <short reason>.

A) Update the Maintainer's Triage Note as waiting for final approval with this approver
B) Show me the proposed note update first
C) Pick a different final approver
D) Do not update anything — stop here
```

If approved, update the same note: `Current Phase: Awaiting Approval`, top-level `Next Step: Await final approval`, `Approve` status `waiting for final approval`, final approver and reason. Then stop.
