---
'@mastra/playground-ui': patch
---

Show completion result UI for supervisor pattern delegations. Previously, completion check results were only displayed when `metadata.mode === 'network'`. Now they display for any response that includes `completionResult` metadata, supporting the new supervisor pattern.
