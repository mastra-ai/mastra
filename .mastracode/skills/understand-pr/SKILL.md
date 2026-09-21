---
name: understand-pr
description: Review a PR the way a seasoned maintainer would — build an independent model before seeing the diff, investigate the implementation and history, verify material claims, and return a concise briefing. Use for any PR review, self-review, or re-review.
metadata:
  goal: true
---

# Understand PR

Review the PR as a maintainer deciding whether the change belongs in the codebase. Help the human understand it without turning the review into a walkthrough. Run uninterrupted to a concise front page. For draft PRs authored by the user or a confirmed user-owned bot, follow `gh-review`'s autonomous posting exception and finish the review without an approval checkpoint; otherwise stay available inside the goal until the human says the review is finished.

The PR follows `ARGUMENTS:` at the end of the objective. If absent, infer it from the conversation or checked-out branch.

## What matters

1. **Your design before theirs.** Establish the required outcome and real constraints from the problem and base branch, then choose the simplest design that satisfies them—not a restatement of the author's proposal. Compare the PR against that reasoning. Agreement is valid when independently justified; disagreement needs evidence, not merely a different preference.
2. **Depth proportional to risk.** Blast radius, irreversibility, uncertainty, and public-contract impact determine how hard to look—not a fixed checklist.
3. **Verify material claims.** Read code deeply and run the smallest useful probes. Findings need real evidence and pointers; process compliance is not evidence.
4. **Judgment over coverage theater.** Find the core decision, root cause, and meaningful risks. Do not manufacture findings or run work merely to look thorough.
5. **Complete, not padded.** Every request you have evidence for is in the review; length follows from findings, never the other way around. Lead with what matters most and cut narration, not requests. Preserve supporting detail in one review file for follow-up questions.

## Review record

Use one ignored file: `.mastracode/scratch/reviews/<owner>-<repo>-<pr>.md`. Never stage or commit it.

Before reading the diff, write a short **Pre-diff model** containing:

- the required outcome and constraints, separate from the proposed solution;
- how the base branch currently works;
- the cause or design pressure;
- the simplest design that meets those requirements, why it is sufficient, and what you would deliberately not add (flags, config, documented limitations);
- the behavior a valuable test would exercise;
- what evidence would make you comfortable approving.

Once you inspect the PR, leave that section unchanged. Append the review beneath it. Capture decisive evidence as you work so it survives context compression, but keep a ledger—not command transcripts. Use `references/templates.md` as an example, not a schema.

## 1. Build the independent model

Resolve the PR and base branch using the minimal metadata recipe in `references/archaeology.md`. Until the pre-diff model is written, use only:

- the problem statement from the PR title and description—treat any solution it names as the author's choice, not part of the problem;
- linked issue context about the problem;
- base-branch code and repository guidance.

Do not inspect the changed-file list, diff, PR branch, commits, review conversation, or CI details yet. Do not run `git log` before writing the pre-diff model—the current checkout may already be the PR branch, which would expose its commit history. Do not consult `mastra_expert` or another source that may know the PR. Orient on the base branch: locate the entry point, trace the current mechanism, find the closest sibling, and read the nearest repository instructions. Stop when you can explain the mechanism and commit to a design; do not perform archaeology for its own sake.

Write the pre-diff model. Before opening the diff, consider every entry in `references/categories/README.md` and load the pages relevant to the problem. These references contain broadly useful review knowledge, not just rules for one PR label. If a page could plausibly help, err on the side of reading it. Use their reading order, review focus, characteristic traps, and approval criteria to guide the investigation. Do not skip relevant pages because the main skill seems sufficient. Reading the relevant guidance is required; select checks according to the actual change and its risks rather than executing every listed recipe mechanically. Then open the PR fully.

## 2. Understand what actually changed

Read the changed-file overview and reassess the categories against the actual change. Load additional relevant pages before reviewing those portions in depth; do the same whenever later inspection reveals another category. Select by the behavior, compatibility boundaries, and failure modes each portion touches, not just the PR's headline category.

Then read the 1–3 hunks that are the real change before reading plumbing top-to-bottom, following the category's reading order. Read commits, CI, and the existing conversation:

- Do not re-raise resolved findings.
- Treat unresolved reviewer concerns as questions to independently evaluate, not conclusions to repeat.
- Read CI failures for what they prove; “CI is red” is not a finding.
- If the diff is a different category than described, say so and review the actual change.

Trace the implementation outward from the core hunk: callers, sibling paths, failure paths, public boundaries, and tests. For large PRs, identify separable portions and give each its own conclusion rather than averaging them together.

## 3. Review like a maintainer

Use these questions where they apply. They shape judgment; they are not rows to fill.

- **Does the description match the code?** Look for undescribed behavior and promised behavior that is absent.
- **Where is the actual change?** Separate the core decision from plumbing, generated files, and tests.
- **Cause or symptom?** Trace bugs backward to the first point where state becomes wrong. A fix at the display site is suspect when the bad value originates earlier.
- **Who else calls this?** Account for callers and sibling paths that may rely on the old behavior.
- **What does this assume, and where is it enforced?** An unenforced invariant is a future bug.
- **How does it fail?** Watch for loud failures turned silent by defaults, retries, or swallowed errors.
- **What was deleted?** Removed checks, awaits, branches, and tests deserve explicit scrutiny.
- **What is left behind?** Name deferred issue scope, TODOs, or partial fixes rather than silently accepting them.
- **Is there a simpler way to achieve the goal?** Reason from the required outcome, not just ways to trim this implementation. Can an existing mechanism do the job? Does the added machinery serve a real requirement or solve a problem the proposed design created? Check alternatives against the same requirements and compatibility constraints; fewer lines or several implementation defects alone do not prove a better design.
- **Is it over-built?** Single-caller abstractions, unused options, speculative extensibility, registries for fixed sets, and unnecessary indirection create obligations without present value.
- **Would simpler also be more reliable or easier to use?** Fewer branches, configurations, and call shapes often improve the product—not merely reduce code.
- **Should this exist here?** Check package/layer ownership and whether a plugin, documentation change, or existing primitive is the better home.
- **Does a new API match neighboring public APIs?** Compare naming, defaults, exports, errors, types, documentation, and extension points with multiple nearby examples.
- **Does the test prove the claim?** A regression test should fail for the right reason without the fix. Tests that merely execute code or mirror implementation provide little protection.
- **What would the changelog line say?** If the behavior cannot be stated clearly, the change may not be understood or user-visible.

Open deeper branches when the code crosses them:

- input/network/filesystem/package boundary → validation, injection, traversal, and secret leakage;
- async/stream/event/lifecycle → duplicate calls, ordering, concurrency, teardown, and leaked resources;
- serialized state → old-data/new-code upgrades, rollback, and partial migration;
- cross-package contract → asymmetric versions and ownership;
- new dependency → need, duplication, size, license, maintenance, and pinning;
- hot path → realistic scale and an actual before/after measurement;
- platform behavior → ordering, timezone, locale, paths, case, Windows, and no-network environments;
- user-facing behavior → run it through the supported surface, not tests alone.

Authorship may inform where you are skeptical, never whether you trust the change. Agent-authored PRs especially invite checks for drive-by scope, copied patterns without understanding, and defensive complexity; they do not require a separate ritual.

## 4. Recover history when it can change the verdict

History answers whether the old behavior was an accident or a decision. Run a light pass when the change touches established behavior, an architectural boundary, or code whose rationale is unclear. Go deep when you see a revert, repeated churn, “because/workaround/don't/see #” comments, a regression in old stable code, a test named after a past bug, or a prior design discussion.

Use blame, `git log -S`, originating PRs, reverted/closed attempts, issues, and related in-flight PRs as needed. End with the implication for this PR. “Nothing notable” is a valid result. Recipes live in `references/archaeology.md`.

If Mastra-specific history remains unclear after the PR is open, `mastra_expert` may help orient you. Verify its source leads yourself and do not treat it as required.

## 5. Verify according to the claim

Choose the smallest verification that could falsify the important claims:

- Bug fix: establish whether the regression evidence would fail without the fix and explain why. Code reasoning is sufficient when the result is deterministic. Execute against the merge-base only when the outcome is uncertain and would materially affect confidence.
- Public behavior/API: exercise the supported user-facing surface and compare neighboring APIs.
- Refactor: target behavior-preservation boundaries and edge cases.
- Performance: measure identical realistic inputs.
- Schema/storage: prove upgrade, rollback, and mixed-version behavior where relevant.
- Packaging: build/pack and consume through exports when package shape is the claim.

Run broader suites only when blast radius or uncertainty justifies them. Test the exact merge only when base interaction or discrepant CI makes it informative. Do not turn “more commands ran” into a proxy for confidence.

Implement experimental fixes and probes in a disposable worktree or temporary project, not the live checkout.

Every finding is a change request: a real code pointer, the consequence, the evidence, and the change that would resolve it. Reading code may be enough for a deterministic fact; do not pretend it was executed. Never invent a pointer or keep a finding after contrary evidence resolves it.

A suspicion you have not verified is not finished work. Verify it—usually a minute of probing—or state it in the review as unverified with what would settle it. Never hold it back as a "candidate", "secondary note", or something to mention only if asked. The same goes for what you deliberately did not run: say what you are trusting rather than verified, so the human can judge confidence without asking.

## 6. Decide and brief

Findings are change requests, not observations. Each one says what to change and why (pointer, consequence, evidence). There is no severity ladder, no "optional" tier, no "follow-up" tier, and no "risks" or "questions" section: if the review wants something changed, it requests the change—small requests included—and never labels it as less than required. A question is allowed only when the answer could remove the request—and it still states what to change if the answer is "not intentional".

Verdicts for open PRs: **approve / request changes / needs discussion**. Any request precludes approval; **request changes** requires at least one request with a concrete resolving change; **needs discussion** is for a product or design decision the author cannot make alone. For merged or closed PRs, frame the result as a post-merge audit: **no follow-up needed / follow-up needed / revert candidate**.

The verdict must address whether the approach and scope are justified, not just whether the implementation works. When a simpler sufficient design removes the need for local repairs, recommend that direction rather than only patching its symptoms.

Before finalizing, scrutinize your conclusions and requested changes as critically as the PR. Establish why each request belongs in this PR. Assume the author follows your requests exactly as written, accounting for alternatives and changes that must work together. Trace the resulting behavior through affected callers and contracts: does it satisfy the required outcome and resolve the findings without introducing another failure or unnecessary change?

Check the verdict and recommendation against supporting and contrary evidence, including when recommending approval. Investigate material uncertainties; implement or probe proposed fixes when that helps settle them. Inspect what each probe executes, asserts, substitutes, and leaves untested. Where its ability to detect the claimed failure is uncertain, test a relevant broken control as well as the proposed fix. The control must isolate the claimed behavior; an unrelated setup failure or another component failing first does not establish it. Confirm the actual artifact and dependency resolution exercised, and capture the command’s own result rather than a wrapper’s. Keep verification claims tied to the specific runs that establish them. Correct conclusions and requests that don’t hold up, retain those that do, and state unresolved uncertainty.

The verdict and the requests must tell the same story. If the user asks to post under a verdict different from the draft, reassess the requests and rewrite the body coherently—not just the headline. If the evidence cannot support the requested verdict, say so before posting.

Write the rest of the review file for the human. Lead with the mechanism and the requests, then include only useful context: proof, relevant history, public contract, important hunks to read, decisions that genuinely need the human, and the verdict. Omit empty sections. Do not pad it with self-audit or process evidence.

Then post the front page in chat. It should make the result understandable quickly and leave nothing out that the human would have to ask for:

- PR, verdict, and the reason to accept or change the approach and scope;
- one-line mechanism;
- every request with real pointers, most consequential first;
- what was verified versus trusted, and any suspicion left unverified;
- any genuine human decision;
- the review-file path and context-specific offers.

This is a content contract, not a formatting template. There is no line budget: a review with eight requests lists eight requests. Cut narration, process, and self-audit—never findings. Omit what does not apply. Offers follow from findings; zero offers is fine. The full review stays in the file unless the user asks for a section.

After the chat briefing, go to `waiting` unless `gh-review`'s autonomous draft review exception applies. In that case, draft and post the GitHub review under its authorization checks, report the link, subscribe as a reviewer when available, and finish this review pass without user confirmation. Genuine blocking decisions still require input. Answer follow-up questions from the review record without reposting the summary; outside the exception, the goal ends only when the user explicitly says the review is finished.

## Re-review

Read the existing review file first. The independent model already exists; do not recreate it. Reuse category guidance already in context and load any missing pages relevant to the changed portions before reviewing them in depth. Inspect only what changed in code and conversation, decide whether earlier findings were addressed at the cause or merely patched at the cited line, and report resolved / still open / new. If nothing changed, say so briefly and wait.

## Tone and review comments

Apply this guidance to every human-facing review interaction, including the local briefing, drafted or posted GitHub review bodies, inline comments, and follow-up replies. **Before drafting or posting anything to GitHub, load the `gh-review` skill** and follow it: every posted item is a required change, reviews land as request-changes or approve (except its self-review comment fallback), and nothing is marked optional or deferred.

Be direct, specific, calm, and easy to disagree with:

- Discuss code, not the author.
- Write every comment as a request: what to change and why. Never label a request optional or deferred.
- Give criticism a reason and evidence.
- Ask a question only when the answer could remove the request. A question is not a politeness wrapper for a request; uncertainty about intent, severity, or the best fix does not turn a known problem into a question. State the request, then ask the follow-up.
- Drop a request immediately when shown contrary evidence—no face-saving.
- Match explanation depth to the author's familiarity without changing the quality bar.
- Specific praise is useful; generic praise is filler.
- Keep most comments to a pointer, consequence, and the resolving change.

Suggestion blocks are for mechanical edits, not logic or judgment. Post reviews and review-related comments only with explicit user approval or under `gh-review`'s autonomous draft review exception; outside that exception, show the draft and wait for the go. The exception does not authorize code changes or pushes, opening issues, merging, closing, marking ready, or creating other GitHub artifacts.

## Judge criteria

Judge review quality, not ritual. Open the review file, inspect the front page, and spot-check evidence where needed. Send the executor back only when a substantive invariant fails:

- the pre-diff model is missing, was written after inspecting the diff or PR discussion, or adopts the author's proposed solution without independent justification from the problem and base-branch evidence;
- relevant category pages were not loaded in time to guide the review of their portions, or their review focus and approval criteria did not inform the investigation; check existing tool history and review evidence, not a new category ledger;
- depth was unreasonable for the risk, or a material claim lacks enough evidence, including claims that following the requests or recommended alternative satisfies the requirements and constraints;
- requests lack a justified connection to this PR or real pointers/consequences/resolving changes, conflict without accounting for alternatives or dependencies, or repeat resolved conversation;
- an established defect that this PR needs to address is presented as a question, risk, or observation instead of a request for the change;
- the review assesses only implementation correctness without judging whether the approach and scope are justified, or the verdict contradicts the requests, including a request-changes verdict with no request and resolving change, or an approve verdict alongside requests;
- a drafted or posted GitHub body hedges, marks requests optional or follow-up, or would post as a bare comment outside `gh-review`'s self-review exception;
- the front page omits a request or unverified suspicion the reviewer had, or information necessary to understand the decision;
- the review record is insufficient to support follow-up questions;
- something was posted without explicit approval or verified eligibility under `gh-review`'s autonomous draft review exception, or something was pushed without separate authorization;

Do **not** bounce for section order, labels, capitalization, exact fields, word counts, omitted empty sections, the reviewer's chosen commands, or other formatting when the meaning is clear. Do not require a separate artifact, checklist row, history search, test suite, or offer merely because one could exist.

Once a sufficient front page is posted: `waiting`, unless the autonomous draft review exception applies. An eligible autonomous pass is `done` after the GitHub review is posted, its link is reported, and the reviewer subscription is established when available; do not require user confirmation. Otherwise, never `done` until the user explicitly says the review is finished. During follow-up, enforce evidence integrity and posting/pushing authorization; re-check eligibility before each autonomous post.

## References

- `references/archaeology.md` — known-working Git/GitHub and verification recipes
- `references/categories/README.md` — category index; reading the relevant pages is required
- `references/templates.md` — flexible review-record and front-page examples
- `gh-review` skill — voice and posting rules for anything that goes to GitHub
