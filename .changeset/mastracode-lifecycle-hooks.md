---
'mastracode': minor
---

Added lifecycle hook events and a per-run `run_id` field so external orchestrators can track agent lifecycle states directly instead of inferring them from coarse prompt, tool, and stop signals.

**New events:** AgentStart, AgentEnd, PermissionRequest, PermissionResult, Interrupt, SubagentStart, and SubagentEnd. All new lifecycle events are non-blocking. Existing blocking events, including PreToolUse, Stop, and UserPromptSubmit, keep their current behavior.

Every hook stdin now includes a `run_id` during an active run. Permission decisions and interrupts only emit while a run is active, so consumers can reliably correlate them with the run that produced them.

PostToolUse continues to fire from the agent tool hook wrapper after a tool call completes. It is not emitted from the TUI lifecycle dispatcher.

**Why**

External orchestrators needed first-class signals for permission gates, interrupts, and subagent delegation. The previous hook surface only offered coarse prompt, tool, and stop events, forcing integrators to guess at lifecycle state.

```json
{
  "hooks": {
    "AgentStart": [{ "type": "command", "command": "echo started >> /tmp/lifecycle.log" }],
    "AgentEnd": [{ "type": "command", "command": "echo ended >> /tmp/lifecycle.log" }],
    "Interrupt": [{ "type": "command", "command": "echo interrupted >> /tmp/lifecycle.log" }]
  }
}
```

AgentStart stdin includes the shared `run_id`:

```json
{ "hook_event_name": "AgentStart", "run_id": "a1b2c3d4", "session_id": "...", "cwd": "/path/to/project" }
```
