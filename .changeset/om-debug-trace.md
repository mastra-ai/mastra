---
'@mastra/memory': patch
---

Added env-gated debug-trace child spans around three hot-path Observational Memory internals: `step.prepare`, `getStatus`, and `getOrCreateRecord`. Off by default. Set `MASTRA_OM_DEBUG_TRACE=1` to opt in.

When unset the wrapper is a direct passthrough with no span construction overhead. When set, the wrappers emit child spans of the current OM `om.observer` / `om.reflector` span (or whatever current span is in `AsyncLocalStorage`), so bisecting a slow agentic-loop step from OM internals only requires flipping the env var and looking at the trace tree.
