# @mastra/restate

`@mastra/restate` connects Mastra agents to [Restate](https://restate.dev) for durable execution. Agent runs are journaled by Restate, so completed steps replay from the journal instead of re-executing — LLM calls are not repeated and tool side effects are not duplicated after a crash or restart. Tool approvals suspend durably via Restate awakeables and resume when the awakeable resolves, even across process restarts.

Use `createRestateAgent()` when an agent run must survive process restarts and transient failures.

## Installation

```bash
pnpm add @mastra/restate
```

## Quickstart

```typescript
import { Agent } from '@mastra/core/agent';
import { createRestateAgent, connect, serve } from '@mastra/restate';
import * as restate from '@restatedev/restate-sdk';
import { Mastra } from '@mastra/core/mastra';

const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You are a helpful assistant',
  model: openai('gpt-4'),
});

// 1. Create the durable agent
const durableAgent = createRestateAgent({
  agent,
  restate: { url: 'http://localhost:8080' }, // or a connected Ingress client
});

// 2. Register with Mastra
const mastra = new Mastra({
  agents: { myAgent: durableAgent },
});

// 3. Use the agent
const { output, cleanup } = await durableAgent.stream('Hello!');
const text = await output.text;
cleanup();
```

## Serving Restate services

The durable agent executes inside a Restate service handler that closes over the Mastra `Agent` instance. You must serve that service from the same process:

```typescript
import { createRestateAgentService } from '@mastra/restate';

const { service } = createRestateAgentService({ agent: durableAgent.agent });

serve({ services: [service] });
```

Or serve manually:

```typescript
restate.serve({ services: [service] });
```

Start a Restate server locally:

```bash
docker run --name restate_dev --rm -p 8080:8080 -p 9070:9070 docker.io/restatedev/restate
```

## API

### `createRestateAgent(options)`

| Option | Description |
| --- | --- |
| `agent` | The Mastra `Agent` to wrap with durable execution. |
| `restate` | A connected Restate `Ingress` client (from `connect(url)`) or a `{ url }` descriptor. |
| `id` | Optional ID override (defaults to `agent.id`). |
| `name` | Optional name override (defaults to `agent.name`). |
| `serviceName` | Optional Restate service name (defaults to `MastraAgent_<agentId>`). |
| `mastra` | Optional Mastra instance for observability. |
| `maxRetryAttempts` | Max retry attempts for journaled agent-run steps (default 3). |

### `RestateAgent`

The returned agent mirrors the `Agent` interface and adds durable capabilities:

- `stream(messages, options?)` — durable streaming. Returns `{ output, fullStream, runId, cleanup, abort }`.
- `resume(runId, resumeData, options?)` — resume a suspended run.
- `generate(messages, options?)` — drain a run to a `FullOutput`.
- `resumeGenerate(runId, resumeData, options?)` — resume and drain.
- `prepare(messages, options?)` — generate run/message IDs without starting a run.
- `observe(runId, options?)` — reconnect to a running run's recorded events.
- `approveToolCall({ runId, toolCallId? })` — approve a pending tool call on a suspended run.
- `declineToolCall({ runId, toolCallId?, reason? })` — decline a pending tool call.
- `recover()` / `listActiveRuns()` / `recoverActiveRuns()` — not supported; Restate owns durability. Use `observe(runId)` to reconnect to a running run.

All other `Agent` methods (`getModel`, `listTools`, etc.) are forwarded to the underlying agent.

## Durability model

- **Journaled invocations**: each agent invocation runs inside a Restate `ctx.run` step. When the step completes, its result is journaled; on replay the recorded result is returned instead of re-executing, so LLM calls and tool side effects are not repeated.
- **Durable approvals**: when `requireToolApproval` is enabled and a tool call needs approval, the handler creates a Restate awakeable and parks without holding compute. The run resumes when the awakeable is resolved via `approveToolCall()` / `declineToolCall()` — even if the process restarted in between.
- **Resumable observation**: stream events are recorded per run and exposed via `observe(runId)`, so clients can reconnect after a disconnection.

## Reference

- [Restate AI Agents docs](https://docs.restate.dev/ai/patterns/durable-agents)
- [Restate TypeScript SDK](https://docs.restate.dev/develop/ts/services)
