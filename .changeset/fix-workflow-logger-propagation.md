---
"@mastra/core": patch
---

fix(workflows): propagate logger to executionEngine

When a custom logger is set on a Workflow via `__registerPrimitives` or `__setLogger`, it is now correctly propagated to the internal `executionEngine`. This ensures workflow step execution errors are logged through the custom logger instead of the default ConsoleLogger, enabling proper observability integration.
