# Pulse Shape Fit Rules

This file defines the current fit rules used while exploring audited event candidates.

## Candidate Pulse Shape

```ts
type Pulse = {
  timestamp: string;
  type: 'input' | 'output' | 'decision' | 'error' | 'reasoning' | 'state' | 'progress' | 'system';
  level?: 'debug' | 'info' | 'warn' | 'error';
  text?: string;
  data?: Record<string, number>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
  id: {
    rootId: string;
    seedId?: string;
    pulseId: string;
  };
  links: {
    parent?: string;
    children?: string[];
    prev?: string;
    next?: string;
  };
};
```

Exploration caveat: examples use `attributes.event` as a placeholder for the specific event name. That is not yet a settled design.

## Field Rules

### `type`

Use the semantic role of the observation.

| Use | When |
| --- | --- |
| `input` | Work is accepted, input is validated, a remote/event/channel message enters a primitive. |
| `output` | A primitive produces a result, model output, tool result, score, final response, posted channel message. |
| `decision` | Runtime chooses a path: model, tool availability, retry, fallback, transport, state-signal mode, approval decision. |
| `error` | Work failed, validation failed, provider failed, policy denied, remote protocol returned invalid data. |
| `state` | Durable or model-visible state changed: task list, working memory, thread state, suspension state, workflow snapshot. |
| `progress` | Streaming, polling, background continuation, chunk forwarding, partial output, retry scheduled. |
| `reasoning` | Model/provider reasoning output or explicit reasoning events. |
| `system` | Runtime housekeeping that is still primitive-owned. Use sparingly. |

Do not use runtime surfaces as `type`:

- not `agent`
- not `workflow`
- not `tool`
- not `model`
- not `processor`
- not `scorer`
- not `chunk`
- not `span`
- not `trace`

### `text`

Human-readable sentence. It should explain the observation without forcing the reader to decode attributes.

Examples:

- `Tool searchDocs accepted input.`
- `Model router selected websocket transport.`
- `Task list snapshot emitted.`
- `Remote A2A task requires input.`

### `data`

Only numeric quantities that are valid at this point in time.

Good:

- `inputTokens`
- `outputTokens`
- `retryAttempt`
- `chunkCount`
- `score`
- `taskCount`
- `completedCount`
- `pendingCount`
- `outputBytes`

Bad:

- duration
- ids
- booleans
- status strings
- provider names
- nested usage objects

Duration is derived from timestamps between related Pulses.

### `attributes`

Runtime facts and structured context. Complex values are allowed, but child Pulses should not repeat parent data unnecessarily.

Suggested conventions for exploration:

```ts
attributes: {
  event: 'tool.execute.started',
  surface: 'tool',
  primitive: {
    type: 'agent',
    id: 'research-agent',
  },
  tool: {
    name: 'searchDocs',
    callId: 'call_123',
  },
}
```

Open issue: `event` may deserve a first-class field or a constrained vocabulary. Keeping it in `attributes` is flexible but easy to fragment.

### `metadata`

Simple string-to-string external correlation fields only.

Good:

- tenant id
- organization id
- deployment id
- request id
- external trace id
- environment

Avoid:

- complex runtime details
- model params
- tool args
- output payloads

### `links`

Use relationships to avoid duplicating parent context.

Heuristic:

- root Pulse: primitive run accepted input
- children: contained work, e.g. model call, tool call, processor call
- `prev`/`next`: temporal siblings, e.g. model decision then model output; streamed chunks in order
- nested roots: use `seedId` only if a delegated primitive gets its own root

## Fit Tests

An event is a good initial Pulse candidate if all are true:

1. It is part of a user primitive execution or primitive-owned state.
2. It changes what the user/model/runtime can observe about that execution.
3. It can be recorded as a point in time.
5. It does not duplicate information already on a parent Pulse.

An event should be skipped if any are true:

1. It is only an admin/config/catalog operation.
2. It only helps query or navigate observability data.
3. It is storage adapter plumbing with no primitive-level consequence.
4. It is org/license/product telemetry.
5. It is generic logger fanout or server plumbing.

