# Issue Summary: #13540

## Title
Harness: agent.stream() calls produce orphaned spans — no tracingOptions or tracing proxy wrapping

## Labels
bug, Agents, Observability (AI Telemetry), trio-tnt, impact:high, effort:medium

## Problem Description

When using the `Harness` class with observability configured, agent spans produced by `sendMessage()` are **orphaned** — they either appear as disconnected root traces or are silently dropped. This is because:

### Root Cause 1: No `tracingOptions` passed to `agent.stream()`

In `packages/core/src/harness/harness.ts`, the `sendMessage()` method (line 1040) constructs `streamOptions` (lines 1063-1070) but **never includes `tracingOptions`** or `tracingContext`. When it calls `agent.stream(messageInput, streamOptions)` on line 1089, the agent's `#execute` method receives no tracing information, so spans cannot be linked to any parent trace.

**Relevant code** (`harness.ts:1063-1070`):
```ts
const streamOptions: Record<string, unknown> = {
  memory: { thread: this.currentThreadId, resource: this.resourceId },
  abortSignal: this.abortController.signal,
  requestContext,
  maxSteps: 1000,
  requireToolApproval: !isYolo,
  modelSettings: { temperature: 1 },
};
// ❌ No tracingOptions or tracingContext added
```

### Root Cause 2: Agents not wrapped with tracing proxy

In the `init()` method (line 136), the Harness propagates `memory` and `workspace` to mode agents (lines 170-180), but **does not wrap agents with a tracing proxy** (via `wrapAgent` from `packages/core/src/observability/context.ts`). 

When agents are accessed via the `Mastra` class, `wrapMastra` creates a Proxy that intercepts `getAgent()`/`getAgentById()` calls and wraps the returned agent with `wrapAgent()`, which injects `tracingContext` into `stream`/`generate` calls. The `Harness` bypasses this entirely — it stores and uses agents directly from `HarnessMode.agent`.

## Impact

- Agent spans created during `harness.sendMessage()` are **orphaned root traces** — not linked to any parent span/trace
- If no observability instance is configured on the agent itself, spans may be **silently dropped**
- Observability dashboards show disconnected traces, making debugging impossible

## How the Tracing Pipeline Works (for context)

1. **`wrapAgent`** (`observability/context.ts:97-130`): Creates a Proxy that intercepts `stream`/`generate` calls and injects `tracingContext` into options
2. **`getOrCreateSpan`** (`observability/utils.ts:12-48`): If `tracingContext.currentSpan` exists, creates a child span; otherwise starts a new root span using `tracingOptions` (traceId, parentSpanId)
3. **Agent `#execute`** (`agent/agent.ts:~3831-3842`): Calls `getOrCreateSpan` with both `tracingContext` and `tracingOptions` from the options object

## Suggested Fix (from issue)

**Option C (recommended)**: Both:
- **A**: Support `tracingOptions` in `sendMessage()` / `HarnessConfig` so callers can provide `traceId`/`parentSpanId`
- **B**: Wrap agents with the observability proxy (similar to how `wrapMastra` wraps agents retrieved from Mastra)

## Relevant Files

| File | Lines | Role |
|------|-------|------|
| `packages/core/src/harness/harness.ts` | 1040-1127 | `sendMessage()` — missing tracingOptions |
| `packages/core/src/harness/harness.ts` | 136-183 | `init()` — no agent wrapping |
| `packages/core/src/harness/harness.ts` | 346-352 | `getCurrentAgent()` — returns unwrapped agent |
| `packages/core/src/harness/types.ts` | 108-209 | `HarnessConfig` — no tracing fields |
| `packages/core/src/observability/context.ts` | 97-130 | `wrapAgent()` — proxy wrapping for agents |
| `packages/core/src/observability/utils.ts` | 12-48 | `getOrCreateSpan()` — span creation logic |
| `packages/core/src/agent/agent.ts` | ~3831-3842 | `#execute()` — consumes tracingOptions/tracingContext |

## Reproduction Steps

1. Create a `Harness` with an agent and observability configured
2. Call `harness.sendMessage({ content: 'hello' })`  
3. Inspect the tracing spans produced by the agent's `stream()` call
4. **Expected**: Agent spans are children of a parent trace
5. **Actual**: Agent spans are orphaned root traces (no parent linkage)

## Test Strategy

Write a test that:
1. Creates a mock agent with a spy on `stream()` that captures the options passed to it
2. Creates a `Harness` with that agent
3. Calls `sendMessage()` 
4. Asserts that `stream()` was called with `tracingOptions` or `tracingContext` in the options — **this should fail** currently because `sendMessage()` doesn't pass them
