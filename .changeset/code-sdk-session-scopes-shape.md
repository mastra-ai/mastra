---
'@mastra/code-sdk': minor
---

Added org-only host scopes for Factory sessions. When `scopes` name an `org:`, Factory sessions act with those scopes alone instead of adding their own `org:` and `project:` scopes, so they work against a Knowledge instance that declares only that org:

```ts
resolveKnowledgeSessionScopes({ factoryOrgId: 'fac', factoryProjectId: 'p1' }, ['org:acme']);
// { resolved: true, scopes: ['org:acme'] }
```

A Factory session refuses a host `resource:` or `thread:` scope, and a `project:` scope beside a host `org:`. An unresolved Factory session acts with only its run's own identity, without the host's `resource:` or `thread:` tags. `knowledgeUnresolvedScopes` is deprecated and no longer used. `resolveKnowledgeSessionScopes` accepts any object with the Factory org and project fields.
