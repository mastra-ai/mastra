---
'@mastra/playground-ui': patch
---

Search trace spans on their whole payload instead of six hardcoded fields

Searching a trace timeline only looked at `name`, `spanType`, `entityName`, `inputPreview`, `traceId` and `spanId`, so a span was unreachable by anything stored in its open-ended `metadata` — a tool argument, a model name, an error message. Each span now carries a `searchText` haystack, flattened once when the trace resolves rather than rebuilt on every keystroke, and the filter matches against it. Nested values and their keys are both included, so a payload's shape is searchable too.
