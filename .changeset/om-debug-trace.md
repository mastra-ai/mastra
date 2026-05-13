---
'@mastra/memory': patch
---

Added opt-in debug tracing for Observational Memory's hot-path internals, useful for bisecting slow agentic-loop steps from the trace tree.

Off by default. Set `MASTRA_OM_DEBUG_TRACE=1` (or `true`) to opt in. When the env var is unset, behavior is unchanged — the wrapper is a direct passthrough with no span construction overhead.

```bash
# Show which OM internal (per-step prepare, turn-end flush, record
# lookup, status check) is paying the cost in your agent's trace.
MASTRA_OM_DEBUG_TRACE=1 pnpm start
```

The new spans nest under the existing `om.observer` / `om.reflector` spans (or whatever current span is in scope), so the trace tree resolves which Observational Memory call is responsible without further code changes.
