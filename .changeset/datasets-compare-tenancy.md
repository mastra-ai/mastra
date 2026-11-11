---
'@mastra/core': patch
'@mastra/server': patch
---

Experiment comparison now respects organization and project scoping. `mastra.datasets.compareExperiments` accepts `organizationId` and `projectId`, and the compare route passes them through, so experiments from another tenant are reported as not found.

```ts
const comparison = await mastra.datasets.compareExperiments({
  experimentIds: ['exp-baseline', 'exp-candidate'],
  organizationId: 'org_123',
  projectId: 'proj_456',
});
```

A scoped compare against an older `@mastra/core` that ignores those arguments is rejected. Comparisons that omit organization and project are unchanged.
