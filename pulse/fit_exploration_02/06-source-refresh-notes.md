# Source Refresh Notes

This records source findings from the rebased tree that are relevant to `fit_exploration_02`.

## Package Instructions

`packages/core/AGENTS.md` was read before inspecting `packages/core`.

No package-local `AGENTS.md` was found for `packages/editor` or `packages/agent-builder`.

## Relevant Packages

Observed packages/surfaces:

- `packages/core/src`: runtime agent, memory, channels, loop/network, telemetry, storage types.
- `packages/core/agent-builder/ee.d.ts`: public Agent Builder EE type surface.
- `packages/agent-builder/src`: Agent Builder package source.
- `packages/editor/src`: stored config namespaces and Agent Builder integration.

## Agent Builder / Agent CMS-Like Surface

Relevant files observed:

- `packages/editor/src/index.ts`
- `packages/editor/src/ee/agent-builder.ts`
- `packages/editor/src/ee/agent-builder-agent.ts`
- `packages/editor/src/namespaces/agent.ts`
- `packages/editor/src/namespaces/base.ts`
- `packages/editor/src/namespaces/workspace.ts`
- `packages/editor/src/namespaces/scorer.ts`
- `packages/editor/src/namespaces/skill.ts`
- `packages/editor/src/namespaces/mcp.ts`
- `packages/editor/src/namespaces/mcp-server.ts`
- `packages/editor/src/namespaces/prompt.ts`

`packages/editor/src/namespaces/agent.ts` is the clearest source for Agent CMS-style config events. It handles stored agent creation, builder defaults, stored overrides for code-defined agents, instruction overrides, tool selection, tool description overrides, model config, memory, workspace, browser, processors, scorers, workflows, agents, MCP clients, integration tools, and tool providers.

## Runtime Thread Context

Source searches found widespread `threadId` and `resourceId` usage in:

- `packages/core/src/memory/memory.ts`
- `packages/core/src/agent`
- `packages/core/src/loop/network`
- `packages/core/src/channels`
- request context helpers in internal core packages

Current impression: `threadId` and `resourceId` are context identifiers, not explicit ordering edges between flows.

## Tool Call And Channel Streaming Context

Relevant files observed:

- `packages/core/src/channels/stream-helpers.ts`
- `packages/core/src/channels/chat-driver-streaming.ts`
- `packages/core/src/channels/chat-driver-static.ts`

The channel helpers track tool calls by `toolCallId` and retain `toolName`, `args`, `result`, and `error` context for user-facing channel messages.

This maps well to Pulse call Pulses:

- `tool.execute_started`
- `tool.approval_requested`
- `tool.execute_completed`
- `tool.execute_failed`

It also supports the argument that tool definitions should be captured separately from per-call runtime payload.

## Current Gap For This Exploration

Resolved during this pass:

- Stored agent config is versioned. `StorageAgentType` is a thin record, while `StorageAgentSnapshotType` contains the actual agent config. `AgentVersion` carries snapshot fields plus `versionNumber`, `changedFields`, and `changeMessage`.
- `InMemoryAgentsStorage.create` creates an initial version with `changedFields: Object.keys(snapshotConfig)` and `changeMessage: 'Initial version'`.
- `EditorAgentNamespace.applyStoredOverrides` can apply stored instructions/tool overrides to code-defined agents at runtime and preserves `resolvedVersionId` in raw config.
- `CoreToolBuilder` already has access to the definition fields Pulse wants to capture once: description, processed input schema, processed output schema, approval settings, suspend support, provider options, MCP metadata, examples, and background config.
- Current tool spans duplicate `toolDescription` per call and include tool type/MCP server metadata.
- Current model streaming observability already has `MODEL_STEP` and `MODEL_CHUNK`; loop and durable LLM execution wrap streams with a model span tracker.
- No explicit flow-to-flow thread order field was found. `threadId` and `resourceId` are propagated as context, but sequence is inferred rather than linked.

Still not fully explored:

- exact Agent Builder UI/server handlers that call editor namespace create/update APIs
- exact publish endpoint behavior for stored agents
- branch/regeneration semantics for threaded conversations
- whether definitions should be separate records or Pulse records
