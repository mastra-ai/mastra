---
name: pr-splitter
description: Use when breaking a large, complex, messy, or hard-to-review pull request into multiple smaller PRs; planning stacked PRs; extracting independent changes from a branch; splitting mixed refactor and behavior changes; managing drift after review feedback; rebasing follow-up PRs as earlier PRs change; or preserving original branch intent while shipping incrementally.
---

# PR Splitter

Preserve the original PR as source material, build smaller reviewable PRs intentionally, and track drift locally as review feedback changes the stack.

## Required workflow

1. **Snapshot before touching history**
   - Check `git status`.
   - Create an immutable local reference to the original branch: `git branch backup/original-large-pr`.
   - Do not delete or rewrite the original branch until the split is complete.

2. **Inventory the original PR**
   - Inspect `git diff --stat <base>...HEAD`, `git diff --name-only <base>...HEAD`, and `git log --oneline <base>..HEAD`.
   - Classify changes by review unit: prep/refactor, API/type changes, behavior, tests, docs, cleanup, generated/lock files.

3. **Create a local scratchpad**
   - Write split notes to an uncommitted local file, preferably `.notes/pr-split.md`.
   - Ensure `.notes/` is ignored or leave it untracked. Do not commit scratchpad notes unless the user explicitly asks.
   - Track: original branch, base branch, planned PRs, files/hunks extracted, verification per PR, remaining original diff, and intentional drift from review feedback.

4. **Choose the split shape**
   - Use stacked PRs when later work depends on earlier work.
   - Use parallel PRs only when changes are truly independent.
   - Use foundation + parallel follow-ups when one shared prep change unlocks independent work.

5. **Extract changes safely**
   - Prefer fresh branches from the correct base plus selective restore over rewriting messy history.
   - Use path-level extraction for clean file ownership: `git checkout backup/original-large-pr -- path/to/file`.
   - Use hunk-level extraction for mixed files: `git restore -p --source backup/original-large-pr -- path/to/file`.
   - Keep each PR independently buildable and reviewable.

6. **Verify each PR independently**
   - Run the narrowest relevant build, typecheck, lint, and tests for that PR's scope.
   - Do not leave tests, docs, or generated files separated from the code they validate unless the split plan explicitly calls for it.

7. **Manage drift deliberately**
   - Treat reviewer-approved changes as the new source of truth for the stack.
   - After changing an earlier PR, rebase dependent PRs onto it and resolve conflicts in favor of the reviewed direction, not blindly in favor of the original branch.
   - Compare the evolving stack against `backup/original-large-pr` to find remaining intent, not to force byte-for-byte equality.
   - Record intentional differences in `.notes/pr-split.md`.

8. **Use range-diff for rewritten stacks**
   - Use `git range-diff` after rebases, conflict resolution, or force-pushes to understand what changed.
   - Summarize meaningful range-diff results for reviewers when updating a stacked PR.

## PR description pattern

Keep PR descriptions concise and reviewer-facing:

```markdown
## Summary

This is PR N of M split from a larger change.

## Scope

- ...

## Intentionally excluded

- Follow-up PR will handle ...

## Verification

- ...
```

Do not put the full split ledger in PR descriptions. Keep detailed extraction notes and drift tracking in `.notes/pr-split.md`.

## Scratchpad template

```markdown
# PR split scratchpad

Original branch: backup/original-large-pr
Base branch: main

## Planned PRs

1. branch-name
   - Scope:
   - Files/hunks extracted:
   - Verification:
   - Status:

## Remaining original intent

- ...

## Drift notes

- Date / branch / reason:
```

## Common failure modes

Avoid splitting by file when behavior spans files, extracting tests without code, leaving follow-up PRs uncompilable, force-pushing without a reviewer summary, deleting the original branch early, and reverting review feedback while resolving stack conflicts.

## Default output

When asked to split a PR, produce:

1. proposed PR sequence,
2. branch strategy,
3. scratchpad path and initial contents,
4. extraction commands,
5. verification plan for each PR,
6. drift-management plan.
