---
'@mastra/core': patch
---

Reduced default max output tokens from 3000 to 2000 for all workspace tools. List files tool uses a 1000 token limit. Suppressed "No errors or warnings" LSP diagnostic message when there are no issues.
