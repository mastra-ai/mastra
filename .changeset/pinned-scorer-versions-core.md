---
'@mastra/core': minor
---

Experiments now pin the version of every stored scorer they use (scorers created in Studio or through the editor). Each item is scored by the version that was current when the experiment was created, even if someone edits the scorer while the experiment is running.

The pinned versions are saved on the experiment as `scorerVersions` (scorer id → version id), and each score row saved to the scores store records the `versionId` that produced it in its `scorer` field. Code scorers are not pinned. Experiments created before this change keep using each scorer's current version.

```ts
const { experimentId } = await dataset.createExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  scorers: ['helpfulness'],
});
const experiment = await dataset.getExperiment({ experimentId });
experiment?.scorerVersions; // { helpfulness: '<version id>' }
```
