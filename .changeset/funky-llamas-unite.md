---
'@mastra/core': patch
---

Fixed type error when a tool calls `suspend(...)` inside `execute` while also declaring an `outputSchema`. The `execute` return type now allows `void` in addition to the declared output shape, so the idiomatic `return await suspend(...)` pattern type-checks correctly.
