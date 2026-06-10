# PR #16853: feat(core): expose agent thread run outputs

Source: https://github.com/mastra-ai/mastra/pull/16853

Order: 8 of 34

Status: CLOSED; treat as stacked/unmerged unless absorbed by another PR.

Stack edge: `feat/harness-v1-session-operations` -> `feat/harness-v1-agent-run-output`

Diff size: +335 / -2; 4 changed files.

## Before

Agent thread run output was consumed through legacy harness events/messages and Mastra Code renderers.

## What changed

Exposed agent thread run outputs in core, giving v1 a way to represent completed run output.

## Why this is suspicious

- Run output shape can diverge from the TUI message stream.
- Headless `json`/`stream-json` output may omit final text or duplicate deltas if output and events are both consumed.
- Subagent result rendering depends on stable output semantics.

## Feature surfaces to retest

- Headless text/json/stream-json final output.
- TUI final assistant message rendering.
- Subagent result output after tool-heavy run.

## Commit headlines

- `18cd8d1e92` feat(core): expose agent thread run outputs

## Changed files

- `.changeset/calm-showers-build.md` (+5 / -0)
- `packages/core/src/agent/__tests__/agent-thread-run-output.test.ts` (+202 / -0)
- `packages/core/src/agent/agent.ts` (+36 / -0)
- `packages/core/src/agent/thread-stream-runtime.ts` (+92 / -2)

## Review stance

Treat this PR as guilty until every feature surface above is manually or automatically re-proven. The presence of later compatibility fixes should be read as evidence that this migration stack repeatedly missed Mastra Code product invariants.
