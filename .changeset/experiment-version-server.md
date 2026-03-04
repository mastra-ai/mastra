---
'@mastra/server': patch
---

The trigger experiment endpoint now accepts an optional `targetVersionId` parameter to pin agent experiments to a specific version snapshot.

**Before**

```ts
// POST /datasets/:datasetId/experiments
{
  "targetType": "agent",
  "targetId": "my-agent",
  "scorerIds": ["accuracy"]
}
```

**After**

```ts
// POST /datasets/:datasetId/experiments
{
  "targetType": "agent",
  "targetId": "my-agent",
  "targetVersionId": "version-uuid-123",
  "scorerIds": ["accuracy"]
}
```
