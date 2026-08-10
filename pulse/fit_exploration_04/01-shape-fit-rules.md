# Shape Fit Rules

This pass tests definition representation under the working premise that observable records should be Pulses.

## Current Working Direction: Hybrid Definitions

Second-pass source review suggests the useful model is not purely A, B, or C below.

Working shape:

```ts
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

Rules:

- durable/reusable bodies are referenced definition artifacts
- creation/update/publish/activation/selection/failure are Pulses
- temporary generated definitions are usually inline or referenced bodies on ChangePulses
- `DefinitionPulse` remains a provisional escape hatch, not a required family member
- runtime usage is expressed through relationships such as `uses_tool_definition`, `uses_instruction_version`, `uses_config_version`, or `uses_definition`
- scope of effect must be explicit for temporary and run-scoped definitions

This direction treats a definition body as a thing that can be observed, referenced, and changed, but not necessarily as an observation itself.

## Candidate Directions Tested

### Direction A: Definition As Referenced Artifact

```ts
type Definition = {
  id: string;
  kind: DefinitionKind;
  version?: string | number;
  hash?: string;
  scope: 'temporary' | 'permanent';
  body: unknown;
  metadata?: Record<string, string>;
};
```

Rules to test:

- Definitions are not Pulses.
- Pulses observe definition creation, update, selection, and use.
- Runtime Pulses reference definitions by id/hash/version.
- Durable definitions can outlive a flow.
- Temporary definitions may be scoped to one step, call, decision, or other bounded runtime window.

Pressure:

- This is semantically clear, but may violate the "everything observable is a Pulse" premise if definitions are treated as exported observability records.

### Direction B: Definition As Special Pulse Type

```ts
type DefinitionPulse = {
  exportType: 'pulse';
  pulseKind: 'definition';
  id: string;
  timestamp: string;
  surface: DefinitionSurface;
  action: 'defined' | 'updated' | 'selected' | 'retired';
  scope: 'temporary' | 'permanent';
  subject: ExportRef;
  definition: {
    kind: DefinitionKind;
    version?: string | number;
    hash?: string;
    bodyRef?: ExportRef;
    body?: unknown;
  };
  metadata?: Record<string, string>;
};
```

Rules tested:

- A definition is a Pulse when the definition is introduced, changed, selected, or retired.
- Runtime Pulses reference the DefinitionPulse or its stable hash.
- Temporary and permanent definitions use the same shape with different scope.
- Large bodies should use refs.

Pressure:

- A stable definition body is not necessarily a moment in time. Treating it as a Pulse may blur the difference between an observation and the thing observed.
- Later review narrowed this direction: prefer ChangePulse plus an inline/referenced definition body unless a concrete source case needs `DefinitionPulse`.

### Direction C: Definition As ChangePulse Payload

```ts
type ChangePulse = {
  exportType: 'pulse';
  pulseKind: 'change';
  id: string;
  timestamp: string;
  surface: ChangeSurface;
  action: 'definition_created' | 'definition_updated' | 'definition_selected';
  subject: ExportRef;
  scope?: 'temporary' | 'permanent';
  operations?: ChangeOperation[];
  attributes?: {
    definitionKind?: DefinitionKind;
    definitionHash?: string;
    bodyRef?: ExportRef;
  };
  metadata?: Record<string, string>;
};
```

Rules to test:

- Definition creation and update are state changes.
- Runtime Pulses reference the ChangePulse, hash, or body ref.
- This preserves a smaller conceptual model.

Pressure:

- Runtime refs to `ChangePulse` may read poorly. "This tool call uses change_123" is less clear than "uses tool_definition_123."

## Candidate Definition Kinds

```ts
type DefinitionKind =
  | 'agent_config'
  | 'instructions'
  | 'tool_schema'
  | 'tool_definition'
  | 'model_settings'
  | 'request_context_schema'
  | 'processor_config'
  | 'scorer_config'
  | 'memory_config'
  | 'workflow_config';
```

## Temporary Versus Permanent

Temporary versus permanent describes scope of effect, not whether the definition is physically persisted.

Example:

- changing an agent's tool set for the remainder of a run is permanent within that run
- changing an agent's tool set only for the next step is temporary

Temporary definitions:

- are scoped to one step, tool call, model call, decision, or other bounded window
- may be generated during execution
- may still be recorded durably for observability
- still need stable references for later reconstruction

Permanent definitions:

- keep applying until another change replaces them
- may apply to the remainder of a run, a thread, a published version, or future runs
- need stable ids, hashes, or version ids
- explain behavior changes across time

## Data Rules

- Do not put large definition bodies in `data`.
- Use `data` only for numeric measurements related to definition use, such as schema field count or config version number if it is useful numerically.
- Prefer `attributes` or refs for body summaries and ids.

## Relationship Rules

Definition-related relationships to test:

- `uses_definition`
- `uses_config_version`
- `uses_tool_definition`
- `uses_instruction_version`
- `supersedes`
- `derived_from`

This pass may use relationship examples, but detailed graph design belongs to the Flow / Relationship Graph experiment.

## Skip Rules

Skip:

- UI clicks or editor interactions before a committed domain result exists
- list/get/query operations
- storage adapter internals
- product policy helper calls unless they commit a definition or block runtime behavior
- repeated runtime payloads that should belong to content Pulses instead of definitions

## Devil's Advocate

`Definition` may be a false abstraction. Instructions, schemas, model settings, and configs may only share the fact that they are reusable bodies; forcing them into one concept could hide important domain differences. The pass should fail `Definition` if examples need too many kind-specific escape hatches or if references become less understandable than direct domain fields.
