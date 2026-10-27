---
'@mastra/memory': patch
'@mastra/agent-builder': patch
'@mastra/editor': patch
---

Observational memory now detects context-overflow errors with the shared provider error reader from @mastra/core, so it recovers from the same overflow shapes the rest of Mastra recognizes, including overflow named only in a provider's response body or stream error frame. These packages now require @mastra/core 1.80.0 or newer.

If your package manager reports a peer conflict after this release, upgrade @mastra/core first, then the package:

```bash
pnpm add @mastra/core@^1.80.0
pnpm add @mastra/memory@latest
```

Before, a project could pair @mastra/memory with @mastra/core 1.78 and install cleanly; after, that pairing is refused at install time instead of failing at runtime.
