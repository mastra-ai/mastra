---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
---

Fixed schema form to apply changes only on Save click instead of every keystroke. Removed AgentPromptExperimentProvider in favor of inline prompt rendering. Switched hooks to use merged request context for proper request-scoped data fetching.
