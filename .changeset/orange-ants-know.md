---
'@mastra/core': patch
---

Fixed listConfiguredInputProcessors() and listConfiguredOutputProcessors() returning a combined workflow instead of individual processors. Previously, these methods wrapped all configured processors into a single committed workflow, making it impossible to inspect or look up processors by ID. Now they return the raw flat array of configured processors as intended.
