---
name: understand-issue
description: Collaboratively investigate a GitHub issue or bug — trace history, understand architecture, diagnose root cause
goal: true
---

# Understand Issue

Collaboratively investigate a GitHub issue or reported bug — trace the history of related code, understand the architecture involved, and work with the user to diagnose whether the issue is valid and what's actually causing it. Both you and the user should walk away with genuine understanding, not just a guess.

Do not produce walls of text. Responses should be short, dense, and information-dense. Minimize fluff. Be direct.

**Pacing:** Phases 1–3 are research — do them all proactively without stopping for user input. The first pause is Phase 4 (Diagnosis), where you present your findings and opinion for collaborative validation. Don't pause before that.

**Shell note:** `gh` output often contains ANSI color codes that break `jq`. Use `gh`'s built-in `--jq` flag instead of piping to `jq`, or prefix commands with `NO_COLOR=1`.

## Phase 1: Identify the Issue

Figure out what we're investigating.

1. Parse the issue input and optional `--working-file <path>` from `$ARGUMENTS`.
2. If `--working-file` is present, verify the file exists and read it first. Treat it as caller-provided context, follow its handoff instructions, and update that same file with findings before returning to the caller. Do not treat the working file as the final user-facing output. If the file does not exist, tell the user and end.
3. Never post comments without explicit approval.

The user may provide:

- A GitHub issue number or URL → pull metadata with `gh issue view <number> --json title,body,labels,comments,assignees,state,author`
- A description of a bug or unexpected behavior with no GitHub issue
- Nothing — if no issue number is given, check the current branch name (`git branch --show-current`). If it contains what looks like an issue number (e.g. `fix/1234`, `issue-567`, `bug/gh-890`, `feat/add-thing-1234`), extract it and use `gh issue view <number>` to confirm it exists. If it resolves, use it. If not, move on.

If it's unclear which issue or what the bug is, ask the user to clarify. Don't guess.

### People

Identify everyone involved and gauge their context depth:

- **Issue author**: Who opened it? Check their merged PR count (`gh pr list --author <user> --state merged --limit 100 --json number --jq length`) and issue count (`gh issue list --author <user> --state all --limit 100 --json number --jq length`). A first-time reporter vs a core contributor frames how you read the issue — a contributor likely knows the internals, a new user may be describing symptoms of a different root cause.
- **Commenters**: Read all comments on the issue thread. For anyone who suggested a cause, workaround, or diagnosis, check their merged PR count too. A maintainer's "I think this is related to X" is a strong lead worth tracing. A user's "me too" with a slightly different repro might reveal a broader pattern.
- **Assignees**: Note who (if anyone) is assigned and whether they've commented.

### Issue summary

Note (internally, don't pause here):

- What's the reported problem?
- Reproduction steps (if any)
- Expected vs actual behavior
- Any error messages, logs, or screenshots
- **Thread leads**: If commenters suggested causes, workarounds, or related code paths, note each one — these are investigation leads for Phase 3

### Issue quality gate

- Is the issue clear enough to investigate? Does it have enough detail to act on?
- Are there reproduction steps, or at least a clear description of the symptom?
- Is the expected behavior stated?

If the issue is too vague to investigate meaningfully, stop and say so — offer to investigate anyway, draft a comment asking for more info, or stop. Otherwise, move straight to Phase 2 without pausing.

## Phase 2: Related Issues & Prior Work

Before diving into code, check whether this has been seen before.

- Search for related issues: `gh issue list --search "<keywords>" --json number,title,state,labels --limit 20`
- Check closed issues too — this might be a regression: `gh issue list --search "<keywords>" --state closed --json number,title,state,labels --limit 20`
- Look for related PRs that touched the same area: `gh pr list --search "<keywords>" --state all --json number,title,state --limit 20`

Note what you find — you'll present it alongside Phase 3 results. If something looks like a clear regression or duplicate, note it prominently. Don't stop here — move straight to Phase 3.

## Phase 3: Initial Investigation

Now trace from the symptom into the codebase. Start from what the issue describes (error messages, unexpected behavior, specific features) and search for related code.

1. Search for error messages, function names, component names, or keywords from the issue
2. Trace the code paths involved — follow the execution flow from entry point to the area where things go wrong
3. Identify **all potentially contributing areas** — not just the obvious one. Think about: shared state, upstream data, configuration, race conditions, edge cases in callers

### Deep context on each area

For each contributing area you identify, build real understanding _now_ — don't defer it to Phase 4. You need to answer three questions per area before presenting it:

**1. Why does this code exist?** What problem was it originally written to solve? What was the codebase like before it was added?

- `git log --oneline -20 -- <file>` — recent commit history
- `git log --oneline --all -20 -- <file>` — cross-branch activity
- `git blame` on the specific relevant lines — who wrote this, when, and what commit message explains why
- Read linked PRs/issues from commit messages to understand the original motivation
- Look at the PR descriptions and discussions, not just commit titles

**2. How does it fit architecturally?** What are its relationships with other code?

- What calls it? What does it call? Trace callers and callees.
- What data flows through it and where does that data come from?
- What contracts or interfaces does it depend on or expose?
- Are there other features or systems that share the same underlying primitives (config, state, instances)?

**3. How do the areas relate to each other?** The contributing areas aren't isolated — understand how they interact:

- Do they share state, config objects, or instances?
- Does one area's design assume something about another area's behavior?
- Did changes in one area break assumptions in another?
- Map the dependency/data flow between areas

You should understand the full story before presenting it. The user needs to see not just "this code exists" but "this code was written N months ago to solve X, was last changed by Y to fix Z, the current design assumes W, and it connects to area 2 because they share the same config instance."

Present the contributing areas you've found, with history, architecture, and how they interrelate. Then move straight to Phase 4 — don't pause here.

## Phase 4: Diagnosis

This is the critical phase. You've done the research — now form an opinion and present it for collaborative validation. The goal is to jointly determine: **is this issue what it appears to be, and what's actually causing it?**

### First: is the issue itself valid?

Before diagnosing the technical cause, assess whether the issue is correctly framed. Consider:

- **XY problem**: Is the reporter asking for X but actually needs Y? Does the real problem live somewhere else entirely?
- **Configuration / user error**: Is this working as designed and the user just needs to configure it differently?
- **Documentation gap**: Does the behavior make sense but the docs don't explain it, leading to confusion?
- **Working as designed**: Is this intentional behavior that the reporter didn't expect?
- **Genuine bug**: Is the code actually doing something wrong?

State your assessment clearly. If you think the issue is misframed, say so with evidence.

### Then: what's causing it?

**If the cause is clear** (one obvious chain of causality), say so directly:

```text
Based on the investigation, I think this is [genuine bug / config issue / docs gap / XY problem].

Here's what's happening: [concise explanation of the causal chain, grounded in the code and history you traced].

[areas with history context, showing how they connect]

Do you agree?

A) Yes, that matches what I'm seeing
B) I'm not fully convinced — I think [specific part] might be different
C) I don't agree — I think the cause is more in the direction of [X]
D) I need to see more evidence before I can form an opinion
```

**If there's genuine ambiguity** (multiple plausible causes, or you're not sure), present the candidates and let the user help narrow it down:

```text
I see [N] possible explanations for this:

1. **[area/explanation]** — [history + architecture context]. This would mean [implication].
2. **[area/explanation]** — [history + architecture context]. This would mean [implication].

I'm leaning toward [N] because [reason], but I'm not confident. What's your read?

A) I think it's [1] — let's dig deeper there
B) I think it's [2] — let's dig deeper there
C) I think it's something else — [user explains]
D) I need to see more code before I can tell
```

### Key principle

Form your own opinion first, but ask the user for theirs before asserting. "I've formed my opinion but I'd like to hear yours first" is fine. Don't be a pushover — if the user disagrees with your assessment and you have evidence, push back respectfully.

## Phase 5: Deep Exploration (Interactive Loop, if needed)

If Phase 4 didn't resolve the diagnosis — either because there's genuine ambiguity, the user disagrees, or more evidence is needed — explore specific areas interactively.

For each area:

1. Read the code carefully — what it does, why, edge cases, contracts
2. Check test coverage for the relevant paths
3. Form a hypothesis and present it with evidence

```text
This area was last changed in [commit] to fix [issue]. The current code assumes [X] but the reported bug suggests [Y] is happening instead.

A) That sounds like the cause — dig deeper here
B) Show me the test coverage for this path
C) What changed recently that could have broken this assumption?
D) I don't think this is it — let's try a different direction
E) I want to look at something specific — let me tell you where
```

Tailor options to what's actually relevant. If multiple areas are interacting to cause the issue, say so.

Repeat until the cause is clear and agreed upon.

## Phase 6: Understanding Quality Gate

Before wrapping up, check that the investigation actually produced understanding — not just a surface-level guess.

Present a concise summary of what you've learned:

- The likely root cause (or top candidates if uncertain)
- The evidence supporting each hypothesis
- What's still unknown or uncertain
- How the contributing areas interact (if multiple are involved)

Then check:

```text
A) That matches my understanding — write it up
B) I'm not convinced about [specific part] — let's revisit
C) I think the cause is actually different — let me explain
D) I don't have enough understanding yet — keep exploring
```

Only move to the write-up after the user confirms they genuinely understand the issue.

## Phase 7: Understanding File

If a working file was provided, update that same file with the full investigation and any requested outputs from its handoff instructions, then return to the caller so it can handle the lifecycle output. Otherwise, write `.artifacts/understand-issue/UNDERSTANDING.md` in the workspace root.

Capture:

- **Issue**: what was reported (number, title, symptoms)
- **Contributing areas**: each area investigated, with file paths and relevant history
- **Root cause analysis**: what's likely causing the issue, with evidence
- **How we got here**: the history that led to this state — what changed, when, and why
- **Open questions**: anything still uncertain
- **Related issues/PRs**: links to related prior work found in Phase 2

Present the key findings to the user interactively before finalizing the file.

## Phase 8: Share to GitHub (Optional)

If `--working-file` is present, skip this phase by default and return to the caller.

Otherwise, offer to post the analysis to the GitHub issue:

```text
A) Post a summary of this analysis as an issue comment
B) I'll handle it myself
C) This issue needs more info first — help me draft a comment asking for clarification
```

If the user chooses to post, draft the comment and present it for review before posting. Use `gh issue comment <number> --body "<comment>"`. Keep it concise and useful — other contributors will read this. Focus on the root cause analysis and evidence, not the full investigation narrative.

If the GitHub API rate limit is low (`gh api rate_limit --jq '.rate'`), use the REST API fallback: `gh api repos/{owner}/{repo}/issues/{number}/comments -f body="<comment>"`.

## Behavior Rules

- **Be skeptical.** Don't jump to conclusions. Present evidence and let the user evaluate.
- **Trace, don't guess.** Follow actual code paths and git history. Don't hypothesize without looking.
- **Multiple causes are valid.** Issues often involve multiple interacting areas — don't force a single root cause if the evidence doesn't support it.
- **Short responses.** Dense information, lettered options, no filler.
- **Hypothesis-driven.** Each area exploration should end with a clear hypothesis that the user can confirm, reject, or refine.
- **The user drives.** They pick which areas to explore and when they've understood enough. Don't push them through a fixed sequence.
- **Form your own opinion** but present evidence first and ask the user what they think before sharing your conclusion.
