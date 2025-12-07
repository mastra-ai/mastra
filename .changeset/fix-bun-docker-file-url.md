---
'@mastra/deployer': patch
---

Fix Docker build failure with Bun due to invalid file:// URL

The dynamic import was using `file:${path}` which creates invalid URLs like `file:/app/...`. Bun correctly rejects these while Node.js was lenient.

```typescript
// before
import(`file:${configPath}`)

// after
import(pathToFileURL(configPath).href)
```
