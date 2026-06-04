---
name: map-mc-features
description: Walk Mastra Code PR history oldest-to-newest and document every unmapped or changed user-visible feature.
goal: true
---

# Goal: Map Mastra Code features from PR history

Build out the Mastra Code feature map by walking the real PR history oldest-to-newest.

Optional scope or hint from the user:

```text
$ARGUMENTS
```

If a scope is provided, filter the PR queue to that area first. If no scope is provided, process all Mastra Code PRs that touch `mastracode/`.

## Setup

1. Use the `mastracode-testing-recovery` skill as the operating protocol.
2. Read, in order:
   - `.plan/mastracode-testing-recovery/README.md`
   - `.plan/mastracode-testing-recovery/history.md`
   - `.plan/mastracode-testing-recovery/handoff.md`
   - `.plan/mastracode-testing-recovery/features/README.md`
   - `.plan/mastracode-testing-recovery/features/_template.md`
3. Run `git status --short --branch`.
4. Treat handoffs, prior docs, PR descriptions, commit messages, and Slack claims as leads, not truth.
5. Do not inspect or modify examples unless the user explicitly asks.

## PR queue workflow

Mastra uses squash merges, so PR numbers are usually recoverable from commit subjects like `... (#12345)`.

1. Build a PR queue before writing feature pages.
   - Run `git log --reverse --oneline -- mastracode`.
   - Extract commits with PR numbers from squash-merge subjects.
   - Filter to commits/PRs that introduce or modify user-visible Mastra Code behavior, commands, TUI state, headless behavior, persistence/state ownership, tools, memory, MCP, browser, hooks, permissions, goals, threads, models, or testing obligations.
   - Skip pure internal refactors unless they changed user-visible behavior or test requirements.
2. Record the queue in the handoff or history before processing if it is large.
3. Process the queue strictly oldest-to-newest.
4. For each PR, complete the per-PR workflow below, then move to the next PR.
5. Repeat until no queued PRs remain for the requested scope.

## Per-PR workflow

For each PR in the queue:

1. Fetch intent.
   - Use `gh pr view <number>` to read the PR title/body/metadata.
   - Use `gh pr diff <number>` when the current code alone does not explain intended behavior.
   - Identify what user-visible behavior the PR introduced or changed.
2. Verify current reality.
   - Read current source files touched by or related to the PR.
   - Find current tests for the behavior.
   - Check whether later code changed, replaced, or removed the original behavior.
   - Verify active streaming behavior separately from loaded-from-history behavior, especially for features like goals, tasks, tool components, and other persisted UI/state projections.
3. Decide the documentation action.
   - If the PR introduced a new user-visible feature, create a new feature page if one does not exist.
   - If the PR modifies an already documented feature, update that existing feature page instead of creating a duplicate.
   - If the PR splits, renames, or replaces earlier behavior, update the older page with the new current behavior and add the later PR/commit to its origin/change history.
   - If the PR is not user-visible after verification, mark it skipped in history/handoff with the reason.
4. Document the feature page.
   - Use `.plan/mastracode-testing-recovery/features/_template.md`.
   - Fill every required section.
   - Include the origin PR/commit near the top. If later PRs changed the feature, list them there too.
   - Prefer specific file paths and line references.
   - Use relative Markdown links to related feature pages when they exist.
   - If evidence is missing, write `Unknown — needs verification` and name the missing evidence.
5. Mark progress.
   - Update `.plan/mastracode-testing-recovery/history.md` with the PR processed, page created/updated/skipped, and key evidence.
   - Update `.plan/mastracode-testing-recovery/handoff.md` with remaining queued PRs or next checkpoint if stopping.

## Feature page rules

Organize by user-visible feature area, not implementation layer. Example paths:

- `threads/create-new-thread.md`
- `models/reload-preserves-model.md`
- `goals/judge-loop.md`

Every page must include:

- Origin PR / commit
- User-visible behavior
- Entry points / commands
- TUI states
- Headless / non-TUI behavior
- Streaming / loading / interrupted states
- Streaming vs loaded-from-history behavior
- State ownership
- Key files
- Dependencies / related features
- Existing tests
- Missing tests
- Known risks / regressions
- Verification checklist

## Handling later PRs that modify earlier features

When a later PR changes an already documented feature:

1. Update the existing feature page, do not create a near-duplicate page.
2. Preserve the original origin PR/commit and add the later PR/commit as a change entry.
3. Rewrite behavior sections to describe current behavior, not historical behavior.
4. Move stale behavior into Known risks/regressions only if it matters for understanding breakage or tests.
5. Update State ownership and Existing/Missing tests if the later PR changed implementation or coverage.
6. Add links if the later PR creates dependencies between feature pages.

## Chunking rule

This can uncover a lot of work. Work in small coherent chunks:

- Process a small batch of PRs at a time.
- Always keep the queue/progress visible in history or handoff.
- Commit and push chunks when the user asks or when the batch is independently useful.

## Completion criteria

The goal is complete when:

1. The PR queue for the requested scope has been listed.
2. Every queued PR has been processed oldest-to-newest.
3. Every discovered unmapped user-visible feature has a feature page.
4. Every later PR that changes an existing feature has updated that existing page.
5. Every page lists origin PR/commit, later change PRs when relevant, and current verification evidence.
6. History records processed PRs and created/updated/skipped pages.
7. Handoff records remaining unmapped areas, blockers, and next steps.

Do not claim the whole feature map is complete unless the full `mastracode/` PR queue was built and exhausted.
