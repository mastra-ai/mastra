---
'@mastra/core': minor
---

Experiments now pin the version of every stored scorer they use (scorers created in Studio or through the editor). Each item is scored by the version that was current when the experiment was created, even if someone edits the scorer while the experiment is running.

The pinned versions are saved on the experiment as `scorerVersions` (scorer id → version id), and every saved score records the `versionId` that produced it. Code scorers are not pinned. Experiments created before this change keep using each scorer's current version.

```ts
const { experimentId } = await dataset.createExperiment({ scorers: ['helpfulness'] });
const experiment = await dataset.getExperiment({ experimentId });
experiment?.scorerVersions; // { helpfulness: '<version id>' }
```
