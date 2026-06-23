# Thread Flow Fit

This note tests explicit flow-to-flow relationships for conversational agents.

## Source Shape

Current runtime and memory paths use:

- `threadId`: conversation thread identifier
- `resourceId`: broader user/resource context
- `runId`: execution/run identifier

These are present across memory, agent, network, durable, and channel paths.

Current issue: `threadId` groups runs, but it does not encode order between runtime flows.

## Fit Pattern

Each user turn creates one runtime flow:

```ts
{
  flowId: 'flow_turn_002',
  originPulseId: 'pulse_origin_002',
  threadId: 'thread_support_123',
  previousFlowId: 'flow_turn_001'
}
```

The origin Pulse for the second turn:

```ts
{
  timestamp: '2026-06-23T10:00:00.000Z',
  type: 'input',
  surface: 'agent',
  action: 'run_started',
  primitive: {
    type: 'agent',
    id: 'support-agent',
    versionId: 'agent_version_4'
  },
  attributes: {
    input: {
      messageId: 'msg_002'
    }
  },
  id: {
    flowId: 'flow_turn_002',
    pulseId: 'pulse_origin_002'
  },
  links: {}
}
```

Optional relationship Pulse:

```ts
{
  type: 'state',
  surface: 'thread',
  action: 'flow_linked',
  primitive: {
    type: 'agent',
    id: 'support-agent'
  },
  attributes: {
    threadId: 'thread_support_123',
    previousFlowId: 'flow_turn_001',
    currentFlowId: 'flow_turn_002'
  }
}
```

## Should There Be A Relationship Pulse?

Maybe not.

If flow metadata has `previousFlowId`, a separate `thread.flow_linked` Pulse duplicates the same fact.

A relationship Pulse is useful only if:

- thread sequencing itself is an observable state mutation
- multiple systems need to consume it from the Pulse stream
- retries/regenerations/branches need explicit audit records

Current leaning: store `previousFlowId` on the flow. Do not emit a Pulse just to say the flow was linked unless the thread state mutation is itself important.

## Regeneration And Branching

Simple previous/next links are enough for linear chat turns, but not enough for:

- user edits an earlier message
- assistant response is regenerated
- one thread branches into variants
- background continuation appends later output

Possible fields:

```ts
type PulseFlow = {
  flowId: string;
  threadId?: string;
  previousFlowId?: string;
  branchFromFlowId?: string;
  regenerationOfFlowId?: string;
}
```

Concern: adding all of these too early may overfit UI behavior. The minimum useful field is `previousFlowId`.

## Current Leaning

Use:

- `threadId`
- `previousFlowId`

Derive:

- `nextFlowId`

Defer:

- branch/regeneration fields until the UI/runtime semantics are clearer

Do not use Pulse-level `prev`/`next` across flows.
