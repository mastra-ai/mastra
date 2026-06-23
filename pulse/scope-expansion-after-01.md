# Pulse Scope Expansion Notes

These notes capture additional Pulse candidates that are not covered well by the initial `packages/core/src` code audit.

The key expansion: Pulse should explain both runtime execution and the provenance of the runtime configuration.

## Execution And Configuration

The initial audit focused on user primitive execution:

- agent runs
- workflow runs
- tool calls
- model calls
- processors
- scorers/evals
- memory and state activity during execution

That is still the center of Pulse.

However, Mastra also owns product surfaces that mutate the thing being executed. Those changes are observability-adjacent because they explain why later runs behave differently.

Examples:

- an agent was created
- a tool was added to an agent
- a tool was removed from an agent
- instructions changed
- a model setting changed
- memory was enabled or disabled
- a workflow was attached
- an eval was attached
- a deployment was published

These are not runtime Pulses, but they are relevant causal context for downstream agent-learning systems.

## Configuration Pulses

Agent Builder and Agent CMS should emit Pulses for semantic configuration mutations.

Avoid emitting a Pulse for every UI interaction. Emit for committed domain actions.

Candidate actions:

- `agent_created`
- `agent_deleted`
- `instructions_changed`
- `tool_added`
- `tool_removed`
- `tool_config_changed`
- `model_changed`
- `model_settings_changed`
- `memory_enabled`
- `memory_disabled`
- `workflow_attached`
- `workflow_removed`
- `eval_attached`
- `eval_removed`
- `deployment_published`

These actions should be tied to the affected primitive, not the product area that happened to trigger the change.

Better:

```ts
{
  type: 'state',
  surface: 'agent_config',
  action: 'tool_added',
  primitive: {
    type: 'agent',
    id: 'support-agent'
  }
}
```

Weaker:

```ts
{
  type: 'state',
  surface: 'agent_builder',
  action: 'clicked_add_tool'
}
```

Reason: `agent_config.tool_added` remains meaningful whether the change came from UI, API, CLI, SDK, migration, or automation.

## Runtime Pulses Should Reference Config State

Execution Pulses should not duplicate all configuration details on every run.

Instead, runtime Pulses should reference the configuration state they used:

```ts
metadata: {
  projectId: 'project_123',
  agentId: 'support-agent',
  agentVersionId: 'agent_version_456',
  configRevisionId: 'config_revision_789'
}
```

This lets downstream systems connect behavior to config provenance:

- what changed before this bad run?
- which tool definition was active?
- which instructions revision produced this output?
- did score quality change after a model setting changed?

Open issue: some of these identifiers may be runtime attributes rather than metadata if they are internal Mastra entities instead of external correlation fields. The important point is that the runtime flow should reference config revision state.

## Capture Definitions Once, Reference Often

Current tracing captures tool names and descriptions on every tool call. That duplicates data and still omits important definition details.

Pulse should explore a definition-once, reference-many model.

Useful definition payloads:

- name
- description
- input schema
- output schema
- approval settings
- timeout settings
- retry settings
- provider/source
- enabled/disabled state
- definition hash
- schema hash

Example definition Pulse:

```ts
{
  type: 'state',
  surface: 'tool',
  action: 'definition_registered',
  primitive: {
    type: 'agent',
    id: 'research-agent'
  },
  attributes: {
    tool: {
      id: 'searchDocs',
      definitionHash: 'sha256:...',
      name: 'searchDocs',
      description: 'Search documentation.',
      inputSchema: {},
      outputSchema: {},
      approval: {
        required: false
      },
      timeoutMs: 30000
    }
  }
}
```

Example call Pulse:

```ts
{
  type: 'input',
  surface: 'tool',
  action: 'execute_started',
  primitive: {
    type: 'agent',
    id: 'research-agent'
  },
  attributes: {
    tool: {
      id: 'searchDocs',
      definitionHash: 'sha256:...'
    },
    input: {
      query: 'memory processors'
    }
  }
}
```

This saves repeated context and creates room to capture richer definitions.

Open issue: the first fit exploration used `attributes` for both context and payload. Tool definitions, schemas, raw inputs, and raw outputs make that ambiguity sharper. A future shape may need clearer fields such as `input`, `output`, `error`, `definition`, or `payload`.

## Flow Terminology

Use `flow` as the name for the full Pulse execution graph.

Working vocabulary:

| Concept | Preferred Term |
| --- | --- |
| full execution graph | flow |
| full execution graph id | flowId |
| first Pulse in a flow | origin Pulse |
| point-in-time observation | Pulse |
| structural rendering of linked Pulses | Pulse tree |

`tree` is useful for describing a structural view, but it is weaker as the primary concept. A flow can contain hierarchy and temporal sequence; a tree mostly implies hierarchy.

Current leaning:

- use `flowId` instead of `rootId` in Pulse-native APIs
- keep OpenTelemetry-compatible precision for IDs
- describe rendered hierarchy as a Pulse tree
- avoid `trace` except when explicitly discussing compatibility

## Threaded Agent Interactions

Most agent usage is threaded:

1. the user sends a message
2. the agent produces a response
3. the user replies with a new thought
4. the agent produces another response

Each turn can be its own flow, but the thread needs explicit ordering across flows.

Current tracing stores a thread id on each trace, but does not store a direct relationship between traces. Ordering can be reconstructed from timestamps, but that makes sequence implicit and fragile.

Pulse should capture thread relationships directly.

Possible flow-level fields:

```ts
type PulseFlow = {
  flowId: string;
  threadId?: string;
  previousFlowId?: string;
  nextFlowId?: string;
}
```

Or, if flow metadata stays external to Pulse records:

```ts
metadata: {
  threadId: 'thread_123',
  previousFlowId: 'flow_abc'
}
```

Current leaning:

- `threadId` groups flows into a conversation.
- `previousFlowId` and `nextFlowId` preserve turn order between flows.
- A single user turn should usually create one runtime flow.
- Flow-to-flow thread links should not replace Pulse `parent`/`next` links inside a flow.

This creates two relationship layers:

| Layer | Relationship | Purpose |
| --- | --- | --- |
| inside a flow | Pulse `parent`, `children`, `prev`, `next` | execution structure and local sequence |
| across flows | `threadId`, `previousFlowId`, `nextFlowId` | conversation turn order |

Open questions:

1. Should `nextFlowId` be stored or derived from `previousFlowId`?
2. Can a single user turn create multiple flows, such as background continuations or delegated durable work?
3. How should edited, retried, or regenerated thread turns be represented?
4. Should non-chat workflows have a thread-like grouping concept, or is this specific to conversational agents?

## Consequences For Next Fit Exploration

The next exploration should include both runtime and configuration candidates.

Questions to test:

1. Does `surface: 'agent_config'` work better than `surface: 'agent_builder'` or `surface: 'agent_cms'`?
2. Should config mutation Pulses have their own flows, or should they be standalone Pulses linked by `configRevisionId`?
3. Should runtime flows emit definition Pulses once at flow start, first use, or only when definitions differ from a known revision?
4. Should tool/model/agent definitions be Pulses, or should Pulses reference separate definition records?
5. Does the Pulse shape need explicit `input`, `output`, `error`, or `definition` fields instead of broad `attributes`?
6. How should a runtime flow point at the exact config state it used?
7. How should threaded agent turns link one flow to the previous flow?

Assumption to challenge: if Pulse includes configuration mutations, the boundary is no longer "things that happen during execution." The stronger boundary may be "things that materially explain execution behavior or learning outcomes."
