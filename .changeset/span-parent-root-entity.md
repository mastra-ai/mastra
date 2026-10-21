---
'@mastra/core': patch
'@mastra/observability': patch
---

Spans now record which entity owns them. Each exported span carries `parentEntityType/Id/Name/VersionId` (the entity of the nearest exported parent span) and `rootEntityType/Id/Name/VersionId` (the entity of the trace's root span). Span storage writes these fields, so `querySpans()` and span aggregates can filter and group by them, for example to count tool calls per agent. Previously these columns were always empty for spans recorded by the SDK. Spans stored before this change keep empty values.
