---
'@mastra/core': minor
'@mastra/playground-ui': patch
---

Thread history now shows the user's first message as the conversation title instead of showing only a timestamp. When `generateTitle` is not configured, the agent automatically saves the first user message as the thread title (truncated to 100 characters). If `generateTitle` is configured, the LLM-generated title continues to take priority.
