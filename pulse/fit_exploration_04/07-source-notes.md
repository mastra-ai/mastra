# Source Notes

## Agent Versioned Config

Files read:

- `packages/core/src/storage/types.ts`
- `packages/core/src/storage/domains/agents/base.ts`
- `packages/core/src/storage/domains/versioned.ts`
- `packages/core/src/storage/domains/agents/inmemory.test.ts`

Notes:

- `StorageAgentSnapshotType` contains runtime-affecting config fields: `instructions`, `model`, `tools`, `defaultOptions`, `workflows`, `agents`, `integrationTools`, `toolProviders`, `inputProcessors`, `outputProcessors`, `memory`, `scorers`, `mcpClients`, `workspace`, `browser`, `skills`, `skillsFormat`, and `requestContextSchema`.
- `AgentVersion` extends the snapshot with version metadata: `id`, `agentId`, `versionNumber`, `changedFields`, `changeMessage`, and `createdAt`.
- Resolved entities merge thin agent records with a version snapshot and add `resolvedVersionId`.
- Tests confirm `requestContextSchema` persists through create/createVersion, and that plain `update()` does not create versions for config fields. This supports "emit at handler/product boundary, not storage adapter."

Implication:

- Agent config versions are definition bundles. They should be referenced by runtime Pulses, but version creation/publish/activation should be ChangePulses.

## Agent Runtime Resolution

Files read:

- `packages/core/src/agent/agent.ts`

Notes:

- `getInstructions()` resolves static or function-based instructions with `requestContext`.
- `listTools()` resolves static or function-based tools with `requestContext`.
- `getToolsForExecution()` merges default options with call options, then assembles assigned tools, memory tools, toolsets, client tools, agent tools, workflow tools, workspace tools, skill tools, browser tools, and input-processor-loaded tools.
- `prepareModels()` resolves model config, fallback entries, dynamic `modelSettings`, `providerOptions`, and headers per request context.
- execution merges version overrides from Mastra defaults, request context, and call-site options.
- call-site `options.instructions`, `options.model`, `options.toolsets`, and `options.modelSettings` can introduce scoped definitions.

Implication:

- Runtime definitions may be scoped to call, step, run, or request. They cannot all be modeled as durable config versions.

## Tool Definitions

Files read:

- `packages/core/src/tools/tool.ts`
- `packages/core/src/tools/types.ts`
- `packages/core/src/tools/tool-builder/builder.ts`
- `packages/core/src/tools/validation.ts`
- `packages/core/src/integration/openapi-toolset.ts`

Notes:

- `Tool` stores id, description, input schema, output schema, suspend schema, resume schema, request context schema, execute function, approval policy, strict mode, provider options, transform hooks, examples, MCP metadata, background config, and stream callbacks.
- Tool constructor converts input/output/suspend/resume schemas to Standard Schema.
- Runtime execution validates tool input, output, suspend data, and request context.
- `CoreToolBuilder` applies provider compatibility layers and can create model-facing schemas that differ from author schemas.
- `OpenAPIToolset` generates tools from method names, schemas, and documentation.

Implication:

- Tool definitions are strong referenced artifacts.
- Schema definitions may need their own ids when author schema and provider-facing schema diverge.
- Generated tools are a good temporary definition candidate, usually represented as a ChangePulse selecting an inline or referenced definition body.

## Temporary Tool Scope

Files read:

- `packages/core/src/processors/runner.ts`
- `packages/core/src/processors/process-input-step.test.ts`
- `packages/core/src/agent/__tests__/active-tools-enforcement.test.ts`

Notes:

- Processors can return `activeTools`, `tools`, `toolChoice`, `model`, and message changes for a step.
- Tests show active tools can be narrowed from `['tool1', 'tool2', 'tool3']` to `['tool1', 'tool2']` and then `['tool1']` through processor chaining.
- Active tool enforcement rejects tool calls outside the current active set.

Implication:

- Tool-set changes are not only durable config. They can be temporary step-scoped changes.
- The same tool-set body can be permanent within a run or temporary for one step depending on applicability scope.
