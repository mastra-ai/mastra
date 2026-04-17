# PR Summary: fix(core): let trajectory extraction read V2 tool-invocation parts

**PR**: #15439
**Author**: shaun0927 (JunghwanNA)
**Branch**: `fix/evals-trajectory-v2-tool-parts`
**Stats**: 124 additions, 2 deletions, 3 files changed
**State**: OPEN, **CONFLICTING** (merge conflict with main)

## Overview

`extractTrajectory()` — used by trajectory-based eval scorers — only reads `message.content.toolInvocations` (the legacy V4 field). When assistant messages store tool calls exclusively in V2 `content.parts` as `tool-invocation` entries (which is the newer format), those tool calls are silently dropped from eval trajectories. This makes trajectory scorers return incomplete or empty results depending on message format.

## How It Works

The fix adds a fallback: when `content.toolInvocations` is absent, `extractTrajectory()` now reads `content.parts`, filters for `type: 'tool-invocation'` entries, and maps each to its inner `toolInvocation` object — which has the same shape as legacy toolInvocations entries. The `??` operator ensures the legacy field always takes precedence when present.

**Before:**
```ts
const toolInvocations = message?.content?.toolInvocations;
```

**After:**
```ts
const toolInvocations =
  message?.content?.toolInvocations ??
  message?.content?.parts
    ?.filter(part => part?.type === 'tool-invocation' && !!part.toolInvocation)
    .map(part => part.toolInvocation);
```

## Key Changes

### Modified Files

- `packages/core/src/evals/types.ts:615` — Core fix: adds V2 parts fallback for `extractTrajectory()`. 7-line change replacing a single-line assignment with a `??` expression that falls back to filtering `content.parts` for `tool-invocation` entries.

- `packages/core/src/evals/types.test.ts:755-865` — Adds 3 regression tests under a new `describe('extractTrajectory')` block:
  1. **Legacy path** (line 756): Extracts tool calls from `content.toolInvocations` when present
  2. **V2 parts fallback** (line 789): Extracts tool calls from messages that only have `tool-invocation` parts (no `toolInvocations` field)
  3. **Precedence** (line 823): Proves `content.toolInvocations` wins when both sources are present

- `.changeset/many-things-glow.md` — Patch changeset for `@mastra/core`

### New Files

None.

## Architecture Impact

Minimal. The change is confined to a single read-path function used by eval scorers. No new dependencies, no API surface changes, no storage mutations.

**Type safety**: The PR uses an inline type predicate in the filter:
```ts
.filter((part): part is typeof part & { type: 'tool-invocation'; toolInvocation: ... } => ...)
```
This is correct but verbose. The codebase already has `MastraMessagePart` which includes the `tool-invocation` variant, so a simpler type narrowing could work, but the inline predicate is fine.

## Dependencies

None added.

## Testing

- 3 new test cases covering legacy, V2 parts-only, and precedence paths
- Tests are well-structured and document the behavioral contract
- Second commit specifically addresses CodeRabbit's suggestion to add legacy and precedence tests

## Potential Concerns

### 1. Merge Conflict (Blocking)
PR is **CONFLICTING** with `main`. The test file on main has grown (new `saveScorePayloadSchema` tests appended after line 754), so the PR's `@@ -752,3` hunk no longer applies cleanly. The production code change (`types.ts`) should still apply cleanly — only the test file conflicts.

**Resolution**: Simple rebase. The new test `describe` block just needs to be appended after the current end of file (line 780) instead of line 754.

### 2. CI Status
- Most CI checks are **PENDING** (build, lint, tests not triggered — likely due to merge conflict)
- One **FAILURE**: `Vercel – mastra-docs-1.x` (docs preview) — unrelated to code changes
- CodeRabbit and Socket Security: **SUCCESS**

### 3. Stale PR
PR opened April 16, 2026 (over a month old). The code change is still valid and the approach is correct, but the conflict needs resolution.

### 4. Type Predicate Complexity
The inline type predicate is complex:
```ts
(part): part is typeof part & { type: 'tool-invocation'; toolInvocation: NonNullable<typeof part>['toolInvocation'] }
```
This works but could be simplified. Not a blocker.

### 5. Empty Array vs Undefined
When `content.toolInvocations` is absent but `content.parts` exists with zero `tool-invocation` entries, the fallback returns an empty array `[]` rather than `undefined`. This is handled correctly by the existing `for...of` loop (iterates zero times), so behavior is correct.
