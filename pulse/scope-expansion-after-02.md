# Pulse Scope Expansion After Exploration 02

These notes capture scope added after `fit_exploration_02`.

The key expansion: Pulse should test whether agent context can be represented without repeatedly exporting full message arrays.

Additional exploration target: Agent Signals and Harness v1 should be explicitly tested in the next fit exploration. These are expected to be core agent infrastructure surfaces, so Pulse needs to represent their flow-level behavior well.

## Reviewed Corrections From Exploration 02

These notes revise assumptions from `fit_exploration_02` without rewriting that historical pass.

### Product Surface Versus Domain Result

Agent Builder and Agent CMS should not be treated as important Pulse surfaces by themselves.

The important fact is the result:

- agent config changed
- instructions changed
- tool was added
- model settings changed
- version was created or published

The product entry point can be captured as secondary context if useful:

```ts
attributes: {
  source: 'agent_builder'
}
```

But the Pulse surface should remain domain-oriented:

```ts
surface: 'agent_config'
action: 'tool_added'
```

### Thread ID Is Grouping, Not Ordering

`threadId` is a generic id that groups related flows. It is not ordered, and in many cases Pulse does not control it.

Thread order needs an explicit Pulse/flow relationship such as `previousFlowId`.

Current framing:

- `threadId`: groups related flows
- `previousFlowId`: orders one flow after another
- `nextFlowId`: likely derived

### `action` And `surface` Should Be Typed Sets

`action` and `surface` should not be unconstrained strings.

Exploration 03 should generate candidate closed sets for both:

```ts
type PulseSurface =
  | 'agent'
  | 'agent_config'
  | 'model'
  | 'tool'
  | 'context'
  | 'thread'
  | 'harness'
  | 'signal';

type PulseAction =
  | AgentAction
  | AgentConfigAction
  | ModelAction
  | ToolAction
  | ContextAction
  | ThreadAction
  | HarnessAction
  | SignalAction;
```

The likely final shape is a constrained action set by surface, not one global string enum.

### `PulseFlow` Is Still Open

A separate `PulseFlow` object may be useful because it avoids duplicating flow-level data on every Pulse:

- thread id
- previous flow id
- config/version references
- active context revision
- origin pulse id

But it is not settled. Exploration 03 should keep testing whether flow-level data should be:

- stored in a separate `PulseFlow` object
- repeated minimally on root/origin Pulse only
- derived from Pulse relationships and metadata

### `primitive` Should Stay Optional

`primitive` should not be required.

For many Pulses, the related primitive is implied by the parent Pulse or flow. Requiring `primitive` everywhere would recreate parent-context duplication.

Use `primitive` when it disambiguates ownership or links to a versioned entity. Otherwise inherit through flow/parent relationships.

### Duration Should Not Be Categorically Bad `data`

Exploration 02 was too strict about duration.

Duration should not be the primary Pulse model, and Pulse should not recreate spans. But measured elapsed values may still be useful numeric `data` for some point-in-time Pulses.

Possible acceptable cases:

- aggregated text chunk emitted after buffering
- model output completed with measured elapsed time
- harness delivery completed
- signal processing completed

Constraint:

- do not make every operation emit start/end/duration as a span replacement
- duration-like values should be attached only when they are meaningful measurements on a Pulse

### `resourceId` Is Probably Metadata

`resourceId` should generally be treated as metadata unless a concrete linking use appears.

Current framing:

- `threadId`: groups related conversational flows
- `previousFlowId`: orders flows
- `resourceId`: external/broader resource context, likely metadata

If later exploration finds `resourceId` is useful for linking flows or entities, that can be promoted. For now, avoid giving it structural meaning by default.

### Pulse May Not Be The Only Export Shape

Exploration 02 raised a bigger direction change: Pulse may be one export shape among several related append-only shapes.

Possible shapes:

- `Pulse`: timestamped observation
- `Definition`: stable description/schema/config object referenced by Pulses
- `Change`: domain/state/context mutation, optionally with diff operations
- `Relationship`: append-only link between already-emitted items

This may be cleaner than forcing every useful export into a Pulse.

Example:

```ts
type PulseExport =
  | Pulse
  | Definition
  | Change
  | Relationship;
```

This is especially relevant for append-only systems. Some facts are discovered after the original Pulse is emitted, such as a child link, next sibling link, or relationship to a later flow. Emitting a separate relationship item may be cleaner than mutating the earlier Pulse.

### Relationships May Be Their Own Export Type

Forward-looking links are awkward inside immutable Pulse records:

- `children`
- `next`
- `nextFlowId`
- regenerated-from links
- branch links
- definition-used-by links

If the stream is append-only, a later item may need to say:

```ts
{
  type: 'relationship',
  action: 'linked',
  from: { kind: 'pulse', id: 'pulse_parent' },
  to: { kind: 'pulse', id: 'pulse_child' },
  relationship: 'child'
}
```

This could simplify Pulse nesting:

- Pulses only need stable identity and maybe `parent` if known at emission.
- `children` can be derived from relationship items.
- `next` can be derived from sibling sequence or relationship items.
- cross-flow ordering can be appended later without rewriting prior flow records.

Open concern: too many relationship records could make reads expensive. The read model may need derived indexes/materialized views.

### Candidate Export Family

The next exploration should test whether Pulse is one member of a small append-only export family.

There are two competing versions to evaluate.

#### Reduced Family

Start with the smallest plausible set:

| Shape | Purpose | Notes |
| --- | --- | --- |
| `Pulse` | Point-in-time observation. Something happened now. | Core runtime unit. |
| `Change` | Something changed from one durable/logical state to another. | Can represent definitions, config updates, context edits, compaction, truncation. |
| `Relationship` | Append-only link between already-emitted items. | Can represent flow membership, parent/child, next sibling, previous flow, definition usage. |
| `Snapshot` | Optional bounded reconstruction checkpoint. | May be needed for context recovery, but could be represented as a Change unless it proves distinct. |

In the reduced family:

- A definition is a `Change`: definition created or updated.
- A flow can be represented by `Relationship` records linking Pulses, Changes, and other items.
- A thread sequence is a `Relationship`: current flow follows previous flow.
- A context truncation is a `Change` with operations.
- A context checkpoint may be a `Snapshot` or a `Change` depending on whether snapshots need special query/storage handling.

Possible reduced type:

```ts
type PulseExport =
  | Pulse
  | Change
  | Relationship
  | Snapshot;
```

Or even:

```ts
type PulseExport =
  | Pulse
  | Change
  | Relationship;
```

Devil's advocate: if `Change` absorbs definitions, config mutations, context updates, and snapshots, it may become the new catch-all. The reduced set only works if `Change` has strong subtypes/actions and good references.

#### Expanded Family

The larger split gives each concept its own shape:

| Shape | Purpose | Examples | Should Not Carry |
| --- | --- | --- | --- |
| `Pulse` | Point-in-time observation. Something happened now. | tool execution started, text chunk emitted, signal applied, harness suspended | large stable definitions, full message arrays, future links |
| `Flow` | Execution grouping and flow-level context. | agent turn, harness invocation, durable resumed run | every child observation, full config, full messages |
| `Definition` | Stable content or schema referenced by id/hash/version. | tool definition, agent instructions, model config, output schema, processor config | per-call runtime payload |
| `Change` | Domain/state/context mutation, optionally with diff operations. | agent version created, tool added, instructions changed, context truncated, message removed, memory compacted | unrelated runtime execution details |
| `Relationship` | Append-only link between existing exports. | pulse child, next sibling, previous flow, branch, regeneration, definition used | payload content that belongs in the linked item |
| `Snapshot` | Bounded reconstruction checkpoint. | context snapshot by message ids, active tool definition set, memory revision set | full repeated bodies unless there is no separate content store |

This family may reduce pressure on `Pulse` to be everything.

Important distinction:

- `Pulse`: observation
- `Definition`: reusable thing observed or used
- `Change`: mutation from one state/revision to another
- `Relationship`: graph edge
- `Snapshot`: bounded read/reconstruction helper

Devil's advocate: adding more shapes could undercut the radical simplicity of Pulse. The benefit must be concrete: less duplicated storage, clearer semantics, and easier append-only export. If the shapes become vague buckets, this direction fails.

#### What Exploration 03 Should Compare

The next exploration should evaluate both families:

1. Reduced: `Pulse`, `Change`, `Relationship`, maybe `Snapshot`.
2. Expanded: `Pulse`, `Flow`, `Definition`, `Change`, `Relationship`, `Snapshot`.

Evaluation criteria:

- Can it represent a full agent turn without message arrays?
- Can it represent tool definitions without repeated schemas?
- Can it represent config provenance without making every config edit a Pulse?
- Can it represent flow/thread order in append-only form?
- Can it represent context truncation/removal compactly?
- Does it keep reader/query complexity reasonable?
- Does any shape become a vague dumping ground?

### Candidate Export Envelopes

If there are multiple shapes, they should probably share a small common envelope:

```ts
type ExportEnvelope = {
  id: string;
  exportType: 'pulse' | 'flow' | 'definition' | 'change' | 'relationship' | 'snapshot';
  timestamp: string;
  metadata?: Record<string, string>;
};
```

Then each shape owns its own payload:

```ts
type PulseExport = ExportEnvelope & {
  exportType: 'pulse';
  surface: PulseSurface;
  action: PulseAction;
  type: PulseType;
  data?: Record<string, number>;
  payload?: unknown;
};

type DefinitionExport = ExportEnvelope & {
  exportType: 'definition';
  definitionType: 'tool' | 'instructions' | 'model_config' | 'schema' | 'processor' | 'memory_config';
  definitionId: string;
  hash?: string;
  payload: unknown;
};

type RelationshipExport = ExportEnvelope & {
  exportType: 'relationship';
  relationshipType: 'parent' | 'next' | 'previous_flow' | 'uses_definition' | 'branch_of' | 'regeneration_of';
  from: ExportRef;
  to: ExportRef;
};
```

`Change` can carry both the high-level mutation and optional low-level diff:

```ts
type ChangeExport = ExportEnvelope & {
  exportType: 'change';
  surface: PulseSurface;
  action: PulseAction;
  target: ExportRef;
  beforeRef?: ExportRef;
  afterRef?: ExportRef;
  operations?: Array<{
    op: 'add' | 'remove' | 'replace' | 'move' | 'truncate' | 'compact';
    path?: string;
    valueRef?: ExportRef;
    data?: Record<string, number>;
  }>;
};
```

Open issue: the shared envelope may want `flowId`, but not every export belongs to a flow. Definitions and config changes may be global/project-scoped.

### What This Could Solve

This export-family direction could solve several problems that kept appearing in exploration 02:

- tool schemas do not fit cleanly inside Pulse
- config changes are not really execution observations
- context/message removals are changes, not logs
- `children` and `next` are forward-looking links in an append-only stream
- thread ordering is a relationship between flows
- message arrays should be represented by content references and context changes
- `attributes` is overloaded because too many concepts are forced into one object

### What This Could Break

Risks:

- More shapes means more mental overhead.
- Export consumers need to handle multiple records.
- Query APIs need materialized views or indexes.
- It may become unclear when to emit a Pulse versus a Change.
- "Pulse" may stop being the single unified observability unit.

Possible constraint:

Keep Pulse as the only time-series observation shape, but allow supporting append-only records for stable references and graph edges.

In that framing:

- Pulse remains the core unit.
- Definition/Change/Relationship/Snapshot are support records.
- UI and learning systems can still render everything as a Pulse-informed flow.

### `attributes` Is Probably The Wrong Catch-All

Exploration 02 used `attributes` for too many things:

- input payloads
- output payloads
- tool definitions
- config contents
- config diffs
- message ids
- aggregation details
- internal counters
- source context

This is a smell. Many examples that used `attributes` should probably use a top-level `payload` or more specific top-level fields.

Current direction:

```ts
type Pulse = {
  surface: PulseSurface;
  action: PulseAction;
  payload?: unknown;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
}
```

Possible division:

- `payload`: the actual thing observed or changed
- `attributes`: query/filter context about the observation
- `metadata`: external string-to-string correlation only
- `data`: numeric values worth graphing/aggregating

This would move many current examples:

- tool schemas: `payload.definition`
- raw tool input/output: `payload.input` / `payload.output`
- config changes: `payload.diff`
- message content: `payload.content`
- chunk text: `payload.text`
- message id / chunk index / character count: likely `attributes`, not `data`

### No Free-Form Code-Set Strings

In general, fields set by Mastra code should come from typed string sets.

Free-form strings should be limited to:

- `payload`
- `metadata` values
- user/model/tool content

This applies to:

- `surface`
- `action`
- `type`
- `level`
- entity/primitive type
- reason/status values if they are system-authored

If `action` becomes a free-form string, the fit matrices lose much of their value.

### Config Diffs Need Content, Not Only Field Names

`changedFields` and `changedFieldCount` are not enough.

For config provenance, Pulse needs to capture the actual changed content or enough reference data to recover it:

- instructions content or instruction version reference
- input/output schemas
- selected tools and tool definitions
- model and model config
- memory config
- processor config
- scorer/eval config
- workflow/subagent attachments

`changedFieldCount` is usually not useful `data`.

Possible shape:

```ts
payload: {
  diff: {
    instructions: {
      beforeRef: 'instructions_v3',
      afterRef: 'instructions_v4',
      after: '...'
    },
    model: {
      before: { provider: 'openai', name: 'old-model' },
      after: { provider: 'openai', name: 'new-model', temperature: 0.2 }
    }
  }
}
```

Open issue: full diffs can be large and sensitive. The next exploration should test full content, content refs, and hashes.

### `data` Should Be Graph-Worthy

Exploration 02 examples put some weak values in `data`.

Weak `data` examples:

- `changedFieldCount`
- `chunkIndex`
- `characterCount`

These are usually attributes or payload details, not metrics worth graphing.

Better rule:

Use `data` only for numeric values we expect to graph, trend, aggregate, compare, alert on, or score.

### Config Changes Should Not Create Flows For Now

Flows should stay execution-oriented for now.

Config-change Pulses should be able to exist outside a flow.

There may eventually be an execution-like grouping for config changes, but it should not be called `flow` unless it truly behaves like an execution graph. Names like `refactor` are possible but premature.

Current leaning:

- runtime executions create flows
- config mutations emit standalone Pulses
- runtime flows reference config/entity versions

### `primitive` May Actually Be `entity`

Exploration 02 used `primitive`, but config provenance makes that term feel narrow.

The thing being referenced may be:

- agent
- tool
- workflow
- scorer
- skill
- memory config
- workspace
- model config
- harness
- signal

`entity` may be a better field name:

```ts
entity: {
  type: 'agent',
  id: 'sales-drop-watcher',
  versionId: 'agent_version_1'
}
```

Open issue: `primitive` is better for runtime concepts, `entity` is better for versioned/config concepts. The next exploration should test both.

### `version_created` May Be Enough

`agent_created` is probably too agent-scoped.

If a config entity has versioned state, `version_created` may be enough to capture both creation and later changes.

Alternative generic actions:

- `entity_created`
- `version_created`
- `version_published`
- `version_archived`

Current leaning: prefer generic config actions plus typed entity/surface context over agent-specific actions like `agent_created`.

### Definition Needs A Definition

Exploration 02 used "definition" loosely.

The next exploration should define what a definition is.

Possible definition targets:

- tool definition
- model definition/config
- agent version definition
- workflow definition
- scorer definition
- skill definition
- processor graph definition

Definition may mean:

- stable content-addressed record
- versioned config snapshot
- runtime-resolved executable shape
- user-editable source config

These are not the same. Tool runtime definition, stored tool config, and model-facing schema may differ.

### Store Only `previousFlowId`

Pulses should be immutable after creation. Flows should probably follow the same bias.

Do not require updating a previous flow to add `nextFlowId`.

Current leaning:

- store `previousFlowId`
- derive forward traversal through query/materialized views if needed
- defer storage/query mechanics

### Branching Needs More Than `previousFlowId`

Regeneration and branching can be deferred, but `previousFlowId` alone cannot distinguish the original path from a branch.

`branchFromFlowId` is a reasonable starting field to explore later.

### Stored Overrides Should Emit Runtime Decision Pulses

Any time an agent or other entity uses config different from the default/current base config, Pulse should capture it.

Examples:

- stored override applied to code-defined agent
- draft version used instead of published version
- conditional model variant selected
- tool description override applied
- request-context rule selected a different processor graph

These are runtime `decision` Pulses because they explain why execution used a different effective config.

## Message Arrays Are Probably The Wrong Unit

Agent interactions are threaded. Each new turn often includes some or all previous thread messages in model context.

Current tracing tends to store full message arrays on each trace/flow. Across a thread, that creates a large amount of duplicated observability storage:

- same system instructions
- same earlier user messages
- same earlier assistant outputs
- same tool call/result history
- same summarized or truncated context

Pulse should explore whether message arrays should not be exported as a field at all.

## Candidate Principle

Do not store `messages: [...]` on Pulses by default.

Represent message context as Pulses:

- `system_instructions_set`
- `user_message_received`
- `generation_started`
- `text_chunk_emitted`
- `assistant_message_completed`
- `tool_call_added`
- `tool_result_added`
- `context_truncated`
- `context_compacted`
- `context_removed`
- `context_referenced`

This makes context evolution explicit and avoids repeating the whole message array in every flow.

## Change Pulses With Diff Operations

Question: should Pulse support change observations with optional diff operations?

Example:

```ts
{
  type: 'state',
  surface: 'context',
  action: 'context_removed',
  primitive: {
    type: 'agent',
    id: 'support-agent',
    versionId: 'agent_version_4'
  },
  attributes: {
    removed: {
      messageIds: ['msg_001', 'msg_002'],
      reason: 'truncation'
    },
    activeContext: {
      contextRevisionId: 'ctx_rev_12'
    }
  },
  data: {
    removedMessageCount: 2
  }
}
```

This is useful because it says exactly what changed without restating the full active context.

Concern: if every context mutation becomes a detailed change record, Pulse becomes an event-sourced context store. That may be correct, but it is a bigger model than simple observability.

## Message Context Surfaces

Candidate surfaces:

- `message`
- `context`
- `thread`
- `agent_context`
- `prompt_context`

Current leaning: `context` or `agent_context`.

Reason:

- `message` describes a unit, not the state the model sees.
- `thread` describes the cross-flow grouping.
- `agent_context` is precise but may be too agent-specific for workflows/scorers/processors.
- `prompt_context` is model-facing, but context can include tool state and memory state too.

## Snapshot Versus Change Operations

Pure change operations are lean but harder to reconstruct.

Full snapshots are easy to inspect but duplicate data.

Possible hybrid:

- emit change operations for ordinary changes
- emit compact snapshots at boundaries or checkpoints
- snapshots store IDs/hashes, not full message bodies
- content bodies are stored once and referenced by content/message IDs

Example snapshot Pulse:

```ts
{
  type: 'state',
  surface: 'context',
  action: 'context_snapshot',
  attributes: {
    contextRevisionId: 'ctx_rev_12',
    messageIds: ['msg_003', 'msg_004', 'msg_005'],
    instructionId: 'instructions_v4',
    memoryRevisionId: 'memory_rev_8'
  },
  data: {
    messageCount: 3
  }
}
```

This avoids full message arrays while keeping reconstruction bounded.

## Cross-Thread / Cross-Flow Implication

With `threadId` and `previousFlowId`, later flows can reference earlier context instead of copying it.

Possible flow-level fields:

```ts
type PulseFlow = {
  flowId: string;
  threadId?: string;
  previousFlowId?: string;
  contextRevisionId?: string;
  previousContextRevisionId?: string;
}
```

Open issue: context revisions may belong on the flow, on context Pulses, or in a separate context store.

## Questions For A Future Exploration

1. Can a full agent turn be represented without a `messages` array?
2. Can system instructions be represented as their own Pulse/reference?
3. Can user and assistant messages be represented as content Pulses?
4. Can tool calls/results join context without duplicating prior messages?
5. Can truncation/removal be represented as Change records with operations?
6. Do we need periodic snapshots for reconstruction?
7. Should message bodies be stored once by ID/hash and then referenced?
8. How does this interact with threaded `previousFlowId`?
9. Can Agent Signals be represented as flow-level or context-level Pulses without becoming generic state logs?
10. Can Harness v1 runs produce useful flow Pulses for input, routing, execution, suspension, resume, delivery, and failure?
11. What are the initial closed sets for `surface` and surface-specific `action`?
12. Is a separate `PulseFlow` object necessary, or can flow-level facts live on origin Pulses?
13. When should duration-like numeric measurements be allowed in `data` without recreating spans?
14. Should Pulse exports include non-Pulse shapes such as definitions, changes, relationships, and snapshots?
15. Should forward-looking links like `children`, `next`, and `nextFlowId` be emitted as relationship records instead of stored on original records?
14. Should `payload` become a top-level field separate from `attributes`?
15. Should `primitive` be renamed to `entity`, or do we need both?
16. Can config mutation Pulses live outside flows cleanly?
17. What exactly counts as a definition?
18. How should full config diffs be represented without storing sensitive or huge duplicate payloads?

## Agent Signals

Agent Signals should be a first-class target for the next fit exploration.

The main question is whether signals are:

- Pulse inputs to an agent flow
- Pulse state changes inside an agent flow
- cross-flow coordination events
- context changes that affect what the agent sees
- external infrastructure events that should be referenced but not emitted as Pulses

Candidate Pulse actions to test:

- `signal_received`
- `signal_validated`
- `signal_routed`
- `signal_applied`
- `signal_ignored`
- `signal_failed`
- `context_updated`

Devil's advocate: if every signal becomes a Pulse, Agent Signals could turn Pulse into a generic event bus. The fit test should focus on signals that materially affect agent execution, context, thread state, or downstream learning.

## Harness V1

Harness v1 should also be a first-class target for the next fit exploration.

The main question is how Harness maps to flows:

- Does one harness invocation create a flow?
- Does it wrap an agent flow?
- Does it create a parent flow with child agent flows?
- Does suspension/resume continue the same flow or create linked flows?
- Which harness delivery events are meaningful versus transport noise?

Candidate Pulse actions to test:

- `harness_input_received`
- `harness_context_prepared`
- `harness_agent_selected`
- `harness_run_started`
- `harness_run_suspended`
- `harness_run_resumed`
- `harness_output_delivered`
- `harness_run_failed`

Current leaning:

- Harness should emit flow-level Pulses when it owns orchestration or delivery semantics.
- Agent runtime Pulses should still belong to the agent flow.
- Harness transport details should be skipped unless they affect user-visible delivery or execution behavior.

## Initial Leaning

Pulse probably needs context Change records with optional diff operations.

But the change model should be constrained:

- only for meaningful context state changes
- no full message arrays by default
- message/content bodies stored once and referenced
- snapshots should reference IDs/hashes, not copy bodies
- flow records should carry the active context revision used by the model
- Agent Signals and Harness v1 should be tested explicitly before locking the flow model.
- `surface` and `action` should be constrained vocabularies, not arbitrary strings.
- `primitive` should remain optional and inherited when possible.
- `resourceId` should be treated as metadata unless a structural linking use is proven.
- The next exploration should test whether Pulse is part of a small append-only export family rather than the only export shape.
- `payload` likely needs to exist separately from `attributes`.
- Config mutation Pulses should probably exist outside execution flows.
- Config provenance needs actual changed content or references, not just changed field names.
