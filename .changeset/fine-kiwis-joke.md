---
'@mastra/core': patch
---

Fixed workflow step errors not being propagated to the configured Mastra logger. The execution engine now properly propagates the Mastra logger through the inheritance chain, and the evented step executor logs errors with structured MastraError context (matching the default engine behavior). Closes #12793
