---
'@mastra/core': patch
---

Honor the configured logger and error strategy when structured output uses a separate model. Handled validation failures now warn through the agent logger or return the configured fallback without misleading error-level console logs. Preserve fallback metadata on structured output results.
