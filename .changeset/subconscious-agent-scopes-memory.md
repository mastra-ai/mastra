---
'@mastra/memory': patch
---

Subconscious now reads its org from an `org:<id>` agent scope on the run it observes. The `organizationId` request-context key still works when no org scope is set, and an org scope wins if both are present. Runs without an org now skip Subconscious quietly instead of reporting an error, since a run scoped only to a user or thread is valid. A run that holds two different org scopes is reported as an error.

```ts
await agent.stream('Plan the launch', {
  scopes: ['org:acme', 'resource:user-123', 'thread:conversation-123'],
});
```
