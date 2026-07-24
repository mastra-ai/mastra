---
name: triage-issue
description: First-contact triage for a GitHub issue
---

# Triage Issue

Use this skill for first-contact intake on one GitHub issue. Gather enough context to classify the issue, choose the next route, post or update one concise issue comment, apply the minimal triage labels, and stop.

Keep the work focused on first-contact intake: classify the issue, explain the route, update the issue, and stop. If the issue needs technical investigation after triage, route it to `Investigate issue #<number>` so a follow-on `understand-issue` run can do that work.

## Label policy

Use only these auto-triage labels:

- `auto-triaged` — add after a successful triage comment for every issue processed by this skill.
- `needs-approval` — add only when the recommended next action needs maintainer approval or prep before someone should investigate, implement, close, or reject.

Also remove `status: needs triage` after the triage comment is posted or updated, if that label is present.

Apply only the labels listed above.

## Output contract

Triage ends with one GitHub-visible issue comment. Update an existing auto-triage comment when possible instead of adding duplicates.

Use this shape:

```markdown
Thanks for opening this.

**Triage:** <bug|feature request|docs|question/support|maintenance|duplicate|resolved|invalid|spam|out-of-scope|other> — <one-sentence classification>
**Route:** <Investigate issue #n|Prepare approval|Ask author for info|Close as duplicate/resolved/invalid/spam/out-of-scope|Answer provided / close|Other>
**Severity:** <🔴 critical|🟠 high|🟡 medium|🟢 low> — <short reason>
**Confidence:** <high|medium|low> — <short reason>
**Next step:** <concise maintainer-facing next action>

<Short explanation with the concrete evidence used, what was not checked if relevant, and why this route was chosen.>

<If asking for info, list the exact missing details. If duplicate/resolved, link the issue or PR. If answering a question, give the answer briefly and say it can be closed if no follow-up is needed.>
```

Severity guide:

- 🔴 critical — security issue, data loss, outage, or core path unusable.
- 🟠 high — serious regression or common workflow blocked.
- 🟡 medium — actionable bug/docs gap/behavior confusion with limited scope.
- 🟢 low — minor issue, support question, duplicate, invalid, spam, or unclear report.

## Workflow

### 1. Resolve input

- Require one issue number or issue URL.
- Parse the issue number and repository.
- If the input cannot be resolved, state what is missing and stop.

### 2. Gather context

Gather enough context to classify well. Keep this fast and bounded; do not perform deep code investigation.

Fetch issue details, labels, comments, author context, and state:

```bash
gh issue view "$ISSUE" --comments --json number,title,state,author,authorAssociation,assignees,labels,createdAt,updatedAt,body,comments,url
```

Then check:

- **Issue state:** if the issue is not open, stop unless the user explicitly asked for a note.
- **Current labels:** preserve useful existing type/severity labels in your reasoning, but do not over-label.
- **Author context:** lightly note whether the author appears to be a maintainer/core contributor or external reporter. Do not skip contributor-authored issues by default; still classify them.
- **Existing discussion:** read comments for clarifications, maintainer hints, repro details, workarounds, and prior decisions.
- **Closing/fixing PRs:** find PRs that explicitly close or fix this issue. Treat mention-only PRs as context unless they clearly resolve the issue.
- **Duplicates/related issues:** search for obvious duplicates or closely related open/closed issues using title keywords, error messages, package names, and affected feature names.
- **Likely area:** if obvious from the issue, optionally check recent history for that area to improve routing/severity. Keep this shallow; do not trace implementation.

Useful commands:

```bash
ISSUE_NODE_ID=$(gh issue view "$ISSUE" --json id -q .id)
gh api graphql -f query='query($id:ID!){ node(id:$id){ ... on Issue { closedByPullRequestsReferences(first:20){ nodes{ number title state url isDraft } } } } }' -f id="$ISSUE_NODE_ID"
gh issue list --search "<keywords>" --state all --json number,title,state,labels,url --limit 20
```

### 3. Classify and route

Choose one primary type and one primary route. If multiple types apply, pick the route that best determines what a maintainer should do next.

| Type                                | Use when                                                                                               | Route                                                                                           | Approval label                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `feature request`                   | The issue asks for new behavior, API, product direction, or policy change.                             | `Prepare approval` unless it is already clearly accepted policy.                                | Usually add `needs-approval`.                                                                        |
| `bug`                               | The issue reports broken or unexpected behavior.                                                       | `Investigate issue #<n>` when actionable; `Ask author for info` when repro/details are missing. | Usually no approval label. Add only if closing/rejecting is uncertain or product policy is involved. |
| `docs`                              | The issue is about docs, examples, wording, missing explanation, or docs/product-positioning mismatch. | `Investigate issue #<n>` or docs fix when actionable; ask for specifics if unclear.             | Add only for broad positioning/product decisions.                                                    |
| `question/support`                  | The issue asks how something works or needs usage help.                                                | Answer directly and route to close when confident; ask for info when not.                       | Usually no approval label.                                                                           |
| `duplicate`                         | A matching issue already exists.                                                                       | `Close as duplicate`, linking the canonical issue.                                              | No approval label unless the duplicate call is uncertain.                                            |
| `resolved`                          | A closing/fixing PR or released change appears to have resolved it.                                    | `Close as resolved` or route to the fixing PR.                                                  | No approval label unless uncertain.                                                                  |
| `invalid` / `spam` / `out-of-scope` | The report is not actionable for this repo or is abusive/irrelevant.                                   | `Close as <reason>` with brief neutral explanation.                                             | Add `needs-approval` if the close/reject decision needs maintainer sign-off.                         |
| `maintenance` / `other`             | It does not fit the above categories.                                                                  | Choose the closest actionable route and state uncertainty.                                      | Add only if approval/prep is required.                                                               |

When there is an explicit active PR that closes/fixes the issue, mention it in the comment and route toward that PR instead of starting issue investigation.

### 4. Draft/post the comment

- Make the comment useful to both maintainers and the reporter.
- Cite concrete evidence: issue text, comments, labels, duplicates, linked PRs, or recent related reports.
- Be explicit about anything important you did not check.
- If asking for information, ask for exact missing details: repro steps, expected behavior, actual behavior, version, environment, logs, screenshots, minimal reproduction, or affected package.
- Avoid sounding robotic. Keep it concise, neutral, and specific.
- Do not promise a fix, assign ownership, close the issue, or imply a maintainer has approved the route unless that is already evident.

### 5. Apply labels and stop

After the comment is posted or updated:

1. Add `auto-triaged`.
2. Add `needs-approval` only if the selected route needs maintainer approval/prep.
3. Remove `status: needs triage` if present.
4. Stop.

If the next route is investigation, approval prep, docs work, or a linked fixing PR, name that route in the comment and stop after the issue update.
