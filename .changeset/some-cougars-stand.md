---
'@mastra/core': patch
---

Fix generateTitle for pre-created threads

- Title generation now works automatically for pre-created threads (via client SDK)
- When `generateTitle: true` is configured, titles are generated on the first user message
- Detection is based on message history: if no existing user messages in memory, it's the first message
- No metadata flags required - works seamlessly with optimistic UI patterns

Fixes #11757
