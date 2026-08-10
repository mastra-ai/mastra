# Learnings Summary

This pass tested definition representation against agent config versions, runtime instructions/tools/model settings, tool schemas, request context schemas, and step-scoped active tool changes.

## Confirmed

### Definitions Are Useful, But Not Everything Should Be A DefinitionPulse

The source has many stable bodies that runtime behavior should reference:

- agent config version snapshots
- instructions
- model config and model settings
- tool definitions
- input/output/suspend/resume schemas
- request context schemas
- processor, memory, scorer, and workflow config

The strongest shape is not "all definitions are Pulses." The stronger split is:

- definition bodies can be referenced artifacts
- creation/update/selection/use/failure are Pulses

This keeps the Pulse premise focused on observations while avoiding awkward refs like `uses change_123`.

### Tool Definitions Are The Strongest Artifact Case

Tools include id, description, schemas, approval policy, suspend/resume support, strict mode, provider options, transforms, and metadata. Runtime tool calls should not copy that body.

`uses_tool_definition` reads better than `uses_definition_change`.

### Agent Config Versions Already Behave Like Definition Bundles

`StorageAgentSnapshotType` stores all runtime-affecting agent config in version rows, and resolved agents expose `resolvedVersionId`.

This suggests an agent config version can be a bundle of definitions:

- instructions
- model
- tools
- processors
- memory
- scorers
- request context schema

The storage adapter should not emit Pulse directly. The product/API boundary that creates, publishes, or activates the version should emit the ChangePulse.

### Temporary Versus Permanent Is Scope Of Effect

Permanent does not mean "persisted forever."

- Tool set changed for the remainder of a run: permanent within that run.
- Tool set changed only for the next step: temporary.

Processors changing `activeTools` are a concrete temporary definition/change case.

### Request Context Schemas Fit Definition References

Agent request context schemas are stored as JSON Schema in version snapshots. Tools can also carry request context schemas.

Runtime validation failures should reference the schema definition, not copy it.

### Processor Outputs Can Create Scoped Definitions

Processors can change model, tools, tool choice, active tools, provider options, model settings, and structured output for a step.

This is a concrete source of temporary definitions. The definition body may be a schema/settings/tool set, while the Pulse records when it became active and for what scope.

### Scorer Definitions Match The Versioned Definition Pattern

Stored scorer definitions use the same versioned-domain shape as agents: thin record plus versioned snapshot content. Scorer selection for a run or experiment should reference the scorer definition/version; score generation itself remains runtime Pulse.

### Full Scenario Supports The Hybrid

A realistic run can combine durable config refs, step-scoped active-tool changes, runtime tool calls, a temporary structured-output schema, and one-call model settings without making every body a Pulse.

The scenario did not need Snapshot or an exported Flow envelope. It did need relationships for `uses_config_version`, `uses_instruction_version`, `uses_tool_definition`, and generic `uses_definition`.

### Adversarial Review Narrows `DefinitionPulse`

The model is stronger if `DefinitionPulse` is not a core family member. Most runtime-generated definitions can be represented as ChangePulses that select or introduce an inline/referenced definition body for a scope.

Keep `DefinitionPulse` provisional for cases where "definition introduced" is itself the clearest runtime observation and there is no better mutation target. Test `ChangePulse` first.

## Weakened Or Unresolved

### `DefinitionPulse` Is Narrower Than Expected

It may be useful for definitions introduced during execution, such as a run-local generated tool schema. It is weaker for durable config because the stable body is not itself a moment. The moment is the creation/update/publish/select event.

After the adversarial pass, the default should be `ChangePulse` plus an inline or referenced definition body. Only keep `DefinitionPulse` if a concrete source case reads worse without it.

### Schema Granularity Is Still Open

Input/output schemas can be part of a tool definition, separate schema definitions, or both. Separate schema definitions are useful when compatibility layers transform author schemas into provider-facing schemas.

Second-pass rule: split schema definitions only when independent reference, transformation, versioning, or validation explanation requires it.

### Body Storage Is Still Needed

Examples use `bodyRef`, but the exact content-addressing or artifact storage strategy is not designed here.

## Candidate Direction After This Pass

Use a hybrid:

```ts
type DefinitionRef = {
  kind: DefinitionKind;
  id: string;
  version?: string | number;
  hash?: string;
};
```

Then:

- durable/reusable bodies are referenced definition artifacts
- config/version lifecycle is represented by ChangePulses
- temporary generated definitions are usually ChangePulses with inline or referenced definition bodies
- `DefinitionPulse` remains a rare/provisional escape hatch
- runtime Pulses link to definitions with relationships such as `uses_tool_definition`, `uses_instruction_version`, or `uses_config_version`

## Risks

- Referenced artifacts can become a second telemetry object model if treated as exported observability records.
- Embedded temporary definitions can bloat Pulses if bodies are large.
- `DefinitionKind` can become a dumping ground unless each kind has clear runtime-reference value.
- Tool-set changes need precise scope fields or they will be confused with durable agent config changes.

## Next Things To Test

- Run the Flow / Relationship Graph experiment, because definition references depend on relationship semantics.
- Test schema granularity: author schema versus provider-compatible schema versus runtime validation schema.
- Re-test the full scenario after the relationship-graph experiment defines edge and ordering semantics.
- Do a smaller Agent Signals review later; state-signal definitions may behave like temporary context definitions.
