# AIMock loop scenarios

BDD/scenario-style regression tests for the **core agentic loop** (`packages/core/src/loop`),
built on [`@copilotkit/aimock`](https://www.npmjs.com/package/@copilotkit/aimock) — the same
AIMock tooling the mastracode e2e suite uses.

## Why this exists

The agentic loop is exercised heavily at the unit level (per-step tests under
`loop/workflows/agentic-execution/`). Those pass even when the **composition** of steps
regresses: tool-result plumbing, cross-turn message ordering, and stop conditions in long
loops. Historically these regressions were only caught when testing Mastra Code, even though
they affect every consumer of `loop()`.

These scenarios script multi-step model turns and assert on **both**:

1. the loop's emitted output (`output.text`, `output.toolResults`, …), and
2. the per-turn HTTP requests the loop sent the model (`requests[n].body.messages`), which is
   where cross-turn composition bugs surface.

## How it works

Each scenario runs a real OpenAI v5 provider pointed at an in-test AIMock HTTP server via
`baseURL` (mirroring how mastracode routes the provider through `OPENAI_BASE_URL`). The prompt
runs through `Agent` → `loop()`, the stream is fully consumed, and the captured AIMock request
journal is returned for assertions.

```ts
import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe('AIMock loop scenario: my regression', () => {
  // One AIMock server is shared per suite; fixtures + requests reset between tests.
  const getMock = useLoopScenarioAimock();

  it('does the thing', async () => {
    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Do the thing.',
      tools: { my_tool: createTool({ /* ... */ }) },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        // Script per-turn responses. Match on whether a tool result is present
        // (and which tool call it answers) to drive a multi-step loop.
        llm.on({ endpoint: 'chat', hasToolResult: false }, {
          toolCalls: [{ id: 'call_1', name: 'my_tool', arguments: { /* ... */ } }],
        });
        llm.on({ endpoint: 'chat', toolCallId: 'call_1', hasToolResult: true }, {
          content: 'Final answer.',
        });
      },
    });

    expect(requests).toHaveLength(2);
    // Assert cross-turn composition on requests[1].body.messages ...
  });
});
```

### Scripting model turns

Use the `LLMock` instance inside `fixtures`:

- `llm.on(match, response)` — match on `{ endpoint, userMessage, toolCallId, hasToolResult, ... }`.
- `llm.onToolCall(name, response)` / `llm.onTurn(turn, pattern, response)` — convenience helpers.
- Tool-call responses: `{ toolCalls: [{ id, name, arguments }] }`. Text responses: `{ content }`.

Tool ids passed to the agent must match the scripted tool-call `name`. Use
[placeholder model tokens](../../../../../../docs/src/plugins/remark-model-tokens/models.ts)
for any model ids in fixtures/comments.

### Extra `runLoopScenario` options

`runLoopScenario` forwards a few loop options so scenarios can cover more of the surface:

- `structuredOutput: { schema }` — final object is available on `output.object`. For OpenAI
  without a separate `structuredOutput.model`, the loop applies a `json_schema` response format
  **inline on the main model**, so script the final turn to return the JSON object as `content`.
- `isTaskComplete: { scorers: [...] }` — supervisor-style completion gating. Each scorer returns
  `{ score: 0 | 1, reason }`; a score of `0` forces the loop to re-invoke the model, `1` lets it
  halt. Each evaluation emits an `is-task-complete` chunk and injects a "#### Completion Check
  Results" feedback message that the next turn must see in its request.
- `collectChunks: true` — iterates `output.fullStream` itself (instead of the default
  `consumeStream` drain) and returns every emitted chunk in the result's `chunks` array. Use for
  delta-level / streaming-fidelity assertions (text-delta ordering, reasoning chunks, etc.).
- `activeTools: ['tool_a']` — restricts which tools are exposed in the request; assert on
  `requests[n].body.tools`.
- `outputProcessors: [processor]` — runs output processors over the loop output; assert on the
  transformed `output.text`.
- `inputProcessors: [processor]` — runs input processors before the model request; assert on
  `requests[0]` to confirm the user message was transformed before the model saw it.
- `prepareStep: ({ stepNumber }) => ({ activeTools, ... })` — per-step overrides; assert each
  request's tool list reflects the step's override.
- `memory` + `threadId` / `resourceId` — attach a memory instance and run on a thread to exercise
  conversation-history recall and working memory across turns. Call `runLoopScenario` twice with
  the same `memory`/`threadId` (clearing requests between) to assert turn-2 recalls turn-1.
- `workspace` — attach a `Workspace` to the agent; it is threaded into tool execution context so a
  tool can read `ctx.workspace.filesystem` / `ctx.workspace.sandbox` mid-loop.
- `agents: { writer }` — register subagents (supervisor / agents-as-tools). Each becomes a tool
  named `agent-<key>`. Build the subagent with the same AIMock-backed provider (`createOpenAI({
  baseURL })`) so its own loop turns also hit the mock; match the delegated prompt to script them.
- `toolsets: { namespace: { toolName: createTool(...) } }` — request-level tools merged with agent-level
  tools. Toolset tools with the same name as agent tools take precedence. Assert on
  `requests[0].body.tools` to confirm both sets are present; assert on tool execution to verify precedence.
- `instructions: ({ requestContext }) => string` + `requestContext` — resolve instructions
  dynamically from request context; assert the resolved system prompt lands in `requests[n]`.
- `goal: { judge, maxRuns, scorer }` — durable objective with judge model; set `objective: 'text'`
  to call `setObjective()` before streaming. Assert `goal` chunks on `chunks` (with `collectChunks: true`);
  `passed: true` / `passed: false`, `status: 'done'` / `'paused'`, `maxRunsReached`.
- `backgroundTasks: { enabled: true }` + `agentBackgroundTasks` — enables background task dispatch.
  Tool-level `background: { enabled: true }` on a tool emits `background-task-*` chunks; combine with
  `streamUntilIdle: true` and `manualStreamConsumption: true` to publish lifecycle events and assert
  re-invocation.
- `objective: 'text'` — convenience option that calls `agent.setObjective(text, { threadId, resourceId })`
  before streaming; requires `goal` config and memory-backed thread.
- `abortSignal: controller.signal` — halt the loop mid-stream; the loop stops cleanly and
  `finishReason` resolves to a termination reason. Pre-aborted signals prevent the loop from starting.
- `providerOptions: { openai: { ... } }` — provider-specific options forwarded through `agent.stream()`.
- `modelSettings: { temperature, maxTokens, ... }` — model settings forwarded to the request body.

### Error-state scenarios

The loop surfaces failures through specific chunks; script and assert them directly:

- **Provider / API error** — return an `ErrorResponse` from a fixture (`llm.onMessage(/.*/, {
  error: { message }, status: 500 })`). The loop emits an `error` chunk on `fullStream`. Read the
  `fullStream` to assert the error chunk; `consumeStream` swallows the failure rather than throwing.
- **Guardrail tripwire** — an input processor that calls `abort(reason)` short-circuits the loop: a
  `tripwire` chunk is emitted and **no model request is sent** (`requests` is empty). Assert on the
  tripwire chunk and `requests.length === 0`.
- **Tool execution error** — see `tool-execution-errors.scenario.test.ts`; a thrown tool is fed
  back as a tool result so the model can recover on the next turn.

### Approval / suspend-resume scenarios

Use `runApprovalScenario` for tool-approval flows. It streams with `requireToolApproval: true`
(by default), collects the emitted `tool-call-approval` chunks, and resolves each via
`approveToolCall` / `declineToolCall` according to `decision` (a callback returning `true` to
approve, `false` to decline). The agent is registered on a `Mastra` instance with an
`InMemoryStore` so snapshots round-trip through resume.

- `requireToolApproval: false` — disable stream-level gating to test tool-level `requireApproval: true`
  on specific tools. Only the flagged tool suspends.
- `requireToolApproval: ({ toolName }) => boolean` — conditional function-based gating; only tools
  matching the pattern suspend. Useful for pattern-based approval (e.g. `/^delete_/`).

### Tool lifecycle hooks and streaming

Tools support lifecycle hooks and streaming output:

- **Lifecycle hooks** — `onInputAvailable` fires after input is available but before `execute`; `onOutput`
  fires after `execute` completes. Both receive the tool context. Hook errors don't crash the loop.
- **Tool streaming** — tools can emit chunks via `context.writer.write()` (emits `tool-output` chunks) or
  `context.writer.custom()` (emits custom-typed chunks). Use `collectChunks: true` to assert on emitted chunks.

## Scenario catalog

| File | Regression class |
| --- | --- |
| `multi-step-tool-loop.scenario.test.ts` | tool-result plumbed into the next request in the right position |
| `cross-turn-message-ordering.scenario.test.ts` | multiple tool results round-trip with correct ids |
| `stop-condition-long-loop.scenario.test.ts` | `stepCountIs`, model-stops-early, and custom `stopWhen` predicate bounds |
| `structured-output.scenario.test.ts` | structured object after a tool turn; tool result plumbed into the structured turn |
| `tool-execution-errors.scenario.test.ts` | thrown tool error + unknown/hallucinated tool reported back and recovered |
| `tool-approval.scenario.test.ts` / `tool-approval-rejection.scenario.test.ts` | approval gate emit + resume on approve/decline |
| `mastra-distinctive.scenario.test.ts` | `activeTools` filtering + output-processor redaction |
| `memory-history.scenario.test.ts` | prior thread messages recalled into the next request |
| `working-memory.scenario.test.ts` | working memory persisted in turn 1 and re-injected on a later turn |
| `input-processor.scenario.test.ts` | input processor redacts the user message before the request |
| `prepare-step.scenario.test.ts` | per-step `prepareStep` activeTools override lands in each request |
| `workspace.scenario.test.ts` | workspace threaded into tool execution; tool reads a file mid-loop |
| `agents-as-tools.scenario.test.ts` | supervisor delegates to a subagent (`agent-<key>`); result plumbed back |
| `dynamic-instructions.scenario.test.ts` | instructions resolved from request context land in the system prompt |
| `provider-error.scenario.test.ts` | provider 500 surfaces an `error` chunk + `finishReason: 'error'` |
| `guardrail-tripwire.scenario.test.ts` | input-processor `abort()` emits a tripwire and sends no request |
| `is-task-complete-gating.scenario.test.ts` | failing scorer re-invokes the model with completion feedback; passing scorer halts |
| `is-task-complete-early.scenario.test.ts` | immediate-pass scorer halts after exactly one model request (no re-invocation) |
| `text-streaming.scenario.test.ts` | multi-delta text reassembles in order and matches `output.text` exactly |
| `background-task-tool-level.scenario.test.ts` | tool-level `background: { enabled: true }` emits lifecycle chunks |
| `background-task-agent-level.scenario.test.ts` | agent-level `agentBackgroundTasks` config overrides tool-level |
| `background-task-stream-until-idle.scenario.test.ts` | `streamUntilIdle` re-invokes the model after a background task completes |
| `goal-satisfied.scenario.test.ts` | judge marks objective satisfied; `goal` chunk with `passed: true`; objective marked done |
| `goal-budget-exhausted.scenario.test.ts` | `maxRuns` reached; `goal` chunk with `maxRunsReached: true`; objective stays paused |
| `approval-tool-level.scenario.test.ts` | tool-level `requireApproval: true` suspends only that tool |
| `approval-conditional.scenario.test.ts` | pattern-based `requireToolApproval` function gates matching tools only |
| `delegation-modify-prompt.scenario.test.ts` | supervisor `onDelegationStart` modifies/rejects subagent prompt; rejection prevents subagent invocation |
| `delegation-message-filter.scenario.test.ts` | `messageFilter` strips sensitive messages before sharing with subagent; filter receives correct delegation context |
| `iteration-complete.scenario.test.ts` | `onIterationComplete` receives iteration context with tool calls; early stop via `continue: false`; feedback injection verification |
| `multi-tool-parallel.scenario.test.ts` | multiple tool calls in one turn execute concurrently; all results collected with correct `tool_call_id` mapping; mixed success/failure handling |
| `text-streaming.scenario.test.ts` | multi-delta text reassembles in order and matches `output.text`; `text-start`/`text-end` bracket deltas; `step-start`/`step-finish` and `start`/`finish` lifecycle ordering |
| `abort-signal.scenario.test.ts` | `abortSignal` halts the loop mid-stream; pre-aborted signal prevents the loop from starting |
| `runtime-context.scenario.test.ts` | `requestContext` passthrough to tool `execute` function; same context shared across multiple tools in one run |
| `output-step-processor.scenario.test.ts` | `processOutputStep` runs for each step including intermediate tool-call steps; sees `toolCalls` and `stepNumber` |
| `input-step-processor.scenario.test.ts` | `processInputStep` runs for each step; sees accumulated messages (user + assistant); message count grows across steps |
| `provider-metadata.scenario.test.ts` | `providerOptions` passthrough to `agent.stream()` without errors; provider-specific metadata flows through the stream pipeline |
| `request-body-override.scenario.test.ts` | `modelSettings` forwarded to the model request body; `temperature` and other settings land in the request |
| `toolsets-override.scenario.test.ts` | request-level `toolsets` merge with agent-level tools; toolset tool with same name takes precedence |
| `tool-lifecycle-hooks.scenario.test.ts` | `onInputAvailable` fires before `execute`; `onOutput` fires after; hook errors don't crash the loop |
| `tool-streaming.scenario.test.ts` | `context.writer.write()` emits `tool-output` chunks; `context.writer.custom()` emits custom-typed chunks |
| `observability-context.scenario.test.ts` | tool context includes `tracingContext`; safe access to observability fields without crashing |

## Supervisor delegation hooks

The agent supports supervisor-style delegation with `onDelegationStart`, `onDelegationComplete`,
and `messageFilter` hooks. Pass these via the `delegation` option when constructing the agent.

- `onDelegationStart` — intercept subagent delegation before it runs. Return `{ proceed: true, modifiedPrompt }` to
  modify the prompt, or `{ proceed: false, rejectionReason }` to reject the delegation entirely.
- `onDelegationComplete` — post-execution callback with result, duration, success/error, and `bail()` to skip further iterations.
- `messageFilter` — controls which parent messages are shared with the subagent as context. Runs after `onDelegationStart`.

## Iteration hooks (onIterationComplete)

The `onIterationComplete` hook fires after each iteration of the agent loop, providing visibility into
what happened (iteration number, text, tool calls, tool results) and control over whether to continue.

- `onIterationComplete: async (context) => { ... }` — receives `IterationCompleteContext` with `iteration`, `text`,
  `toolCalls`, `toolResults`, `isFinal`, `finishReason`, `runId`, `messages`.
- Return `{ continue: false }` to stop the loop early.
- Return `{ feedback: '...' }` to inject an assistant message for the next iteration.

## Parallel tool execution

The loop supports multiple tool calls in a single turn, executing them concurrently and collecting
all results before the next model request.

- Tools execute in parallel (not sequentially) — assert via execution timestamps.
- All tool results are collected with correct `tool_call_id` mapping — each result references
  its originating tool call id in the next request's `messages` array.
- Mixed success and failure are handled — failed tools still produce a result entry.

## Abort signal

Pass `abortSignal: controller.signal` to halt the loop mid-stream. The loop stops cleanly
and `finishReason` resolves to `'tripwire'` or a similar termination reason.

- A pre-aborted signal prevents the loop from starting.
- An abort mid-stream prevents additional model requests.

## Runtime context (requestContext)

`requestContext` is forwarded through `agent.stream({ requestContext })` and made available
in tool `execute` functions via `context.requestContext`. This allows tools to access
per-request state like user IDs, session info, or feature flags.

- Use `new RequestContext()` and `.set(key, value)` to populate.
- All tools in the same run receive the same requestContext instance.

## Model settings & provider options

- `modelSettings: { temperature, maxTokens, topP, ... }` — forwarded to the model request body.
  At minimum `temperature` reliably lands in the request.
- `providerOptions: { openai: { ... }, anthropic: { ... } }` — provider-specific options forwarded
  through `agent.stream()`. Whether they land in the request body depends on the provider SDK.

## Proving a scenario catches regressions

The assertions are pinned to real loop behavior. To prove it:

- Corrupt the tool-result mapping in `tool-call-step.ts` (e.g. drop a tool-result from the
  message list) and the **multi-step-tool-loop**, **cross-turn-message-ordering**, and
  **structured-output** scenarios go red while unrelated ones stay green.
- Corrupt the completion-feedback header in `loop/network/validation.ts` (`formatStreamCompletionFeedback`
  pushes `#### Completion Check Results`) and the **is-task-complete-gating** scenario goes red.
- Corrupt the error-chunk emission path and the **provider-error** scenario goes red.
- Corrupt the goal scoring result in `goal-step.ts` (e.g. force `passed: false`) and the
  **goal-satisfied** scenario goes red.
- Corrupt tool-level approval resolution in `tool-call-step.ts` (e.g. drop `requireApproval`
  from the tool definition) and the **approval-tool-level** scenario goes red.
- Corrupt the `onDelegationStart` rejection check in `agent.ts` (e.g. force `if (true)` instead of `if (startResult.proceed === false)`)
  and the **delegation-modify-prompt** scenario goes red (subagent never invoked).
- Corrupt tool result `toolCallId` in `tool-call-step.ts` (e.g. replace `toolCallId: inputData.toolCallId` with `toolCallId: 'CORRUPTED_ID'`)
  and the **multi-tool-parallel** scenario goes red (tool call IDs no longer match expected values).

Revert any injection to restore the full suite to green.

## Running

```bash
# Build core first so internal workspace artifacts resolve for focused runs.
pnpm build:core
pnpm --filter ./packages/core exec vitest run src/loop/test-utils/aimock --reporter=dot
```

## Scope & limitation

These tests exercise the **OpenAI wire path only**. They add provider-compat coverage but do
not catch provider-agnostic loop bugs on other wire formats (e.g. Anthropic). Multi-provider
parity is intentionally out of scope here; mastracode's AIMock e2e remains the thin top-of-pyramid
UI check.
