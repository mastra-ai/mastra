---
'@mastra/core': patch
---

Disable `savePerStep` in Harness to prevent duplicate messages when observational memory is enabled

The `savePerStep` option in Harness caused message duplication when used alongside observational memory. This change temporarily disables `savePerStep` in the Harness runtime while we work on a permanent fix.
