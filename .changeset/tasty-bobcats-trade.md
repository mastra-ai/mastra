---
'@mastra/factory': minor
---

Removed the per-project `reviewTestChecksEnabled` setting. `source_control_publish_test_check` now publishes whenever a review skill calls it, so the review skill decides whether a change request gets a `Factory Review / tests` check. The tool still refuses a head that is not the change request's current head, and still reports a provider that cannot publish commit checks.

`FactoryProject` no longer has the field, and `FactoryProjectsStorage.update` no longer accepts it. `PATCH /web/factory/projects/:id` still accepts it for one more release and ignores it.

**Before**

```ts
await projects.update({ orgId, id, input: { autoRunEnabled: true, reviewTestChecksEnabled: true } });
if (project.reviewTestChecksEnabled) {
  // ...
}
```

**After**

Drop the field, and drop the call when it set nothing else. To stop or start publishing checks, change the review skill: it publishes when it calls `source_control_publish_test_check`.

```ts
await projects.update({ orgId, id, input: { autoRunEnabled: true } });
```
