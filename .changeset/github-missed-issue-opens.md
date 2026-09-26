---
'@mastra/factory': patch
---

New GitHub issues now create Factory work items when events are polled. Open issues filed after a repository was linked are recovered by the issue reconcile sweep when they have no work item. Changes to existing issues re-evaluate their linked work items. Events skipped during polling are logged at debug level.
