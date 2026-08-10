# Exploration Log

## 2026-08-10 - Setup

Read:

- `pulse/fit_exploration_procedure.md`
- `pulse/experiment-backlog.md`
- `pulse/fit_exploration_03/README.md`

Assumptions:

- This pass should focus on definitions, not flow graph mechanics.
- `ChangePulse` is allowed as a working term even though earlier notes use `Change`.
- A definition may be temporary or permanent by scope of effect. For example, a tool-set change for the remainder of a run is permanent within that run, while a tool-set change for only the next step is temporary.
- A definition might be a separate artifact, a special Pulse type, or a body attached to a definition-created / definition-updated Pulse.

Prepared:

- canonical exploration files
- source inspection plan
- initial shape rules and fit matrix scaffold

Risk noticed:

- If every config or schema body becomes a "definition," the term stops helping. This pass needs concrete failure conditions.

## 2026-08-10 - Source Review

Read:

- `packages/core/AGENTS.md`
- `packages/core/src/storage/types.ts`
- `packages/core/src/storage/domains/agents/base.ts`
- `packages/core/src/storage/domains/versioned.ts`
- `packages/core/src/storage/domains/agents/inmemory.test.ts`
- `packages/core/src/agent/agent.ts`
- `packages/core/src/tools/tool.ts`
- `packages/core/src/tools/types.ts`
- `packages/core/src/tools/tool-builder/builder.ts`
- `packages/core/src/tools/validation.ts`
- `packages/core/src/integration/openapi-toolset.ts`
- `packages/core/src/processors/runner.ts`
- `packages/core/src/processors/process-input-step.test.ts`

Findings:

- Agent config versions already contain definition-like bodies: instructions, model config, tool config, processor config, memory config, scorer config, request context schema, and other runtime-affecting fields.
- Version rows already have `id`, `versionNumber`, `changedFields`, `changeMessage`, and `createdAt`.
- Resolved agents merge the thin entity with a version snapshot and expose `resolvedVersionId`.
- Agent runtime resolves instructions, tools, model selection, model settings, provider options, headers, toolsets, and request context dynamically per request.
- Tools carry stable definition bodies: id, description, input schema, output schema, suspend/resume schemas, request context schema, approval policy, strict mode, provider options, transform hooks, and MCP metadata.
- Processors can change `activeTools` step-by-step, which is a direct example of temporary definition scope.
- Request-level `toolsets` and input-processor-loaded tools are concrete examples of runtime-scoped tool definitions.

Risk noticed:

- Permanent config versions and temporary runtime decisions use the same kinds of bodies. The useful distinction is scope of effect, not storage location.
- A separate `Definition` artifact reads best for reusable bodies, but definition lifecycle still needs Pulses.

## 2026-08-10 - Edge Case Pass

Read:

- `packages/core/src/storage/domains/scorer-definitions/base.ts`
- `packages/core/src/storage/types.ts`
- `packages/core/src/workflows/types.ts`
- `packages/core/src/processors/index.ts`
- `packages/core/src/processors/processors/tool-search.ts`
- `packages/core/src/processors/processors/structured-output.ts`
- `packages/core/src/processors/processors/tool-call-filter.ts`
- `packages/core/src/mastra/types.ts`

Findings:

- Scorer definitions use the same versioned-storage pattern as agent configs.
- Workflow and step definitions contain many schema contracts but should not become trace-like runtime trees.
- Processor step outputs can introduce temporary model/tool/schema settings for one step.
- Tool search separates searchable tool definitions from loaded/active tool state.
- Structured output introduces a runtime schema and generated instructions that can be temporary definitions.

Risk noticed:

- Schema granularity needs a rule. Splitting every schema into a standalone artifact makes common reads too expensive; keeping every schema nested makes validation/compatibility decisions harder to explain.

## 2026-08-10 - Adversarial Review

Read:

- `pulse/fit_exploration_04/05-learnings-summary.md`
- `pulse/fit_exploration_04/09-candidate-model.md`
- `pulse/fit_exploration_04/10-full-scenario.md`

Tried:

1. Treat `DefinitionRef` as a referenced artifact/body, not an observability event.
   - Result: works if definitions do not carry event fields like `timestamp`, `surface`, `action`, or lifecycle state.
   - Concern: if definition lifecycle is recorded outside Pulse, the model splits into two event systems.
2. Remove `DefinitionPulse` from the core model.
   - Result: most examples read better as ChangePulses with inline or referenced definition bodies.
   - Concern: there may still be a rare runtime case where "definition introduced" is the clearest observation.

Risk noticed:

- The definition model depends on relationship graph semantics. Without a way to reconstruct active definitions for a Pulse, refs become too indirect.

## 2026-08-10 - Relationship Handoff

Prepared:

- `11-adversarial-review.md`
- `12-relationship-handoff.md`

Findings:

- The preferred default is now stricter: durable bodies are referenced artifacts, lifecycle/selection/applicability are ChangePulses, and temporary bodies are inline/ref bodies on ChangePulses.
- `DefinitionPulse` should stay provisional rather than a core family member.
- The next Flow / Relationship Graph experiment must test `uses_*`, `enables_*`, `disables_*`, ordering, and scope edges against the full scenario.
