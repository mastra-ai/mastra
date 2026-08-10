# Open Questions

## Definition Shape

### Is a definition observable?

If a definition is a stable body, it may not be an observation. The observable fact may be that the definition was created, updated, selected, or used.

Decision pressure:

- If the body itself is an artifact, keep it separate and emit Pulses about lifecycle/use.
- If the act of introducing the body is enough, use DefinitionPulse or ChangePulse.

Current leaning after source review:

- Durable/reusable bodies such as agent config versions, stored tool definitions, instruction revisions, and request context schemas read best as referenced artifacts.
- Runtime introduction, update, selection, failure, and use of those bodies are Pulses.
- Short-lived generated bodies should usually be inline or referenced definition bodies on ChangePulses.
- `DefinitionPulse` should stay provisional until a concrete source case reads worse without it.

### Is `DefinitionPulse` meaningfully different from `ChangePulse`?

Definition creation and update are changes. A separate DefinitionPulse only earns its place if runtime refs, queries, and examples become clearer.

Current leaning:

- Most temporary definitions introduced during execution should be ChangePulses with inline or referenced definition bodies.
- Permanent config changes should probably be ChangePulses that point at referenced definition artifacts.
- `DefinitionPulse` only earns its place if "definition introduced" is itself the clearest runtime observation and there is no better mutation target.

### How should temporary definitions be scoped?

Temporary versus permanent describes scope of effect. Temporary definitions may be step-scoped, tool-call-scoped, model-call-scoped, or decision-scoped. Permanent definitions apply until another change replaces them, which may mean the remainder of a run rather than forever.

Example:

- changing an agent's tool set for the remainder of a run is permanent within that run
- changing an agent's tool set only for the next step is temporary

Open issue:

- Does the scope belong on the definition, the relationship, the using Pulse, or all of them?

Current leaning:

- Put durable scope on the definition or ChangePulse.
- Put narrow applicability on the relationship or using Pulse when the same body is reused for one step/call.

### What is the minimal body/ref strategy?

Options:

- inline small bodies
- content-addressed body refs
- existing config/version ids
- definition hashes
- external artifact references

Concern:

- Without a body/ref strategy, definitions either duplicate large payloads or become impossible to reconstruct.

### When should schemas be standalone definitions?

Current leaning:

- Keep schemas nested when they are only meaningful as part of their owner.
- Split schemas into standalone definitions when they can be independently referenced, transformed, versioned, or used to explain a runtime validation/compatibility decision.

Examples:

- transformed provider-facing tool schema may need a separate definition from author schema
- request context schema should be independently referenceable by validation failure Pulses
- structured output schema may be independently referenced by structuring-agent Pulses

## Runtime References

### What should runtime Pulses reference?

Candidate refs:

- definition id
- definition hash
- config version id
- DefinitionPulse id
- ChangePulse id
- body ref

The answer may differ by permanent versus temporary definition.

Current leaning:

- permanent config: reference config version id and more specific definition ids when useful
- tool call: reference tool definition id/hash
- model call: reference model settings definition only when settings differ from inherited config or explain routing/fallback behavior
- temporary override: reference the ChangePulse that introduced the override, plus the inline/referenced definition body when needed

### Can definitions avoid repeating runtime payloads?

Definitions should describe stable or reusable behavior, not per-run content. User messages, LLM output chunks, and memory pull content should stay content-bearing Pulses unless they become reusable definitions.

## Failure Conditions

This direction should fail if:

- every definition kind needs a bespoke shape
- runtime refs become less semantic than direct fields
- temporary definitions become indistinguishable from ordinary content
- permanent definitions duplicate existing config/version records without adding query value
- the model recreates generic resource/event taxonomies under Pulse names
- schema definitions become so granular that common reads require excessive dereferencing
- schema definitions stay so nested that validation and compatibility decisions cannot reference the exact contract used
