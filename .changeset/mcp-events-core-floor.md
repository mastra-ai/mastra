---
'@mastra/mcp': patch
'@mastra/connect': patch
---

`@mastra/mcp` and `@mastra/connect` now require `@mastra/core` 1.79.0 or later. Upgrade `@mastra/core` together with them:

```bash
# Before: @mastra/core 1.78.x with an older @mastra/mcp
npm install @mastra/mcp@latest # peer dependency error

# After
npm install @mastra/core@latest @mastra/mcp@latest @mastra/connect@latest
```
