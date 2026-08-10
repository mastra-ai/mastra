# Definition Edge Cases

This file records second-pass cases that stress the initial hybrid direction:

- durable/reusable bodies are referenced definition artifacts
- lifecycle and applicability changes are Pulses
- temporary generated definitions are usually inline or referenced bodies on ChangePulses

## Processor-Created Runtime Definitions

Source:

- `packages/core/src/processors/index.ts`
- `packages/core/src/processors/runner.ts`
- `packages/core/src/processors/process-input-step.test.ts`

Processors can change step-local execution inputs:

- `model`
- `tools`
- `toolChoice`
- `activeTools`
- `providerOptions`
- `modelSettings`
- `structuredOutput`
- messages and system messages

Fit:

- changing `activeTools` is a `ChangePulse(tool_config.active_tools_changed)`
- changing `modelSettings` is a `ChangePulse(model.settings_selected)`
- changing `structuredOutput.schema` can introduce a temporary schema definition
- changing messages remains context/content change, not definition

Concern:

- Processors can produce both definitions and ordinary context changes. The determining question is whether the output is a reusable/scoped contract for later behavior, not whether it came from a processor.

## Tool Search Processor

Source:

- `packages/core/src/processors/processors/tool-search.ts`

The tool search processor creates a searchable catalog of tools from statically configured processor tools, and optionally request-resolved tools.

Fit:

- the searchable catalog is a definition set
- `search_tools` and `load_tool` are runtime tool Pulses
- loaded-tool state is a ChangePulse over active tool definitions
- context-derived loaded state reinforces the need for relationships/content reconstruction

Suggested shape:

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
  surface: 'tool_config',
  action: 'tool_loaded',
  scope: 'temporary',
  subject: { kind: 'thread_or_flow', id: 'thread_123' },
  attributes: {
    processorId: 'tool-search',
    toolRef: { kind: 'definition', id: 'tool_createIssue_v1' },
    store: 'context'
  }
}
```

Observation:

- This should not create a new tool definition if the tool already has one.
- The Pulse-worthy fact is that a known definition became active in this context.

## Structured Output Processor

Source:

- `packages/core/src/processors/processors/structured-output.ts`

Structured output has:

- schema
- structuring model
- generated or supplied instructions
- error strategy
- fallback value
- provider options
- optional internal structuring agent

Fit:

- schema is a definition candidate
- generated structuring instructions are a temporary definition candidate
- the internal agent run is runtime behavior and should be observed separately

Observation:

- This is a strong temporary-definition case, but it does not require `DefinitionPulse`. A ChangePulse that selects or introduces the schema for a step is likely clearer.
- If the schema is configured durably on an agent, it should instead be referenced as part of the agent config version.

## Workflow And Step Definitions

Source:

- `packages/core/src/workflows/types.ts`

Workflow and step config contain ids, descriptions, metadata, schemas, retries, scorers, and schedules.

Fit:

- workflow definition is a durable artifact candidate
- step schemas are sub-definitions or fields on workflow definition
- schedule config is a definition only if it materially explains runtime invocation
- step execution is runtime Pulse, not definition

Concern:

- Workflow topology can easily become a trace substitute. Keep definitions to stable executable contract/config; use runtime Pulses for actual execution.

## Scorer And Dataset Definitions

Source:

- `packages/core/src/storage/domains/scorer-definitions/base.ts`
- `packages/core/src/storage/types.ts`
- `packages/core/src/evals/*`
- `packages/core/src/datasets/experiment/*`

Stored scorer definitions are versioned like agents. Dataset and experiment code also carries scorer ids and schemas.

Fit:

- stored scorer version is a definition artifact
- scorer selected for an experiment/run/item is a ChangePulse or Relationship
- actual score generation is runtime Pulse
- dataset schemas are definitions when they constrain experiment input, ground truth, or request context

Observation:

- Scorer definitions support the same hybrid as agent config versions.
- Dataset input/ground-truth schemas are not runtime observations, but they explain eval behavior and should be referenced by experiment Pulses.

## Schema Granularity Rule

Candidate rule:

- Keep schema inline inside the owning definition when it is only meaningful as part of that owner.
- Split schema into its own definition when it can be referenced independently, transformed independently, versioned independently, or used to explain a runtime validation/compatibility decision.

Examples:

- tool input schema as part of a tool definition: usually inline/ref inside tool definition
- provider-compatible transformed schema: separate definition if it differs from author schema
- request context schema: separate definition when runtime validation failures reference it
- structured output schema: separate definition when it drives a processor/internal agent

## Updated Failure Conditions

The hybrid direction fails if:

- definition artifacts need Pulse timestamps to make sense
- too many definitions are one-off payloads with no later references
- relationship/query design cannot express `uses_definition`
- readers must dereference too many tiny schema artifacts for common views
- definition scope cannot be represented cleanly for step/call/run/thread/version
