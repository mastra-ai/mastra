---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/deployer': patch
'@mastra/inngest': patch
'@mastra/server': patch
'@mastra/core': patch
---

Remove `waitForEvent` from workflows. `waitForEvent` is now removed, please use suspend & resume flow instead. See https://mastra.ai/en/docs/workflows/suspend-and-resume for more details on suspend & resume flow.
