# Candidate Model

This file captures the best candidate model after the first two source passes.

## Position

Definitions should not be a top-level observability event family parallel to Pulse.

The useful split:

- `Pulse`: observes lifecycle, selection, use, failure, and applicability changes.
- `DefinitionRef`: points at a stable or scoped body/contract.
- `Relationship`: links runtime Pulses to the definitions they used.

Some definitions can be introduced by a Pulse, but the body itself is not always a Pulse.

## Shape

```ts
type DefinitionKind =
  | 'agent_config'
  | 'instructions'
  | 'tool_definition'
  | 'schema'
  | 'model_settings'
  | 'request_context_schema'
  | 'processor_config'
  | 'scorer_config'
  | 'memory_config'
  | 'workflow_config'
  | 'dataset_schema';

type DefinitionRef = {
  kind: DefinitionKind;
  id: string;
  version?: string | number;
  hash?: string;
};

type DefinitionScope =
  | { type: 'step'; stepId: string }
  | { type: 'tool_call'; toolCallId: string }
  | { type: 'model_call'; pulseId: string }
  | { type: 'run'; runId: string }
  | { type: 'thread'; threadId: string }
  | { type: 'version'; versionId: string };
```

## Lifecycle Pulses

Definitions become observable when something happens to them.

Examples:

- `agent_config.version_created`
- `agent_config.active_version_changed`
- `tool_config.tool_set_changed`
- `model.settings_selected`
- `processor.structured_output_schema_defined`
- `scorer_config.version_created`

These should be Pulses, usually ChangePulses.

## Runtime Use

Runtime Pulses should link to definitions with relationships.

Examples:

```ts
{
  exportType: 'relationship',
  relationship: 'uses_tool_definition',
  from: { kind: 'pulse', id: 'pulse_tool_called' },
  to: { kind: 'definition', id: 'tool_searchDocs_v2' }
}
```

```ts
{
  exportType: 'relationship',
  relationship: 'uses_config_version',
  from: { kind: 'pulse', id: 'pulse_agent_run_started' },
  to: { kind: 'definition', id: 'agent_config_support_v4' }
}
```

## Scope

Scope describes how long the definition applies.

Permanent examples:

- an agent config version selected for future runs
- a tool set changed for the remainder of a run
- a scorer definition version selected for an experiment

Temporary examples:

- active tools narrowed for one step
- model settings selected for one call
- generated structured output schema for one internal structuring call

Open issue:

- scope may belong on the ChangePulse that changes applicability, on the relationship that uses the definition, or on both.

## Schema Rule

Schemas should not always be standalone definitions.

Split a schema out only when:

- it is referenced independently
- it is transformed independently
- it is versioned independently
- it explains a runtime validation or compatibility decision

Otherwise, keep it nested in the owning definition.

## Main Tradeoff

This model weakens the pure phrase "everything observable is a Pulse" only if definition artifacts are treated as observability events.

To avoid that:

- definition artifacts are referenced bodies/contracts
- Pulses observe changes to, selections of, and uses of those bodies/contracts
- storage/query indexes for definitions are implementation details

