# Mastra Code test recovery system

This document captures the proposed system for moving from feature mapping to high-confidence test coverage.

## Core quality bar

For every mapped feature, define the full set of user-facing and system-facing invariants that must remain true, then add enough tests across the right layers that breaking any invariant is very likely to fail CI.

Not one happy path. Not only the important stuff. The goal is a regression shield for everything we want to never break.

## TUI coverage rule

If a behavior is visible in, triggered from, or affected by the TUI, it gets TUI e2e coverage.

This is not optional and not merely representative. If users can see or interact with a behavior in Mastra Code, the TUI contract should be locked by an e2e test.

E2E tests should become cheap enough to use broadly by investing in:

- AIMock-driven deterministic model behavior.
- A solid Mastra Code TUI test utility.
- A dedicated testing skill that documents the patterns, fixtures, and verification expectations.

## Contract extraction

Each feature card should be converted into a behavior contract list before implementation begins.

For each feature, extract:

1. User contracts
   - What the user can do.
   - What they should see.
   - What must persist across restart, thread switch, mode switch, and config changes.

2. State contracts
   - Who owns the state.
   - When state is created, updated, persisted, restored, and cleared.
   - What must not leak across threads, resources, config dirs, or sessions.

3. Boundary contracts
   - CLI args, env, settings, auth, storage, network, filesystem, browser, git, gh, and tool-call boundaries.
   - How failures are surfaced, suppressed, retried, or persisted.
   - How old data and migrations behave.

4. Interaction contracts
   - How the feature composes with related features.
   - Example: model selection + thread switching + status line + prompt context.

5. Regression history contracts
   - Every historical bugfix/change in the feature card becomes a candidate invariant.
   - If a PR fixed something, ask: what test would have caught this before merge?

## Contract categories

Classify each invariant so the required test layer is obvious.

1. TUI-visible
   - Must have TUI e2e coverage.
   - Examples: status line, dialogs, command overlays, streamed messages, task list, notifications, ask_user, model selector.

2. TUI-triggered
   - Must have TUI e2e coverage for the command/user flow.
   - Usually also needs integration or unit tests for internals.
   - Examples: `/threads`, `/models`, `/github subscribe`, `/api-keys`, `/mode`.

3. Runtime/internal
   - Needs integration or unit coverage.
   - TUI e2e is required only when it has visible consequences.
   - Examples: provider registry fallback, storage migrations, signal dedupe, schema compatibility.

4. External/system boundary
   - Needs mocked integration or smoke coverage.
   - Examples: git, gh, auth callbacks, MCP, browser, filesystem.

## Test layers

Use the lowest reliable layer for each invariant, but do not skip TUI e2e for TUI-visible or TUI-triggered contracts.

- Unit tests: pure logic, parsing, formatting, reducers, config resolution, rendering helpers, permission decisions.
- Integration tests: Harness/session/storage/tool/signal/memory composition without a full terminal UI.
- TUI e2e tests: actual user-visible terminal workflows using AIMock and the TUI test utility.
- Smoke tests: packaged CLI or generated-project checks for the few paths that need binary-level proof.

## Work loop

For each feature or small feature cluster:

1. Read the feature card and related cards.
2. Extract the behavior contract list.
3. Classify each invariant by required test layer.
4. Identify existing tests that already cover each invariant.
5. Add missing tests until each invariant is covered or explicitly deferred with rationale.
6. Run focused verification first, then broader Mastra Code tests when appropriate.
7. Update the feature card with coverage evidence and remaining gaps.
8. Commit one coherent, reviewable chunk.

## Goal-judge shape

Work should be broken into discrete chunks that a goal judge can verify objectively.

A good goal should specify:

- The feature or feature cluster.
- The contract list to cover.
- The required test layers.
- The expected feature-card updates.
- The exact verification commands.
- What is explicitly out of scope.

Example goal shape:

> Add regression-shield tests for Branch context/status. Extract the feature's behavior contracts, add TUI e2e coverage for every visible/triggered branch-status behavior, add lower-layer tests for branch metadata calculation and git boundary handling, update the feature card with coverage evidence, and run the narrowest relevant Mastra Code verification commands.

## Open design questions

- What exact vocabulary should replace the current coarse `Missing` / `Partial` test status?
- Should every feature card get a contract table before any implementation PR starts?
- What is the minimum TUI test utility API needed before broad e2e coverage becomes cheap?
- How should AIMock scripts be represented so tests stay readable and deterministic?
- Which feature cluster should be the first pilot for this system?
