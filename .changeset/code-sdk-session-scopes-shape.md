---
'@mastra/code-sdk': minor
---

When `scopes` name an `org:`, Factory sessions act with those scopes alone instead of adding their own `org:` and `project:` scopes, so they work against a Knowledge instance that declares only that org. A `project:`, `resource:` or `thread:` scope beside it is refused. `resolveKnowledgeSessionScopes` accepts any object with the Factory org and project fields.
