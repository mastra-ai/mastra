---
'@mastra/core': minor
---

Harness v1 — `spawn_subagent` built-in tool + subagent registry.

- New `HarnessConfig.subagents` config (`{ maxDepth?, types }`) declares
  the named subagent types a session can spawn. Each `SubagentDefinition`
  carries `{ agentId, modeId?, description, defaultModelId?, tools?,
  workspace }`. `agentId` and `modeId` are validated against the harness
  config at construction (throws `HarnessConfigError` otherwise).
- New `subagentDepth` field threaded through `SessionRecord`,
  `SessionResolveOptions`, and `Session` so child sessions know their
  position in the subagent tree (parent + 1).
- New built-in `spawn_subagent` tool, auto-registered on every session
  when `subagents.types` is non-empty. Calling it:
  - validates `agentType` against the registry,
  - enforces the depth cap (`HarnessSubagentDepthExceededError`),
  - creates a fresh subagent-tool child session (`origin: 'subagent-tool'`,
    `parentSessionId` wired, `subagentDepth` stamped),
  - bridges the child's `agent_start` / `message_update` / `tool_start` /
    `tool_end` events into the parent's subscriber stream as the
    `subagent_*` shapes from §10.6 (`parentId`, `depth`,
    `subagentSessionId`, `agentType` all stamped),
  - tracks the child in `getDisplayState().activeSubagents` while running,
  - closes the child + drops the tracking entry once the tool returns.
- `HarnessSubagentDepthExceededError` exported alongside the other
  Harness v1 error types.

Internal-only API; no breaking changes.
