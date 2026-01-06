---
'@mastra/inngest': patch
'@mastra/core': patch
---

- Fix tool suspension throwing error when `outputSchema` is passed to tool during creation
- Pass `suspendSchema` and `resumeSchema` from tool into step created when creating step from tool
