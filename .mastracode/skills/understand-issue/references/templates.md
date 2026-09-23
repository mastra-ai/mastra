# Investigation record examples

These are examples, not schemas. Keep one file at `.mastracode/scratch/issues/<owner>-<repo>-<n>.md`. The own-model section is written before reading any comments or linked PRs (when the thread has them) and left intact; everything else is appended beneath it.

## Record file

```markdown
# Issue — <owner>/<repo>#<n>: <title>

## Own model

Symptom: <what the reporter observes, in your words>
Current mechanism: <how the relevant code works today>
Hypothesis: <your theory of the cause>
Decisive evidence: <what would confirm or kill it>

## Investigation

Verdict: <bug | regression of <sha/#pr> | working as designed | configuration or usage | docs gap | duplicate of #N | cannot determine — needs <info>>
Mechanism: <symptom ← cause, including where state first goes wrong>

### Evidence

- <claim → probe or code pointer → result>

### Fix direction

- `file:line` — <what should change and why>; <what the obvious patch would miss, if anything>
- Also: <other affected sites, docs, missing test>

### History

- <only what changes understanding: originating PR, regression commit, prior fix attempt>

### Related

- #N — <duplicate | same symptom, different cause | in-flight fix>

### Needs you

- <a genuine product/priority decision, or the specific question for the reporter>
```

The record may be much shorter. Omit sections with nothing useful to say. Preserve decisive command output in a sentence or two; never paste full transcripts.

## Front page

As long as its conclusions and no longer. Fictional example:

```markdown
**example-org/widget-service#917** · **bug**
Mechanism: retries stop after the first attempt ← `RetryPolicy.next()` reads `attempt` before `advance()` increments it, so the second call sees `attempt === max`.
Fix: `src/retry/policy.ts:41` — advance before comparing; the reporter's "set max to 4" workaround masks it rather than fixing it.
Also: `src/retry/backoff.ts:18` has the same read-before-advance pattern; no test covers a second attempt.
History: introduced in #880 (refactor), not a design decision.
Verified: reproduced with a two-attempt probe on `main`. Unverified: whether the jitter path at `backoff.ts:33` hits the same bug; a probe with jitter enabled would settle it.
Record: `.mastracode/scratch/issues/example-org-widget-service-917.md`
I can draft the diagnosis as an issue comment or start the fix.
```

More findings make a longer front page, and that is correct. A "cannot determine" front page names the exact missing information and the one question to ask. A duplicate names the canonical issue and whether the mechanism matches. A re-investigation says whether the diagnosis stands, changed, or is resolved. Labels and order are not contractual; comprehension is.
