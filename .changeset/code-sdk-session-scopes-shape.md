---
'@mastra/code-sdk': minor
---

Added `knowledgeOrgScope`: a fixed `org:` scope Factory sessions act as instead of their own `org:` and `project:` scopes. `resolveKnowledgeSessionScopes` takes it as a third argument and accepts any object with the Factory org and project fields.
