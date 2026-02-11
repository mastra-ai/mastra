# PR #12925: feat(memory, opencode): add @mastra/opencode plugin and standalone observe() API

**Branch:** `om-opencode` → `main`
**Files changed:** 12 (+1001, −347)
**Check status:** Core, Agent Builder, MCP, RAG, E2E, Tool Builder, Observability ✅ | Memory, Full Suite, CodeQL, pkg.json validation ❌

---

## Overview

This PR does two things:

1. **Creates `@mastra/opencode`** — a new plugin package (`integrations/opencode/`) that integrates Mastra's Observational Memory (OM) into [opencode](https://opencode.ai) sessions. It compresses long conversation histories into structured observations so the model's context window doesn't overflow.

2. **Extends `@mastra/memory`'s `ObservationalMemory` class** to support a standalone `observe()` API. Previously, `observe()` only worked within Mastra's internal message pipeline (reading from storage). Now it can accept external messages directly and includes lifecycle hooks — enabling integrations like opencode that manage their own message storage.

---

## How It Works

### The Problem

opencode manages its own conversation messages. Mastra's OM was previously coupled to its own storage layer — it could only observe messages it had stored itself. This PR decouples observation from storage by letting callers pass messages in directly.

### The Architecture

The integration uses a **three-agent architecture** (Actor → Observer → Reflector):

```
┌──────────────────────────────────────────────────────────────────┐
│  opencode session                                                │
│                                                                  │
│  User ←→ LLM (Actor)                                            │
│           │                                                      │
│           ▼ (after each turn)                                    │
│  messages.transform hook                                         │
│     ├── Convert opencode messages → MastraDBMessage format       │
│     ├── om.observe({ threadId, messages, hooks })                │
│     │    ├── If tokens < threshold → skip (return early)         │
│     │    ├── Observer Agent → compresses messages → observations  │
│     │    └── If obs tokens > reflect threshold                   │
│     │         └── Reflector Agent → consolidates observations    │
│     └── Filter out already-observed messages from context        │
│                                                                  │
│  system.transform hook                                           │
│     ├── Load active observations from OM record                  │
│     ├── optimizeObservationsForContext() → fit token budget       │
│     └── Inject into system prompt:                               │
│          OBSERVATION_CONTEXT_PROMPT + <observations> + HINT      │
│                                                                  │
│  session.created hook                                            │
│     └── om.getOrCreateRecord(sessionId) (eager initialization)   │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow (per chat turn)

1. **session.created** → eagerly creates an OM record for the session ID so the first `observe()` call doesn't have to initialize one
   - [`integrations/opencode/src/index.ts:222-238`](integrations/opencode/src/index.ts#L222-L238)

2. **messages.transform** → converts opencode's message format to `MastraDBMessage[]`, then calls `om.observe()`:
   - Message conversion: [`integrations/opencode/src/index.ts:73-144`](integrations/opencode/src/index.ts#L73-L144)
   - Observe call with hooks: [`integrations/opencode/src/index.ts:246-301`](integrations/opencode/src/index.ts#L246-L301)
   - Inside `observe()`, the lock is acquired, the record is fetched, threshold is checked, and either `doSynchronousObservation` or `doResourceScopedObservation` runs: [`observational-memory.ts:5460-5526`](packages/memory/src/processors/observational-memory/observational-memory.ts#L5460-L5526)
   - After observation, messages already processed are filtered out of the context window based on `record.lastObservedAt`

3. **system.transform** → retrieves the active observations, optimizes them for the token budget, and injects them wrapped in `OBSERVATION_CONTEXT_PROMPT` + `OBSERVATION_CONTINUATION_HINT`:
   - [`integrations/opencode/src/index.ts:304-363`](integrations/opencode/src/index.ts#L304-L363)

---

## Key Changes

### New Files

| File                                                                                                                                              | Purpose                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`integrations/opencode/src/index.ts`](integrations/opencode/src/index.ts)                                                                        | Plugin implementation (413 lines). Defines `MastraOMPluginConfig`, message conversion, credential resolution, and three lifecycle hooks |
| [`integrations/opencode/package.json`](integrations/opencode/package.json)                                                                        | Package config for `@mastra/opencode@0.0.1`. Deps: `@mastra/memory`, `@mastra/core`, `@mastra/libsql`                                   |
| [`integrations/opencode/tsup.config.ts`](integrations/opencode/tsup.config.ts)                                                                    | Build config                                                                                                                            |
| [`integrations/opencode/eslint.config.js`](integrations/opencode/eslint.config.js)                                                                | Lint config                                                                                                                             |
| [`integrations/opencode/tsconfig.json`](integrations/opencode/tsconfig.json) / [`tsconfig.build.json`](integrations/opencode/tsconfig.build.json) | TypeScript configs                                                                                                                      |
| [`.opencode/mastra.json`](.opencode/mastra.json)                                                                                                  | Plugin config (model: `google/gemini-2.5-flash`, scope: `thread`)                                                                       |
| [`opencode.json`](opencode.json)                                                                                                                  | Points opencode to the local plugin directory (dev-only, uses `file://` path)                                                           |
| [`.changeset/metal-maps-watch.md`](.changeset/metal-maps-watch.md)                                                                                | Changeset: `@mastra/memory` minor, `@mastra/opencode` patch                                                                             |

### Modified Files

| File                                                                                                                                                         | What changed                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [`packages/memory/src/processors/observational-memory/observational-memory.ts`](packages/memory/src/processors/observational-memory/observational-memory.ts) | **Core changes** — see details below                                                       |
| [`packages/memory/src/processors/observational-memory/index.ts`](packages/memory/src/processors/observational-memory/index.ts)                               | New exports: `OBSERVATION_CONTINUATION_HINT`, `OBSERVATION_CONTEXT_PROMPT`, `ObserveHooks` |
| `pnpm-lock.yaml`                                                                                                                                             | Lockfile update for new package                                                            |

### Changes to `observational-memory.ts` (detail)

1. **`observe()` signature change** (BREAKING) — [`L5460-5526`](packages/memory/src/processors/observational-memory/observational-memory.ts#L5460-L5526)
   - **Before:** `observe(threadId: string, resourceId?: string, _prompt?: string)`
   - **After:** `observe(opts: { threadId, resourceId?, messages?, hooks? })`
   - Now accepts `messages: MastraDBMessage[]` to bypass storage reads
   - Now accepts `hooks: ObserveHooks` for lifecycle notifications
   - Adds `meetsObservationThreshold()` check before proceeding (previously skipped in the public API)

2. **`getOrCreateRecord()` made public** — [`L1432`](packages/memory/src/processors/observational-memory/observational-memory.ts#L1432)
   - Was `private`, now `async` (public). Enables eager initialization before observation cycles.

3. **Extracted constants** — [`L526-548`](packages/memory/src/processors/observational-memory/observational-memory.ts#L526-L548)
   - `OBSERVATION_CONTINUATION_HINT` — the system-reminder text injected when messages are truncated
   - `OBSERVATION_CONTEXT_PROMPT` — the framing prompt wrapping `<observations>` blocks
   - Previously these were inline strings; now they're exported constants reusable by integrations

4. **`meetsObservationThreshold()` extracted** — [`L1366-1376`](packages/memory/src/processors/observational-memory/observational-memory.ts#L1366-L1376)
   - New private helper that checks if unobserved tokens meet the dynamic threshold
   - Used in the standalone `observe()` for both thread and resource scopes

5. **Methods refactored to object params** — `doSynchronousObservation`, `doResourceScopedObservation`, and `maybeReflect` now take a single `opts` object instead of positional args. This enabled adding `reflectionHooks` without expanding already-long parameter lists.

6. **`persistMarkerToStorage()` removed** — The method that persisted observation/reflection markers to the DB for page-reload survival was deleted. Three call sites removed. This was specific to the UI badge persistence and appears to have been superseded.

7. **`setPendingMessageTokens()` call removed** — One call in `processInputStep` that persisted computed token counts for UI display was removed ([L3425](packages/memory/src/processors/observational-memory/observational-memory.ts#L3425)).

8. **Reflection hooks threaded through** — `reflectionHooks` (subset of `ObserveHooks`) is passed through `doResourceScopedObservation` → `maybeReflect` → calls `onReflectionStart`/`onReflectionEnd` at the right lifecycle points.

---

## Architecture Impact

- **New integration surface**: `@mastra/opencode` is the first consumer of the standalone `observe()` API. The pattern it establishes (convert external messages → call `observe()` with hooks → inject observations into system prompt) is reusable for any external system.

- **Decoupled from storage**: OM can now observe messages without them being in Mastra's message store. This is a significant architectural shift — previously OM was tightly coupled to `this.storage` for both reading and writing messages.

- **Breaking change**: Any existing callers of `observe(threadId, resourceId)` must migrate to `observe({ threadId, resourceId })`. The changeset correctly marks this as `minor` for `@mastra/memory`.

---

## Dependencies

### `@mastra/opencode` depends on:

- `@mastra/memory` (workspace) — for `ObservationalMemory`, types, prompts
- `@mastra/core` (workspace) — for `MastraDBMessage` type
- `@mastra/libsql` (workspace) — for `LibSQLStore` (SQLite-backed storage)
- `@opencode-ai/plugin` (peer) — plugin interface contract

### `@mastra/memory` changes:

- No new dependencies
- Expanded public API surface

---

## Testing

- **No new tests added** for the opencode plugin or the standalone `observe()` API
- Memory tests are **failing** in CI — needs investigation whether this is pre-existing or introduced by this PR
- The changeset documents the breaking `observe()` signature change

---

## Potential Concerns

1. **Breaking change in `observe()`**: The changeset marks `@mastra/memory` as `minor` but `observe()` takes a new signature. Any existing callers using the positional API will break. Check if there are other callers:

   ```
   grep found `observe(threadId` in observational-memory.test.ts and potentially other tests
   ```

2. **`opencode.json` contains a local `file://` path**: [`opencode.json`](opencode.json) points to `file:///Users/abhiramaiyer/.superset/worktrees/mastra/om-opencode/integrations/opencode` — a developer-specific absolute path. This file is committed but is dev-only config.

3. **Removed `persistMarkerToStorage`**: This method handled persisting observation/reflection markers so they survived page reloads. Its removal means marker state may be lost if the stream closes before markers are persisted through the normal writer path. This may be intentional if the opencode integration doesn't use the same UI persistence model.

4. **No threshold check in resource scope when `messages` is empty**: In `observe()` for resource scope ([L5478](packages/memory/src/processors/observational-memory/observational-memory.ts#L5478)), when `messages` is not provided, `currentMessages` defaults to `[]`, so `countMessages([])` returns 0, and `meetsObservationThreshold` will likely return false (skip observation). The old code passed `[]` and relied on `doResourceScopedObservation` to load from storage. This may be a regression for resource-scoped `observe()` calls without messages.

5. **Failing CI checks**: Memory tests, CodeQL, Full Test Suite, and pkg.json validation are failing. Worth verifying whether failures are related to this PR's changes.
