---
'@mastra/factory': minor
---

Factory takes an optional `coAuthor` for the commit co-author its agent sessions write. Omitted, nothing changes and sessions keep the Mastra platform bot identity; pass `{ name, email }` to credit your own bot instead. A field left out falls back to the default for that field.
