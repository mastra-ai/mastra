---
'@mastra/core': patch
---

Workflow runs with the experimental `storageVersion` option now keep the version they were stored with: resuming a run after changing the option continues it in that version instead of throwing. A nested workflow's runs now use their parent run's version.
