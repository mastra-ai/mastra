### 6.3 What tools must not do

The harness slot is intentionally narrow. The following are out-of-contract:

- **Reach into other sessions.** A tool only acts on the session that invoked it. Cross-session orchestration (e.g. fanning out to N sessions for batch work) is the harness consumer's job, not the tool's. There's no `harness` reference on `HarnessRequestContext` for that reason.
- **Touch `MastraStorage` directly.** Storage is the harness's contract with persistence — tools mutate session state through `setState`, write files through `workspace.filesystem`, and emit events through `emitEvent`. Raw storage access bypasses the durable-transition guarantees in §5.7.
- **Mutate permissions.** Tools cannot grant themselves categories, change permission rules, or bypass the approval flow. Permission decisions are user-driven and live on the session.
- **Switch mode or model.** A tool's job is to do work, not to change the session's defaults. If a workflow legitimately needs to change mode (e.g. plan mode → build mode after `submit_plan` approval), that flip happens in the harness's plan-approval handler, not inside `execute`.
- **Synthesize harness-owned event types.** See above.
