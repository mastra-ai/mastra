---
"@mastra/server": patch
---

Fix crash on every request when deployed with @mastra/core < 1.42.0. The server now gracefully falls back to server-only auth instead of throwing `TypeError: this.mastra.getStudio is not a function`.
