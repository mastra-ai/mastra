# Harness v1 / HarnessCompat architecture review

This directory contains a suspicious, oldest-to-newest review of the Harness v1 migration and Mastra Code compatibility stack.

The review is intentionally biased toward finding regressions. The migration touched runtime ownership, state ownership, messages, signals, queueing, tools, suspensions, permissions, subagents, memory, storage, thread/session identity, and TUI/headless event projection. Those are all product-critical surfaces in Mastra Code.

## Files

- [`00-baseline-mastracode-before-harness-v1.md`](./00-baseline-mastracode-before-harness-v1.md) — detailed baseline architecture and feature map before Mastra Code adopted Harness v1.
- [`prs/`](./prs/) — one markdown review per Harness v1 / compat PR, ordered oldest to newest.
- [`raw/`](./raw/) — saved GitHub PR metadata, diff stats, generation script, and PR ordering.

## PR order reviewed

1. [#16817 chore(core): rename legacy harness class](./prs/01-pr-16817-chore-core-rename-legacy-harness-class.md)
2. [#16818 feat(core): add harness v1 subpath scaffold](./prs/02-pr-16818-feat-core-add-harness-v1-subpath-scaffold.md)
3. [#16822 feat(core): add harness v1 type layer](./prs/03-pr-16822-feat-core-add-harness-v1-type-layer.md)
4. [#16827 feat(core): add Harness v1 storage domain](./prs/04-pr-16827-feat-core-add-harness-v1-storage-domain.md)
5. [#16842 feat(core): add Harness v1 registry](./prs/05-pr-16842-feat-core-add-harness-v1-registry.md)
6. [#16845 feat(core): add Harness v1 session state](./prs/06-pr-16845-feat-core-add-harness-v1-session-state.md)
7. [#16848 feat(core): add Harness v1 session accessors](./prs/07-pr-16848-feat-core-add-harness-v1-session-accessors.md)
8. [#16853 feat(core): expose agent thread run outputs](./prs/08-pr-16853-feat-core-expose-agent-thread-run-outputs.md)
9. [#16879 Add latest Harness v1 runtime foundation](./prs/09-pr-16879-add-latest-harness-v1-runtime-foundation.md)
10. [#16881 feat(core): add Harness v1 event id helpers](./prs/10-pr-16881-feat-core-add-harness-v1-event-id-helpers.md)
11. [#16882 feat(core): add Harness v1 admission storage](./prs/11-pr-16882-feat-core-add-harness-v1-admission-storage.md)
12. [#16890 feat(core): add Harness v1 attachments](./prs/12-pr-16890-feat-core-add-harness-v1-attachments.md)
13. [#16894 feat(core): add Harness v1 session messages](./prs/13-pr-16894-feat-core-add-harness-v1-session-messages.md)
14. [#16895 feat(core): add Harness v1 session signals](./prs/14-pr-16895-feat-core-add-harness-v1-session-signals.md)
15. [#16896 feat(core): add Harness v1 session queue](./prs/15-pr-16896-feat-core-add-harness-v1-session-queue.md)
16. [#16897 feat(core): add Harness v1 session permissions](./prs/16-pr-16897-feat-core-add-harness-v1-session-permissions.md)
17. [#16898 feat(core): add Harness v1 session suspensions](./prs/17-pr-16898-feat-core-add-harness-v1-session-suspensions.md)
18. [#16899 feat(core): add Harness v1 built-in tools](./prs/18-pr-16899-feat-core-add-harness-v1-built-in-tools.md)
19. [#16901 feat(core): add Harness v1 display state](./prs/19-pr-16901-feat-core-add-harness-v1-display-state.md)
20. [#16902 feat(core): add Harness v1 goals](./prs/20-pr-16902-feat-core-add-harness-v1-goals.md)
21. [#16912 feat(core): add Harness v1 runtime](./prs/21-pr-16912-feat-core-add-harness-v1-runtime.md)
22. [#16933 feat(mastracode): add Harness v1 adapter](./prs/22-pr-16933-feat-mastracode-add-harness-v1-adapter.md)
23. [#16943 feat(mastracode): run on Harness v1 runtime](./prs/23-pr-16943-feat-mastracode-run-on-harness-v1-runtime.md)
24. [#17068 fix(mastracode): recover from stale Harness v1 session leases on startup](./prs/24-pr-17068-fix-mastracode-recover-from-stale-harness-v1-session-leases-on-startup.md)
25. [#17042 fix: stabilize MastraCode Harness v1 startup and resumes](./prs/25-pr-17042-fix-stabilize-mastracode-harness-v1-startup-and-resumes.md)
26. [#17090 fix(mastracode): propagate runtime memory and pubsub to custom Harness v1 mode agents](./prs/26-pr-17090-fix-mastracode-propagate-runtime-memory-and-pubsub-to-custom-harness-v1-mode-age.md)
27. [#17141 feat: add harness heartbeat handlers](./prs/27-pr-17141-feat-add-harness-heartbeat-handlers.md)
28. [#17276 feat(core, mastracode): add scoped Harness V1 session owner IDs](./prs/28-pr-17276-feat-core-mastracode-add-scoped-harness-v1-session-owner-ids.md)
29. [#17290 feat(core): add harness v1 events](./prs/29-pr-17290-feat-core-add-harness-v1-events.md)
30. [#17402 feat(core): add harness v1 session message and queue APIs](./prs/30-pr-17402-feat-core-add-harness-v1-session-message-and-queue-apis.md)
31. [#17411 feat(core): compose Harness v1 session state](./prs/31-pr-17411-feat-core-compose-harness-v1-session-state.md)
32. [#17511 fix(mastracode): fall back to legacy switchMode when no session is active](./prs/32-pr-17511-fix-mastracode-fall-back-to-legacy-switchmode-when-no-session-is-active.md)
33. [#17534 Refine Harness v1 session records and tools](./prs/33-pr-17534-refine-harness-v1-session-records-and-tools.md)
34. [#17541 fix: sync task state to V1 session in HarnessCompat](./prs/34-pr-17541-fix-sync-task-state-to-v1-session-in-harnesscompat.md)

## Most suspicious regression themes

### 1. Split state ownership

The biggest architectural smell is that `MastraCodeState` starts being owned by both legacy-compatible harness state and v1 session state. PRs #16845, #17411, #17541 and fixes around model/subagent/task state are direct evidence that this produced divergence.

Retest aggressively:

- task tools and task prompt injection
- `/mode`, `/models`, subagent model config
- `/yolo`, permissions, sandbox allowlist
- active plan and goal state
- thread switch/clone/restart

### 2. Thread/session identity and owner IDs

V1 adds session registry, storage, leases, and owner IDs. Later stale lease recovery and owner ID PRs suggest startup/resume was fragile.

Retest aggressively:

- crash/restart recovery
- two Mastra Code processes in one project
- headless `--continue` / `--thread`
- thread clone/fork behavior
- resource ID overrides

### 3. Message/signal/queue projection

Messages, signals, active-run interjections, and manual queued follow-ups were all reimplemented or re-routed. This is very likely to break “works most of the time” features.

Retest aggressively:

- message while active -> `delivery="while-active"`
- idle message -> `delivery="message"`
- Ctrl+F queued follow-up
- GitHub/notification signals
- multimodal/image parts
- signal data part hydration

### 4. Suspensions, approvals, and permissions

V1 added session permissions and suspensions. Mastra Code already had permissions, YOLO, request_access, ask_user, submit_plan, and tool approvals.

Retest aggressively:

- tool approval approve/deny
- YOLO bypass
- request_access path mutation
- ask_user single-select and multi-select
- submit_plan approval transition
- abort while prompt visible

### 5. Tools and subagents

V1 added built-in/canonical tools and native subagent spawning. Mastra Code already remapped workspace tools, wrapped hooks, rendered tool output, and had v0 subagents.

Retest aggressively:

- exposed tool names and schemas
- hook pre/post firing
- permission category mapping
- subagent model routing
- v0 vs v1 duplicate subagents
- subagent UI events and final result

### 6. Runtime context propagation

Custom mode agents needed follow-up fixes for memory and pubsub propagation. That points to broader runtime-context loss across v1 sessions.

Retest aggressively:

- custom modes
- OM observer/reflector models
- cross-process signals
- browser tools / workspace reconciliation
- MCP tools and hooks

## Recommended next review step

Use these docs as a checklist, then inspect the current implementation around:

- `mastracode/src/HarnessCompat.ts`
- `mastracode/src/index.ts`
- `mastracode/src/headless.ts`
- `mastracode/src/tui/event-dispatch.ts`
- `mastracode/src/tui/setup.ts`
- `mastracode/src/agents/workspace.ts`
- `mastracode/src/agents/tools.ts`
- `mastracode/src/agents/memory.ts`
- `packages/core/src/harness/v1/**`

The review should specifically look for state fields that are read from one owner and written to another.
