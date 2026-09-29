# Refactor

**Reviewing:** an equivalence proof — behavior before equals behavior after.
**Read first:** the tests. Assertions should be unchanged and green.
**Done means:** behavior provably identical; the diff is mechanically checkable; test behavior untouched.
**Trap:** test assertions changed (then it wasn't a refactor); a behavior change smuggled in. Test-file edits that only follow a rename or move (imports, fixtures, paths) with assertions untouched do not break the equivalence claim.
**Attention:** 100% implementation. The interface is unchanged by definition — if it isn't, this isn't a refactor.

## Questions

- **Did any test change?** If a test changed, either it was testing an implementation detail (fine — but then say that) or the behavior changed (then this is a behavior change wearing a refactor label). Either way, each test change needs a reason.
- **Is anything deleted?** A removed check, a removed await, a removed branch. Every deletion in a refactor must be shown redundant, not just unused-in-the-happy-path.
- **Who else calls everything touched?** Grep the callers. Refactors move things; callers that weren't updated are the breakage.
- **Is the diff mechanically checkable?** Rename + move + extract is checkable. Rename + move + extract + "simplified the logic while I was there" is not. If you can't verify equivalence by reading, the PR is too big or too mixed.
- **Did the failure modes change?** A refactor that consolidates three try/catches into one may have changed what gets swallowed. Same for default values, ordering of side effects, when things are awaited.
- **Concurrency / ordering.** Did anything move across an await, out of a lock, or from before an event to after it?
- **Was the old shape a decision?** Blame the removed structure. If it was shaped that way for a reason (a workaround, a constraint), the refactor needs to show the reason no longer applies.
- **Is the new abstraction earning its keep?** Refactors introduce abstractions. Same over-built tells: one caller, unused generality.
- **Does the description match?** "Pure refactor, no behavior change" is a claim. Check it against every hunk that isn't a rename.

## Signals → branches

- Any test file in the diff → read each change; classify as implementation-detail or behavior; the latter re-categorizes the PR
- A conditional, default, or await removed → find the case it handled; show it's still handled
- "Simplified" / "cleaned up" / "while I was there" in the description → look for the smuggled behavior change in exactly that hunk
- Diff too large to verify by reading → "should be split" finding; do not approve an equivalence you can't check
- Blame on the removed structure lands on a PR with a reason → deep history

## Verify

- **Tests unchanged**: `git diff <base>...HEAD --stat -- '**/*.test.*' '**/*.spec.*' '**/__tests__/**'` should be empty. If not, every changed test is a question.
- **Tests green on the branch** with no test changes: run the affected suite.
- Callers of every moved/renamed symbol: `archaeology.md` → Callers.
- For anything deleted: `git log -S` on the base to find why it was added.
- If the refactored path is exercisable (a script, an example), run it on base and branch and diff the output.
