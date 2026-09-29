# Review record examples

These are examples, not schemas. Keep one file at `.mastracode/scratch/reviews/<owner>-<repo>-<pr>.md`. The pre-diff section is written first and left intact; everything else is appended after opening the PR.

## Review file

```markdown
# Review — <owner>/<repo>#<pr>: <title>

## Pre-diff model

Problem: <required outcome and constraints, separate from the proposed solution>
Base mechanism: <how it works today>
Cause/design pressure: <your theory>
Your design: <simplest sufficient design and why; what you would deliberately not add>
Valuable test: <behavior it should distinguish>
Approval evidence: <what would make you comfortable>

## Review

Mechanism: <before → after, including the trick>
Verdict: <approve | request changes | needs discussion — why the approach and scope are justified or should change>

### Requests

1. `file:line` — <what to change>
   <consequence and evidence>

### Proof

- <claim → probe or code evidence → result>

### Context

- <history, public contract, existing conversation, or hygiene only when it changes understanding>

### Read these

- `file:line-line` — <why this hunk matters>

### Needs you

- <a genuine product/taste/context decision, including what was already investigated>
```

The review file may be much shorter. Omit sections with nothing useful to say. Preserve decisive command output in a sentence or two; never paste full transcripts.

## Front page

A front page is as long as its findings and no longer. Fictional example with two requests:

```markdown
**example-org/widget-service#1842** · **request changes**
Mechanism: retry settings are now validated when configuration loads instead of at the first failed request. This is the right boundary, but the existing duration parser already serves this contract; a second parser is unnecessary.

1. `src/config/retries.ts:88` — reject or explicitly handle `0`; it currently falls back to the default retry count, so callers who disable retries get three.
2. `src/config/retries.ts:104` — reuse `parseDuration` instead of the new inline parser; two parsers for one format will drift.
   Verified: `pnpm --filter widget-service test` on the head; the `0` case by probe. Trusting: the PR's claim that the staging rollout used this config path.
   Unverified: `loadConfig` may be called twice on hot reload, which would double-validate; a `--watch` run would settle it.
   Needs you: decide whether `0` should disable retries or be rejected; the request above works either way.
   Review: `.mastracode/scratch/reviews/example-org-widget-service-1842.md`
   I can trace the zero-retry behavior or draft the finding as a review comment.
```

Eight requests would make this eight lines longer, and that is correct. A clean PR can be two or three lines. A merged PR uses post-merge language. A re-review says what resolved, what remains, and what is new. Labels and order are not contractual; comprehension is.
