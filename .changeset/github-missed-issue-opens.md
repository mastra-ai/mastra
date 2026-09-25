---
'@mastra/factory': patch
---

Fixed new GitHub issues silently never becoming work items. Issues opened, reopened, edited, or relabeled now reach the Factory rules when events are polled, and the issue reconcile sweep now creates cards for open issues filed after the repository was linked that have no card yet. Events the poller skips are logged at debug level.
