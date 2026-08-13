---
'@mastra/playground-ui': patch
---

Improved chat responsiveness on long conversations. `MarkdownRenderer` is memoized, so a streaming reply no longer re-parses the markdown of every message already on screen on each chunk it receives — only the message actually being written is re-parsed.
