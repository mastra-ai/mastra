# Shape Fit Rules

This pass tests the `fit_exploration_01` revised shape against runtime flows, configuration provenance, definition references, and threads.

## Candidate Shape

This exploration separates flow-level fields from pulse-level fields.

```ts
type PulseFlow = {
  flowId: string;
  originPulseId: string;
  threadId?: string;
  previousFlowId?: string;
  nextFlowId?: string;
  config?: {
    projectId?: string;
    agentId?: string;
    agentVersionId?: string;
    configRevisionId?: string;
  };
  metadata?: Record<string, string>;
};

type Pulse = {
  timestamp: string;
  type: 'input' | 'output' | 'decision' | 'error' | 'reasoning' | 'state' | 'progress' | 'system';
  action: string;
  surface: string;
  primitive?: {
    type: string;
    id?: string;
    versionId?: string;
  };
  level?: 'debug' | 'info' | 'warn' | 'error';
  text?: string;
  data?: Record<string, number>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
  id: {
    flowId: string;
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

Experimental fields in this pass:

- `PulseFlow`
- `flowId`
- `originPulseId`
- `previousFlowId`
- `nextFlowId`
- `action`
- `surface`
- `primitive.versionId`
- `flow.config`

## Field Rules

### `PulseFlow`

Use a flow for one coherent runtime execution or one coherent config mutation.

Runtime flow examples:

- one agent turn
- one workflow run
- one durable resumed execution
- one background continuation if it can outlive the original call

Config flow examples:

- one agent creation
- one stored agent update that creates a new version
- one publish action that promotes an active version

Open issue: config mutations may not need full flows. They could be standalone Pulses with IDs and config revision references. This pass tests both but leans toward lightweight config flows when a mutation creates multiple related Pulses.

### `type`

`type` stays semantic and coarse.

Use:

- `input`: work or mutation accepted
- `decision`: branch/policy/selection/resolution
- `state`: durable or meaningful state/config changed
- `progress`: bounded streaming, polling, background continuation, chunk emission
- `output`: result produced
- `error`: failure or rejection
- `reasoning`: model/provider reasoning output
- `system`: runtime housekeeping that still explains a user primitive

Do not use product/surface names as `type`.

### `action`

`action` is the machine-readable event action.

Preferred shape:

```txt
<verb>_<phase-or-object>
```

Examples:

- `run_started`
- `stream_started`
- `text_chunk_emitted`
- `execute_started`
- `execute_completed`
- `tool_added`
- `instructions_changed`
- `definition_registered`
- `version_created`
- `flow_linked`

Avoid:

- generic display names
- product UI action names
- raw click names
- full dotted names saved only for humans

Concern: `action` still fragments if unconstrained. The real design probably needs action unions by `surface`.

### `surface`

`surface` is where the observation happened.

Candidate values for this pass:

- `agent`
- `agent_config`
- `workflow`
- `workflow_config`
- `tool`
- `tool_config`
- `model`
- `processor`
- `scorer`
- `memory`
- `channel`
- `thread`
- `builder`
- `harness`
- `sandbox`

`agent_builder` and `agent_cms` are weaker as surfaces because they name product entry points rather than the mutated domain. Prefer `agent_config` when the durable agent config changed.

### `primitive`

`primitive` describes the user-facing thing that owns the action.

Examples:

```ts
primitive: { type: 'agent', id: 'support-agent', versionId: 'agent_version_123' }
primitive: { type: 'tool', id: 'searchDocs' }
primitive: { type: 'workflow', id: 'lead-routing' }
```

Do not duplicate the full primitive config in every child Pulse. Use version/hash references.

### `data`

`data` remains numeric and graphable.

Good:

- `inputTokens`
- `outputTokens`
- `totalTokens`
- `chunkCount`
- `toolCount`
- `versionNumber`
- `changedFieldCount`
- `retryCount`
- `score`

Bad:

- duration
- booleans
- ids
- strings
- statuses
- schemas
- raw input/output objects

### `attributes`

This pass keeps `attributes` but treats it as action payload.

Examples:

```ts
attributes: {
  changedFields: ['instructions', 'tools'],
  tool: { id: 'searchDocs', definitionHash: 'sha256:...' },
  input: { query: 'memory processors' }
}
```

Concern: `attributes` is carrying too much: payload, definition, context, input, output, error, and config diffs. This exploration should keep pressure on whether explicit fields are needed.

### `metadata`

Use string-only external correlation fields.

Good:

- organization id
- tenant id
- deployment id
- external request id
- external trace id

Internal Mastra IDs such as agent version IDs may fit better in `flow.config` or `primitive.versionId` than `metadata`.

### Relationships

Inside one flow:

- Pulse `parent` / `children` captures causality or containment.
- Pulse `prev` / `next` captures sibling sequence.

Across flows:

- `threadId` groups conversational turns.
- `previousFlowId` and `nextFlowId` preserve turn order.

Do not use Pulse sibling links across flows.

## Fit Tests

An event is a good Pulse candidate if:

1. It records a meaningful runtime observation or config provenance event.
2. It can be represented as a point in time.
3. It helps explain execution behavior, learning outcomes, or user-visible state.
4. It does not duplicate full data already available through a parent, version, or definition reference.

An event should be skipped if:

1. It is UI-only interaction noise.
2. It is generic storage CRUD with no domain meaning.
3. It only powers admin navigation.
4. It is logger/exporter plumbing.
5. It is a repeated definition that can be referenced by hash/version.

## Where This Shape May Be Wrong

The strongest concern is that config provenance and runtime execution may be different enough to need separate top-level objects. A config mutation Pulse can be useful, but it may not naturally belong in the same flow graph model as an agent turn. If we force both into identical flow semantics, `flow` may become vague. A possible correction is: runtime executions create flows, while config mutations create standalone Pulses or revision records that runtime flows reference.
