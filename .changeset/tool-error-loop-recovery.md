---
'@mastra/core': patch
---

Fixed durable agent runs continuing past a still-pending human-in-the-loop tool call when another tool in the same turn failed. The durable loop previously forced continuation on any tool error, so a mixed turn (for example, one client-side tool awaiting its result plus one server tool that threw) would send the next model request with a tool call that had no tool result. The durable loop now matches the regular agentic loop: tool errors only force continuation when no tool call is still pending.

Also adds regression coverage for tool-execution-failure recovery (issue #21054): when a tool throws (for example ENOENT / EACCES filesystem errors), the error is serialized into a tool-error result, fed back to the model, and the loop continues so the model can self-correct — across `generate`, `stream`, the durable agent, and AgentController sessions (including the tool-approval resume path and workspace tools).
