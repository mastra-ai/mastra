---
'@mastra/core': patch
'@mastra/server': patch
---

Experiment comparison now respects organization and project scoping. `mastra.datasets.compareExperiments` accepts `organizationId` and `projectId`, and the compare route passes them through, so experiments from another tenant are reported as not found.
