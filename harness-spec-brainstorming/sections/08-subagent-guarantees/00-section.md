## 8. Subagent guarantees

- **Depth cap.** `HarnessConfig.sessions.maxSubagentDepth` (default `1`, see
  §9).
  `HarnessRequestContext.subagentDepth` is a derived projection of the persisted
  `parentSessionId` chain (§2.4/§5.6), not an independent counter. Before
  creating a child session, the parent owner computes `attemptedDepth` from that
  chain. The cap governs all descendant creation paths: the built-in `subagent`
  tool, direct local resolution with `parentSessionId`, and the wire
  session-resolve route. It is independent of whether `HarnessConfig.subagents`
  registers the built-in tool catalog or whether that built-in is disabled. When
  the built-in `subagent` tool would exceed the cap, it returns a recoverable
  tool-result failure instead of throwing: `isError: true`,
  `code: 'harness.subagent_depth_exceeded'`, and
  `details: { maxDepth, attemptedDepth }`. That failure settles the parent-side
  `subagent` tool call through the normal `tool_end` path with `isError: true`;
  it does not create a child `SessionRecord`, child thread, workspace, pending
  item, `subagentSessionId`, or `subagent_start` event. Direct local session
  resolution and the wire session-resolve route reject before mutation per §4.5
  and §13.2. Existing descendant sessions that were valid when created remain
  addressable after a later cap decrease, but cannot spawn further descendants
  beyond the current cap.
- **Relationship to Mastra agent delegation primitives.** Mastra core
  provides agent-level delegation surfaces that operate within a single
  turn's tool-calling lifecycle: `DelegationConfig`
  (`packages/core/src/agent/agent.types.ts:260-303`), agent-as-tool
  execution with subagent thread/resource isolation
  (`packages/core/src/agent/agent.ts:3446-3510,3752-3858`),
  `MCPServerBase` agent-as-tool exposure
  (`packages/core/src/mcp/index.ts`), and `agent.network()` multi-agent
  routing (`packages/core/src/agent/agent.ts:5490-5570`). Harness v1
  subagents are durable child `SessionRecord` rows with
  `parentSessionId`, parent-bound lease ownership, independent
  `threadId`, workspace inheritance under the depth cap, independent
  SSE/inbox addressability, and recovery across process restart (§5.6).
  The two surfaces serve different lifecycles — turn-scoped tool
  delegation vs session-scoped durable spawn. A v1 implementation may
  route delegation policy through the subagent depth cap as
  authorization input, but `DelegationConfig` / `agent.network()` /
  agent-as-tool execution must not be presented as v1 subagent
  sessions through `@mastra/core/harness/v1`; they are compatibility
  inputs, not substitutes.
- **Parent linkage.** Storage parentage is the child `SessionRecord.parentSessionId`
  (§5.6). Parent-stream event shape and attribution (`parentId`, `depth`,
  `subagentSessionId`, and root-subagent handling) are owned by §10.2/§10.6.
- **State isolation.** Subagent sessions have their own `permissions`,
  `task_write` list, `submit_plan` state, and approval queue. Parent state is
  untouched; built-in tool calling-session behavior is owned by §6.4. A
  spawned child or forked child receives only the tool surface delegated by the
  parent/subagent configuration, then §4.2's pre-exposure and pre-action gates
  run against the owning child session. Parent rules, grants, or `yolo` cap what
  the parent may delegate only when the parent gate removes the spawning or
  forwarded tool; they are not inherited action authority for the child.
- **Workspace inheritance.** Subagents inherit the spawning parent session's
  resolved workspace by default — they typically cooperate on the same
  code/files as the parent. Subagent tool config can opt into a fresh workspace
  via `{ workspace: 'fresh' }` (only valid when the harness is configured with
  `kind: 'per-session'`). Fresh subagent workspaces are torn down on subagent
  session close. See §2.7.

---
