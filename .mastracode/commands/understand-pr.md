---
name: understand-pr
description: Guided interactive PR review — understand the history and context before forming opinions
goal: true
---

# Understand PR

Guide a maintainer through understanding a pull request by first building deep historical context, then walking through the changes interactively. The reviewer should genuinely understand the PR before forming opinions or drafting comments.

Do not produce walls of text. Every response should be short, dense, and end with lettered options (A/B/C/D) so the user can type a single letter to continue. Minimize fluff. Be direct and information-dense.

## Setup

**Shell note:** `gh` output often contains ANSI color codes that break `jq`. Use `gh`'s built-in `--jq` flag instead of piping to `jq`, or prefix commands with `NO_COLOR=1`.

1. Verify the checked-out branch matches the PR head branch
2. Run `gh pr view --json title,body,commits,files,labels,number,headRefName,author` to get PR metadata
3. Run `gh pr diff` to get the full diff
4. Identify the current user: `gh api user --jq .login`

### People

Figure out who's involved:
- **PR author** — who opened this PR? Are they a maintainer, a regular contributor, or a first-time community contributor? Check with `gh api repos/{owner}/{repo}/collaborators/{author} --silent` (404 = not a collaborator).
- **Current reviewer** (you, the user running this command) — are you the PR author (self-review) or someone else?
- **Linked issue author(s)** — if the PR references issues, who opened them? Same person as the PR author, or someone else reporting a problem that this PR claims to fix?

For each person discovered, check their merged PR count on this repo: `gh pr list --author <login> --state merged --json number --jq length`. For linked issue authors, also check their issue count: `gh issue list --author <login> --state all --json number --jq length`. This tells you how much context each person has — a first-time contributor needs different review attention than someone with 50+ merged PRs, and a prolific issue reporter's bug reports carry different weight than a first-time filer.

Note these relationships briefly — they inform how to read the PR. A maintainer fixing their own bug is different from a community member's first contribution addressing someone else's issue.

### Linked Issues

If the PR description or commits reference any issues (e.g. "fixes #1234", "closes #456", or just "#789"), read them now:
- Run `gh issue view <number> --json title,body,labels,comments,author,state` for each linked issue
- Understand what was originally reported, by whom, and what the expected fix looks like
- Check if the issue discussion contains context that the PR description doesn't mention

This is critical context for Phase 1 — the linked issues often explain *why* this PR exists better than the PR description itself.

Do not begin analysis yet. Move to the History phase.

## Phase 1: History & Context

Before looking at what the PR changes, understand how we got here.

### Git history

For each file changed in the PR:

1. Run `git log --oneline -20 -- <file>` to see recent commit history
2. Run `git log --oneline --all -20 -- <file>` to catch cross-branch activity
3. Use `git blame` on the specific changed regions (pre-PR state) to understand who wrote the current code and when
4. Check for related changes — if the PR touches a function, trace its callers and check whether they've changed recently too
5. Look at linked issues or referenced PRs in commit messages

### Architecture & surrounding code

Read the code around the changed areas — not just the changed lines. Understand:
- The module/package architecture and where the changed code fits in it
- Surrounding features that interact with or depend on the changed code
- Interfaces, types, and contracts the changed code participates in
- How data flows through this area of the codebase
- Any relevant AGENTS.md, README, or doc files in the changed packages

### Tests

Examine the PR's test changes (or lack thereof) and the existing test patterns in the codebase:
- Does the PR add or modify tests? Read them carefully.
- Do the tests actually verify the claimed behavior, or do they just exercise code paths without meaningful assertions?
- Look at how similar features are tested elsewhere in the codebase — is the PR following those patterns or doing something weaker?
- Are there edge cases or failure modes that the tests don't cover?
- If the PR has no tests, should it?

### Write `.pr-review/HISTORY.md`

Capture what you learned:
- Why does each changed file/module exist? What problem did it originally solve?
- How has it evolved? Key commits that shaped the current state.
- Recent activity — has this area been actively worked on or dormant?
- How the changed code fits into the broader architecture.
- Surrounding features and dependencies that could be affected.
- Any patterns or conventions established by the history and codebase.
- Test quality assessment — are the tests meaningful?

Present the history to the user interactively — one file or logical area at a time. After each chunk, offer follow-up options:

```
A) Why was [specific thing] added originally?
B) Who else has changed this recently?
C) Show me the related code that depends on this
D) I understand this part — move on
```

Tailor the options to what's actually interesting or relevant. Do not use generic options. The point is to help the user fully and deeply understand the change being made and its implications.

Do not move to Phase 2 until the user has seen the history for all major changed areas and indicated they're ready.

## Phase 2: PR Goal

The goal of this phase is to orient the user before the walkthrough — give them the concise context they need so the code changes make sense when they see them.

Present a concise summary of the PR's goal: what problem it solves, why it exists, and what the intended outcome is. Ground this in the PR description, commit messages, and linked issues. Be specific — "fixes a bug" is not enough.

If the PR changes any public API, exported interface, CLI command, configuration option, or user-facing behavior, show what the change looks like from a user's perspective — before and after. For example: how would a developer's code change, what new options are available, what would they import differently. Don't just describe the internal implementation; show the impact on someone using the thing that changed.

Then pause:

```
A) That matches my understanding — continue
B) I think the goal is actually different — let me explain
C) I'm not sure what this PR is solving — dig deeper
```

Only proceed to the quality gate after the user confirms understanding of the PR's purpose.

## Phase 3: Quality Gate

Now that you understand the history (Phase 1) and the PR's goal (Phase 2), check whether this PR meets a minimum bar. Run `gh pr checks` to get CI status, then evaluate:

- Is CI passing (build, typecheck, tests)? If CI is still running, note it and proceed with caveats.
- Are the tests meaningful (from your Phase 1 analysis)?
- Is the diff coherent — a focused change, or a WIP dump with unrelated changes mixed in?
- **Changeset**: Check whether the PR includes a changeset. If the repo uses changesets (look for a `.changeset/` directory), any PR that changes runtime behavior, fixes a bug, or adds a feature must have one. A missing changeset is a quality gate failure — flag it explicitly.
- Does it meet other repo requirements (docs updates, AGENTS.md updates, etc.)?
- **Approach**: Given the history and the PR's stated goal, does the approach make sense? Is it solving the problem the right way, or is it fighting the existing design? If a simpler or more consistent approach exists given the codebase's history, flag it.
- **Author verification**: Has the PR author stated that they personally verified the change works? Look for comments like "tested locally", "verified this fixes…", reproduction evidence, screenshots, or test output. If the PR description and comments contain no indication that the author actually ran or tested their change, flag it — this should be raised as a question in the review comment (Phase 7) if the user chooses to draft one.
- Any obvious red flags — broken patterns, removed safety checks, huge unrelated diffs?

If the PR doesn't meet the bar, tell the user directly:

```
This PR isn't ready for detailed review yet:
- [specific reasons]

A) Review it anyway — I want to understand what's here
B) Help me draft feedback to the author about what needs fixing
C) Stop here
```

If the PR passes the bar (or the user chooses to proceed anyway), move to the walkthrough.

## Phase 4: Walkthrough

Walk through the actual PR diff one piece at a time, grounded in the history context from Phase 1.

For each chunk:
- Show what changed (keep it brief — the user can read the diff themselves)
- Explain why it matters given the history you just covered
- Flag anything that contradicts established patterns, seems risky, or raises questions
- Offer follow-up options

```
A) What breaks if this change is wrong?
B) Are there tests covering this path?
C) Show me the surrounding code
D) Next change
```

Again — tailor the options to what's actually relevant. Be skeptical. If something looks suspicious, say so directly. If something looks solid, don't waste words praising it.

For large PRs with many files, group changes by logical area and let the user choose which area to explore next. Do not just go file-by-file in alphabetical order.

## Phase 5: Understanding Check

Once the walkthrough is complete, offer the user a choice:

```
We've been through all the changes. Want to:
A) Quick quiz to test your understanding
B) Revisit a specific area
C) I understand — let's move to opinions
```

If the user picks the quiz, ask 3-5 multiple-choice questions about the PR — what the code does, why specific decisions were made, what the risks are. These should be real questions that test understanding, not softballs. If the user gets something wrong, explain it clearly and offer to revisit that area.

## Phase 6: Opinion Exchange

Once the user understands the PR, ask for their opinion first:

```
I've formed my own opinion on this PR, but I'd like to hear yours first.
What do you think — is this ready to merge? Any concerns?
```

Wait for the user's response. Then share your opinion — be direct and honest. Agree where you agree, disagree where you disagree. Do not soften your position to match the user's. Call out:
- Things that should be fixed before merge
- Risks or unknowns
- Missing tests, docs, changesets, or other repo requirements
- Things that are good and worth noting (briefly)

## Phase 7: Review Comment (Optional)

After the opinion exchange, offer to draft a review comment:

```
Want me to draft a review comment? Options:
A) Draft a full review comment
B) Draft a short approval/comment
C) No comment needed
```

If the user wants a comment, draft it and present the full text directly in your message. Then:

```
A) Post this comment as-is
B) Make it shorter
C) Make it more detailed
D) Change the tone (specify)
E) I want to edit specific parts (tell me what)
F) Don't post anything
```

Iterate until the user is happy or decides not to post. Do not post unless the user explicitly asks.

### Posting

When posting, use the REST API to avoid GraphQL rate limits:

```bash
cat > /tmp/pr-comment.md <<'EOF'
Comment body here.
EOF

body=$(jq -Rs . /tmp/pr-comment.md)
gh api repos/:owner/:repo/issues/<PR_NUMBER>/comments \
  -X POST \
  -H 'Content-Type: application/json' \
  --input - <<EOF
{"body":$body}
EOF
```

If the wrong body is posted, patch with:

```bash
body=$(jq -Rs . /tmp/pr-comment.md)
gh api repos/:owner/:repo/issues/comments/<COMMENT_ID> \
  -X PATCH \
  -H 'Content-Type: application/json' \
  --input - <<EOF
{"body":$body}
EOF
```

Use `gh api rate_limit --jq '.rate'` to check REST quota if you hit errors.
