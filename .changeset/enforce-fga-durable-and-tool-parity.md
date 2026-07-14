---
'@mastra/core': patch
---

Fixed two fine-grained authorization (FGA) gaps so durable/evented agents and durable tool calls enforce the same checks as the default engine.

**Durable agents now enforce `agents:execute`**

`DurableAgent` (and `EventedAgent`/`InngestAgent`) overrode `stream()`/`generate()` and ran a workflow instead of the base agent path, so the agent-level `agents:execute` check never ran — a model-only durable run triggered no FGA at all. Durable `stream()` and `generate()` now run the same check before execution.

Behavior change: with an FGA provider configured, durable runs that were previously allowed through are now checked and can be denied. `resume()` continues an already-authorized run and is not re-checked.

**Tool execution authorizes one canonical resource id**

Regular tool execution ran an extra check against the bare tool name (`tool:<name>`) in addition to the canonical id used by the tool wrapper, while durable execution only ran the canonical check. This made the two paths authorize different resources for agent and MCP tools. The redundant bare check was removed; tool authorization now uses the wrapper's canonical id (`<agentId>:<toolName>`, the MCP id, or the standalone name) on every path.
