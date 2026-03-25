---
'@mastra/core': patch
---

Fixed tool input validation failures not producing observability spans. When input schema validation failed, no TOOL_CALL span was created because span creation happened inside the execution function that ran after validation. Moved span creation before input validation so validation errors are now captured in spans and visible in observability backends like Datadog.
