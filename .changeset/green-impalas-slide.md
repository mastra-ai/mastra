---
'@mastra/core': patch
---

Fixed sub-agent memory isolation when threadId and resourceId are set via requestContext reserved keys (`mastra__threadId`, `mastra__resourceId`). Previously, these values leaked from the parent agent's requestContext into sub-agent calls, causing sub-agents to write messages to the parent's thread instead of their own isolated thread. The reserved keys are now saved and cleared before sub-agent execution, and restored afterward.
