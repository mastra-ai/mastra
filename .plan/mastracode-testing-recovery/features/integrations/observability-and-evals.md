# Observability and eval feedback

## Origin PR / commit

- PR: [#15642](https://github.com/mastra-ai/mastra/pull/15642) — adds Mastra Code eval scorers, observability configuration, and trace feedback commands.
- Later changes: [#16223](https://github.com/mastra-ai/mastra/pull/16223) — renames the recommended exporters to `MastraStorageExporter` and `MastraPlatformExporter`, keeps `DefaultExporter`/`CloudExporter` as deprecated compatibility exports, and wires Mastra Code to explicit storage + platform exporters; [#15173](https://github.com/mastra-ai/mastra/pull/15173) — adds PostHog-backed Mastra Code product analytics with `MASTRA_TELEMETRY_DISABLED` opt-out and no-op fallback.

## User-visible behavior

- What the user can do: configure cloud/local observability with `/observability`, annotate the latest trace with `/feedback`, run with live outcome/efficiency scorers attached to the code agent, and opt out of product analytics with `MASTRA_TELEMETRY_DISABLED=1`.
- Success looks like: local DuckDB tracing and platform exporter settings are resolved at startup, trace spans include request context, `/feedback` correlates ratings/comments to the current trace/run, and scorers evaluate code outcomes without blocking normal runs.
- Must preserve: restart-required settings semantics, resource-scoped platform tokens, sensitive-data filtering before export, explicit storage/platform exporter configuration, and sampled evals staying lightweight.

## Entry points / commands

- Commands / shortcuts / flags: `/observability`, `/observability connect`, `/observability disconnect`, `/observability local on|off`, `/observability status`, `/feedback up|down|0-10|comment <text>`.
- Automatic triggers: `createMastraCode()` configures storage/exporters and attaches `createOutcomeScorer()` plus sampled `createEfficiencyScorer()` to the code agent.

## TUI states

- Idle: `/observability status` displays cloud connection and local DuckDB state; `/observability connect` prompts for project ID and access token.
- Active / modal / error: `/feedback` needs current trace/run IDs; missing trace, missing observability, or invalid rating produces command feedback.

## Headless / non-TUI behavior

- Supported: agent scorers/exporters are configured in shared `createMastraCode()` runtime, so headless runs can produce observability/eval data when tracing is enabled.
- Not supported / unknown: no headless command interface for `/observability` or `/feedback` verified.

## Streaming / loading / interrupted states

- Streaming / loading: scorers evaluate completed run context/trajectory; observability exporters receive spans through runtime storage/exporter setup.
- Abort / retry / resume: feedback targets the current trace/run; interrupted or missing trace data should fail gracefully.

## Streaming vs loaded-from-history behavior

- While actively streaming: request context and tool trajectory are captured from live spans/messages.
- After reload / history reconstruction: `buildEvalContext()` can rebuild scorer context from stored messages and best-effort trace lookup by thread ID.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Cloud/platform observability config | `settings.observability.resources[resourceId]` + AuthStorage key `observability:<resourceId>` | `resolveCloudObservabilityConfig()`, `/observability status`, `MastraPlatformExporter` |
| Local tracing toggle | `settings.observability.localTracing` | DuckDB observability domain + `MastraStorageExporter({ strategy: 'event-sourced' })` setup |
| Eval request context | Harness state + thread ID + storage messages + observability traces | `buildEvalContext()`, outcome/efficiency scorers |
| Feedback correlation | Harness current `traceId` / `runId` / `threadId` | `/feedback`, observability event bus/exporters |
| Product analytics | `MastraCodeAnalytics` PostHog/no-op factory + `MASTRA_TELEMETRY_DISABLED` env opt-out | session/prompt/thread/model/command/interactive-prompt telemetry, cleanup shutdown |

## Key files

- `mastracode/src/index.ts` and `main.ts` — DuckDB/platform/storage observability setup, explicit `MastraStorageExporter` + `MastraPlatformExporter`, sensitive-data filter, request-context keys, scorer registration on the agent, and product-analytics startup/shutdown capture.
- `mastracode/src/evals/context-builder.ts` — converts stored messages, request context, and traces into scorer input/output/trajectory context.
- `mastracode/src/evals/scorers/outcome.ts` — always-on code outcome scorer for build/test/tool-error/loop/regression/autonomy dimensions.
- `mastracode/src/evals/scorers/efficiency.ts` — sampled efficiency scorer for redundancy, turn count, retry efficiency, and read-before-edit.
- `mastracode/src/evals/scorers/classify-command.ts` and `extract-tools.ts` — command classification and tool-call extraction helpers.
- `mastracode/src/tui/commands/observability.ts` — `/observability` status/connect/disconnect/local toggle command.
- `mastracode/src/tui/commands/feedback.ts` — `/feedback` trace rating/comment command.
- `mastracode/src/analytics.ts` — PostHog-backed analytics/no-op implementation, telemetry disabled parsing, session base properties, and safe capture/shutdown wrappers.
- `mastracode/src/tui/command-dispatch.ts`, `setup.ts`, `event-dispatch.ts`, `handlers/threads.ts`, and `components/help-overlay.ts` — command dispatch plus `/observability` command surface and analytics hooks for slash commands/interactive prompts.
- `observability/mastra/src/exporters/mastra-storage.ts`, `mastra-platform.ts`, `default.ts`, and `cloud.ts` — storage/platform exporter implementations and deprecated compatibility exporter names.

## Dependencies / related features

- [Core Harness API and reference docs](./harness-api.md) — eval context and request context are Harness-owned runtime data.
- [Help and shortcuts](../tui/help-and-shortcuts.md) — `/observability` appears in the help/command surface; `/feedback` dispatch exists but is not listed there in current source.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — eval scorers inspect tool calls, command exits, and edit/read ordering.
- [Persistent conversations](../threads/persistent-conversations.md) — eval context rebuilds from thread messages and trace lookup.

## Existing tests

- `mastracode/src/evals/scorers/__tests__/outcome.test.ts` — outcome scorer coverage for text-only, build/test results, tool errors, and stuck loops.
- `mastracode/src/evals/scorers/__tests__/efficiency.test.ts` — efficiency scorer coverage for redundancy, turn count, retry chains, and read-before-edit behavior.
- `mastracode/src/evals/scorers/__tests__/classify-command.test.ts` — command classifier, exit-code, success-result, and file-path matching coverage.
- `mastracode/src/analytics.test.ts` — telemetry-disabled env parsing, no-op safety, and disabled debug logging.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — dispatch layer mocks `/feedback` and `/observability` handlers and asserts tracked slash-command analytics.
- `observability/mastra/src/exporters/mastra-storage.test.ts` and `mastra-platform.test.ts` — storage exporter strategy/batching/drop behavior and platform exporter batching/endpoints/signal publishing/auth failure behavior.

## Missing tests

- Direct `/observability` command tests for connect/disconnect/status/local toggles, project ID validation, AuthStorage key persistence, and env-var status fallback.
- Direct `/feedback` tests for ratings, comments, missing trace/run IDs, and observability-event payload/correlation context.
- Integration test proving scorers are attached to the real agent config and receive reconstructed `buildEvalContext()` data from stored messages/traces.
- Startup/main-loop test that product analytics session-start, thread/model/command/prompt events, and shutdown remain safe when PostHog throws or telemetry is disabled.
- Headless/runtime smoke for DuckDB/storage/platform exporter startup and sensitive-data filtering.

## Known risks / regressions

- `/feedback` dispatch exists but current help/autocomplete coverage is uneven compared with `/observability`.
- Observability setting changes require restart; users may expect toggles to affect the current running process.
- Deprecated `CloudExporter`/`DefaultExporter` names remain exported for compatibility; new docs and Mastra Code runtime should prefer `MastraPlatformExporter`/`MastraStorageExporter`.
- Scorers inspect command text/tool trajectories heuristically; changes to tool result shapes or shell output can silently weaken scoring.
- Local credentials/env vars can affect observability status output unless tests isolate `MASTRA_CLOUD_ACCESS_TOKEN` and `MASTRA_PROJECT_ID`.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
