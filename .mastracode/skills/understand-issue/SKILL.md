---
name: understand-issue
description: Investigate a GitHub issue or reported bug the way a seasoned maintainer would — form an independent model before reading the thread's theories, trace the mechanism and history, verify the diagnosis, and return a concise briefing with a verdict and fix direction. Use for triage, root-cause analysis, or re-investigation.
metadata:
  goal: true
---

# Understand Issue

Investigate the issue as a maintainer deciding what is actually wrong and what should happen next. Help the human understand it without turning the investigation into a walkthrough. Run uninterrupted to a concise front page, then stay available inside the goal until the human says the investigation is finished.

The issue follows `ARGUMENTS:` at the end of the objective. If absent, infer it from the conversation or the checked-out branch name (`fix/1234`, `issue-567`, `gh-890`). If no issue can be resolved and no bug is described, ask once.

## What matters

1. **Independent model before the thread's theories.** Understand the symptom and form your own hypothesis from the code before reading commenters' diagnoses, workarounds, or linked fix attempts. The gap between your model and theirs exposes anchoring in both directions.
2. **Depth proportional to stakes.** Data loss, security, silent misbehavior, wide blast radius, and uncertainty determine how hard to look—not a fixed checklist.
3. **Verify the diagnosis.** Read code deeply and run the smallest useful probe. A diagnosis needs real evidence and pointers; a plausible story is not evidence.
4. **A verdict, not a survey.** Say what the issue is and what causes it. Do not present a menu of candidates when the evidence supports one.
5. **Complete, not padded.** Everything you established or still suspect is in the briefing; length follows from findings, never the other way around. Lead with what matters most and cut narration, not conclusions. Preserve supporting detail in one record file for follow-up questions.

## Investigation record

Use one ignored file: `.mastracode/scratch/issues/<owner>-<repo>-<n>.md`. Never stage or commit it.

Start the record with a short **Own model**:

- the symptom as reported, in your words;
- how the relevant code currently works;
- your hypothesis for the cause;
- what evidence would confirm or kill it.

Append the investigation beneath it and leave it unchanged afterward. Capture decisive evidence as you work so it survives context compression—a ledger, not command transcripts. Use `references/templates.md` as an example, not a schema.

## 1. Build your own model

Resolve the issue with the minimal recipe in `references/recipes.md`. The metadata tells you whether the thread has anything to anchor you: comment count and cross-referenced PRs.

**If the thread has comments or linked PRs**, form your model before reading them. Use only the issue title, body, reproduction, error text, and the current code on the default branch; do not consult `mastra_expert` or another source that may already hold a diagnosis. Other people's theories are cheap to read later and expensive to un-read—a maintainer's "I think it's X" tends to become the investigation. Write the model, then open the thread.

**If the thread is empty**, there is nothing to seal. Investigate directly and write the model whenever you have one; it still records what you believed before verification.

Either way: start from the symptom, find the entry point, trace the mechanism to where the observed behavior is produced, and identify every area that could contribute—shared state, upstream data, configuration, callers, ordering. Stop when you can name a hypothesis and the evidence that would settle it.

If the report is too thin to trace (no symptom, no surface, no version), say so in the front page and draft the exact questions to ask—but still investigate whatever can be investigated.

## 2. Read the thread and prior art

Read every comment, linked PR, and related issue. Then:

- Treat proposed causes and workarounds as hypotheses to test, not conclusions to repeat. A maintainer's lead deserves tracing; it does not deserve deference.
- Note "me too" reports with different repros—they may reveal a broader mechanism or a different bug sharing a symptom.
- Search open and closed issues and PRs for the same symptom under other words. A closed fix for the same symptom means regression or incomplete fix; say which.
- Check whether an in-flight PR already addresses it.

Author context (first-time reporter vs. core contributor) informs where you look first, never whether you trust the report.

## 3. Diagnose like a maintainer

Use these questions where they apply. They shape judgment; they are not rows to fill.

- **Is the issue what it claims to be?** Genuine bug, working as designed, configuration or usage error, documentation gap, or XY problem (asking for X while needing Y). Decide, with evidence.
- **Where does the state first go wrong?** Trace backward from the symptom to the first point where a value, ordering, or assumption is incorrect. The display site is rarely the cause.
- **What does the code assume, and where is that enforced?** Bugs live where an assumption from one area is violated by another.
- **Who else is affected?** Callers, sibling paths, and other features on the same primitive. A fix at one site may leave the same defect elsewhere.
- **Why does the code look like this?** Distinguish an accident from a decision before proposing to change it.
- **What changed?** If it used to work, find the commit; a regression has a specific cause, not a vague one.
- **Is the reproduction faithful?** Reporter repros often include incidental steps. Find the minimal condition that triggers it.
- **What would fixing it correctly require?** Name the change and where it belongs. Note when the obvious patch would treat the symptom.
- **Am I anchored by the thread?** Ask whether you would reach this diagnosis given only the code and symptom.

Open deeper branches when the mechanism crosses them:

- async/stream/event/lifecycle → ordering, races, duplicate or missing calls, teardown;
- serialized state → old data under new code, partial migrations, mixed versions;
- input/network/filesystem boundary → validation, encoding, path, and secret handling;
- platform behavior → timezone, locale, paths, case, Windows, no-network;
- configuration → defaults, precedence, and merge order;
- cross-package contract → version skew between packages.

## 4. Recover history when it can change the diagnosis

History answers whether the current behavior is an accident or a decision, and when a regression entered. Run a light pass when the code's rationale is unclear or the behavior is old and stable. Go deep on a regression, a revert, repeated churn, "because/workaround/don't/see #" comments, or a test named after a past bug.

Use blame, `git log -S`, originating PRs, and linked issues. End with the implication for this issue. "Nothing notable" is a valid result. Recipes live in `references/recipes.md`.

Once the thread is open, `mastra_expert` may help orient you on Mastra-specific history. Verify its leads yourself; it is not required.

## 5. Verify the diagnosis

Choose the smallest verification that could falsify it:

- Deterministic mechanism: code reasoning is sufficient. Do not pretend to have executed what you read.
- Uncertain mechanism: write a minimal probe (test or script) that isolates the condition and shows the wrong behavior. Prefer a probe in a disposable worktree over editing the live checkout; remove any probe you add.
- Regression: identify the commit and explain why it changed the behavior; bisect only when reasoning cannot settle it.
- Working-as-designed or config verdicts: point to the enforcing code and the documentation (or its absence).

Never claim a reproduction you did not run. Never keep a diagnosis after contrary evidence resolves it.

## 6. Decide and brief

Verdicts: **bug / regression of `<sha or #pr>` / working as designed / configuration or usage / docs gap / duplicate of #N / cannot determine — needs `<specific info>`**.

State the diagnosis as a claim with its mechanism and evidence. Do not present a candidate list when the evidence supports one cause; present candidates only when it genuinely does not, and then say which you favor and what would decide it. A question to the reporter is allowed only when the answer could change the verdict—and it must be a specific, answerable question, not a hedge.

State the fix direction as a request: the pointer, what should change, and why the obvious patch would or would not suffice. Note secondary work (docs, other affected sites, missing test) explicitly rather than folding it in.

Write the rest of the record for the human. Lead with the mechanism and diagnosis, then include only useful context: evidence, relevant history, related issues, hunks to read, and decisions that genuinely need the human. Omit empty sections. No self-audit or process narration.

Then post the front page in chat. It should make the result understandable quickly and leave nothing out that the human would have to ask for:

- issue and verdict;
- one-line mechanism (symptom ← cause);
- fix direction with real pointers, including secondary work;
- what was verified versus trusted, and any suspicion left unverified with what would settle it;
- any genuine human decision or reporter question;
- the record path and context-specific offers.

This is a content contract, not a template. There is no line budget. Cut narration, process, and self-audit—never conclusions. Omit what does not apply. Offers follow from the diagnosis—draft an issue comment, draft a request-for-info comment, or start a fix—and zero offers is fine.

After posting, go to `waiting`. Answer follow-up questions from the record without reposting the summary. The goal ends only when the user explicitly says the investigation is finished.

## Re-investigation

Read the existing record first. The own model already exists; do not recreate it. Inspect only what changed—new comments, new commits on the default branch, new linked PRs—and report whether the diagnosis stands, changes, or is resolved. If nothing changed, say so briefly and wait.

## Tone and issue comments

Apply this to the local briefing and to any drafted or posted GitHub comment. **Before drafting or posting anything to GitHub, load the `gh-review` skill** and follow it: the diagnosis is stated as a claim, the fix is a required change, and nothing is hedged or deferred.

- Discuss code and evidence, not the reporter or commenters.
- State the diagnosis plainly. "This is a bug in X because Y" beats "could this be related to X?"
- Give every claim a pointer and a reason.
- Ask a question only when the answer could change the verdict; state what you believe first, then ask.
- Drop a diagnosis immediately when shown contrary evidence—no face-saving.
- Match explanation depth to the reader without lowering the evidence bar.
- Keep posted comments to the diagnosis, evidence, and next step—other contributors will read them.

Never post comments, push commits, open issues, or create other GitHub artifacts without the user explicitly saying to post. Show the draft; wait for the go.

## Judge criteria

Judge investigation quality, not ritual. Open the record, inspect the front page, and spot-check evidence where needed. Send the executor back only when a substantive invariant fails:

- the thread had comments or linked PRs and the own model was not recorded before they were read;
- depth was unreasonable for the stakes, or the diagnosis lacks enough evidence;
- an established cause is presented as a question, possibility, or candidate list instead of a verdict;
- the fix direction lacks a real pointer or would treat the symptom without saying so;
- the verdict contradicts the evidence, or a "cannot determine" verdict does not name the specific missing information;
- the front page omits a conclusion or unverified suspicion the investigator had, or what is needed to understand the decision;
- the record is insufficient to support follow-up questions;
- a drafted or posted GitHub comment hedges the diagnosis or marks the fix optional;
- something was posted or pushed without approval.

Do **not** bounce for section order, labels, exact fields, word counts, omitted empty sections, the executor's chosen commands, or formatting when the meaning is clear. Do not require a reproduction, history search, or offer merely because one could exist.
