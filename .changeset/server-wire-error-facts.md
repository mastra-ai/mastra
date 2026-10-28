---
'@mastra/server': patch
---

Agent-controller stream errors now carry every provider code and the provider's `reason` sentence, built by the same core function that saves the error to thread history, so a live error and a reloaded one are the same object. Requires @mastra/core 1.80.0 or newer.

If your package manager reports a peer conflict after this release, upgrade @mastra/core first, then this package:

```bash
pnpm add @mastra/core@^1.80.0
pnpm add @mastra/server@latest
```

Before, @mastra/server installed next to @mastra/core 1.79 or older; after, that pairing is refused at install time instead of failing at runtime.
