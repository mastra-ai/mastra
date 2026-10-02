# Large / cross-cutting

Many packages, many concerns, or simply too big to review in one sitting.

**Reviewing:** whether it should be one PR at all.
**Read first:** the structure — the file list grouped by package and by kind of change — not the content.
**Done means:** either split into reviewable units, or reviewed as a series with a design doc or plan up front, each unit under its own category's rules.
**Trap:** reviewing 3,000 lines in one sitting and calling it done.
**Attention:** the structure and the seams between concerns. Content review happens per-unit, after the structure question is settled.

## Questions

- **How many independent changes are in here?** Group the file list by concern. Each group that could land on its own is a candidate PR. Independent changes in one PR get one review's attention divided by N.
- **Can it be reviewed in one sitting?** If you can't, you're not reviewing it — you're skimming it. That's the honest answer, and it's the finding.
- **Is there a plan or design doc?** Large changes without a stated design are a design review disguised as a code review. Ask for the design; review that first.
- **What's the merge risk?** How long has this been open; how far has the base moved; how many in-flight PRs touch the same files.
- **Which parts are which category?** A large PR is always mixed. Triage each portion: the refactor part, the API part, the fix part. Each gets its own page and its own bar.
- **Is the size the problem, or the scope?** 2,000 lines of generated code is mechanical. 2,000 lines of hand-written changes across five packages is scope.
- **Can it be reviewed as a stack?** If the author can't split, can the commits be reviewed in order as if they were a stack? Only if the commits are clean units.
- **What does "approve" mean here?** You cannot vouch for 3,000 lines. Be explicit about what you reviewed deeply and what you skimmed — in the briefing and, if posted, in the review comment.

## Signals → branches

- File list spans >2 packages with different kinds of change → "should be split" finding; propose the split
- No design doc and the description is a change list → needs discussion; ask for the design before the code
- Commits are "wip," "fix," "more" → cannot be reviewed as a stack; split is the only path
- Commits are clean units → review in commit order; each commit under its own category

## Verify

- Group `git diff <base>...HEAD --stat` by concern and propose a split when it would improve reviewability.
- Use `git log --oneline <base>..HEAD` to assess whether commits are reviewable units.
- Verify high-risk units under their relevant category guidance.
- Search for in-flight PRs touching the same paths when merge-order risk is plausible.
- Be explicit about what you reviewed deeply and what you did not; no arbitrary line threshold determines sufficiency.
