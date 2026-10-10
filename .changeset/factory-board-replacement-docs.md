---
'@mastra/factory': patch
---

Fixed Factory README lines that still said the built-in Work and Review boards cannot be replaced or customized. Disabling the default boards and installing a board with the same ID is supported, and a replacement `work` board can declare its own `tools.submit_plan.onResult` rule.
