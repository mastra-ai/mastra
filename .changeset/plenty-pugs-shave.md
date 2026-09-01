---
'@mastra/core': patch
---

Only advertise background execution for tools that can actually reach the background.

With a background-task manager configured, the `_background` override was spliced into every
tool's input schema and every tool was listed in the background-task system prompt, keyed off
the Mastra-level `backgroundTasks.enabled` flag. That flag only says the subsystem is
available. Since #16792, `resolveBackgroundConfig` treats `_background` as a modifier on a
prior tool- or agent-level opt-in, so for any other tool every field of `_background` is a
no-op — the schema and the prompt were advertising a capability the resolver refuses to honor.

The system prompt also re-implemented the agent-level lookup inline, without the `agent-` /
`workflow-` prefix normalization `resolveAgentToolConfig` performs and without preserving the
"not configured" state, so it reported `default: foreground` for sub-agent and workflow tools
that _were_ opted in, and ignored tool-level `background: { enabled: true }` entirely. It also
read tool-level config from `tool.background`, while converted tools expose `backgroundConfig`.

Both paths now go through `resolveBackgroundConfig`, the same resolver the runtime dispatch
uses, so the injected schema, the system prompt, and the actual dispatch decision always agree.
`backgroundTaskEnabled` additionally accepts a per-tool predicate; the boolean form still works.
