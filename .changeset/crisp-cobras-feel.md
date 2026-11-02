---
'@mastra/factory': patch
'@mastra/core': patch
'mastra': patch
---

Factory agents in Slack threads can now read files people upload, such as CSV exports, with the `read_attachment` tool. Files are downloaded from Slack on demand and never saved to the sandbox.
