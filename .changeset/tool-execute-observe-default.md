---
'@mastra/core': patch
---

Fixed `context.observe` being undefined when a tool is called directly with `tool.execute(input, { requestContext })` or run as a workflow step via `createStep(tool)`. Tools that call `observe.log(...)` or `observe.span(...)` no longer crash on these paths. `observe` falls back to a no-op when no tracing span is active. Callers of `tool.execute()` can now leave `observe` out without a type error.
