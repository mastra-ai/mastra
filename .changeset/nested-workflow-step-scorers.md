---
'@mastra/core': patch
---

Fixed step scorers in nested workflows so their scores are saved. Before, scores from steps inside a child workflow were silently dropped.
