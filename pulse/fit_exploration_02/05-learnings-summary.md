# Learnings Summary

This pass tested the expanded Pulse scope against Agent Builder/CMS config provenance, definition references, and threaded flows.

## Confirmed

### `flow` Works Better Than `trace`

`flow` fits runtime agent turns and can also describe coherent config mutation sequences.

However, not every config mutation needs a flow. A single version creation may be better as a standalone Pulse or revision event.

### Config Provenance Belongs In Scope

Agent config changes clearly explain later runtime behavior.

Good Pulse candidates:

- agent created
- version created
- version published
- instructions changed
- tool added/removed
- model changed
- memory changed
- workspace changed
- scorer/eval attached
- stored override applied

This is not generic storage observability. It is domain provenance.

### Runtime Flows Should Reference Config Versions

The storage model already has version IDs, version numbers, changed fields, and active version references.

Runtime flows should reference:

- agent id
- agent version id
- config revision id if distinct
- relevant definition hashes

They should not copy full instructions/tool/model config into every runtime flow.

### Tool Definitions Should Not Be Repeated Per Call

Current tracing includes tool description on each call, but Pulse should capture richer definitions once and reference them.

Important definition fields:

- id/name
- description
- input schema
- output schema
- approval settings
- suspend support
- provider/source
- hash/version

Runtime call Pulses should reference `definitionHash` or equivalent.

### Thread Order Needs Flow-Level Links

`threadId` groups turns but does not encode order.

Minimum useful flow fields:

```ts
threadId?: string;
previousFlowId?: string;
```

`nextFlowId` can probably be derived.

Pulse-level `prev`/`next` should stay inside a flow.

### Existing `MODEL_CHUNK` Is Close To Pulse

Current model chunk tracing is the closest existing shape to a Pulse stream.

Better Pulse framing:

- stream start
- aggregated text chunk emitted
- step output
- final output only when it carries distinct information

Avoid recreating spans or per-token persistent events.

## Changed Since Exploration 01

### `rootId` Should Move Toward `flowId`

Exploration 01 still used `rootId` in the candidate shape. This pass uses `flowId`.

Open compatibility concern: ID precision should remain OpenTelemetry-compatible even if names change.

### `surface` Needs Config Surfaces

Runtime-only surfaces are insufficient.

Added candidate surfaces:

- `agent_config`
- `tool_config`
- `workflow_config`
- `skill_config`
- `scorer_config`
- `thread`

Product names like `agent_builder` should usually be source attributes, not surfaces.

### `attributes` Looks Overloaded

This pass made the `attributes` problem sharper.

It now carries config diffs, input payloads, output payloads, errors, definitions, schemas, source, and actor context.

Possible next shape test: explicit payload fields.

## Candidate Shape After This Pass

```ts
type PulseFlow = {
  flowId: string;
  originPulseId: string;
  threadId?: string;
  previousFlowId?: string;
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
  type: PulseType;
  action: string;
  surface: string;
  primitive?: {
    type: string;
    id?: string;
    versionId?: string;
  };
  level?: PulseLevel;
  text?: string;
  data?: Record<string, number>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
  id: {
    flowId: string;
    pulseId: string;
  };
  links: PulseLinks;
};
```

## Main Risks

- Config provenance could make Pulse too broad if the boundary is not strict.
- `action: string` can become another unconstrained event name unless actions are typed by surface.
- Tool definitions may be too large for Pulse records.
- Thread branching/regeneration needs more thought than linear `previousFlowId`.
- Runtime override Pulses may double count config mutations unless clearly separated.

## Working Boundary

Pulse should capture events that materially explain:

- what happened during execution
- why the runtime was configured that way
- which definitions/config versions were used
- how one conversational turn relates to another

Pulse should still skip:

- UI clicks
- list/get navigation APIs
- generic storage adapter operations
- logger/exporter plumbing
- product preference events unless they affect runtime or learning outcomes
