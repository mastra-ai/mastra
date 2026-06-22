---
'@mastra/core': patch
---

Agents now receive rich text (markdown) from channel messages instead of stripped plain text. Links, bold, italic, code, blockquotes, and other formatting from Slack (and other platforms) are preserved as standard markdown that LLMs understand natively. Previously, a Slack message like 'Check out <https://example.com|Example>' would arrive as 'Check out Example' — the URL was lost. Now it arrives as 'Check out [Example](https://example.com)'.
