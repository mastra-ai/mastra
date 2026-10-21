---
'@mastra/server': patch
---

Fixed agent-controller stream errors losing the provider's `statusCode`, every provider code and the body `reason` when flattened for the wire, so a live error notice classifies like a reloaded one. Requires @mastra/core 1.80.0 or newer.

If your package manager reports a peer conflict after this release, upgrade @mastra/core first, then this package:

```bash
pnpm add @mastra/core@^1.80.0
pnpm add @mastra/server@latest
```

Before, @mastra/server installed next to @mastra/core 1.79 or older; after, that pairing is refused at install time instead of failing at runtime.
