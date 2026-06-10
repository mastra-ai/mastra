---
'@mastra/playground-ui': patch
---

Fixed the Agent and Workflow icon not appearing in the Traces and Logs entity column. The icon now matches the stored lowercase entity types (`agent`, `workflow_run`) instead of only uppercase values, so you can tell agent runs from workflow runs at a glance.
