## 8. Subagent guarantees

- **Depth cap.** `HarnessConfig.subagents.maxDepth` (default `1`, see §9). Tracked in `HarnessRequestContext.subagentDepth`. Overflow returns a tool-result error (recoverable, not thrown).
- **Parent linkage.** All `subagent_*` events carry `parentId?: string` (the parent's tool-call ID) and `depth: number`. Root subagents have `parentId = undefined`, `depth = 1`.
- **State isolation.** Subagent sessions have their own `permissions`, `task_write` list, `submit_plan` state, and approval queue. Parent state is untouched.
- **Workspace inheritance.** Subagents inherit the parent session's workspace by default — they typically cooperate on the same code/files as the parent. Subagent tool config can opt into a fresh workspace via `{ workspace: 'fresh' }` (only valid when the harness is configured with `kind: 'per-session'`). Fresh subagent workspaces are torn down on subagent session close. See §2.7.

---
