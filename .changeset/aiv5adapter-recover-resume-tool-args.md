---
'@mastra/core': patch
---

Fixed agents losing tool call arguments after resuming a suspended run. Previously, when `agent.resumeStream(...)` (or any flow that delivers a tool result in a separate model message from its tool call) ran, the persisted tool result row stored `args: {}` instead of the original arguments. After 3-4 such cycles the model would in-context-learn the empty pattern and start emitting empty-args tool calls itself, breaking every subsequent invocation with `Required: <field>` validation errors.

The agent now recovers the original tool call arguments from earlier persisted messages when a tool result arrives stand-alone, so resumed runs and human-in-the-loop flows preserve their full call history end-to-end.

Fixes #16017.
