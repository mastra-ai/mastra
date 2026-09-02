---
'@mastra/core': patch
---

Fix `observe.log()` and `observe.span()` being silent no-ops for agent-invoked tools. The agent tool-call path hardcoded `noopObserve`, so structured logs and child spans emitted from a tool's `execute` via `context.observe` were discarded even when a tracing context was active. `CoreToolBuilder` now derives a real, span-correlated `ToolObserve` from the tool span (the same span that backs `tracing`/`loggerVNext`), falling back to a no-op only when no tracing context is active. This also enables `observe` for workflow- and directly-invoked tools.
