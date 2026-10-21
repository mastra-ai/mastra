---
'@mastra/memory': patch
---

Fixed observational memory's context-overflow detection to read the shared provider-error classifier from `@mastra/core/error`, so a provider wording added there is recognized by observational memory without a memory release. The set of recognized overflow wordings is unchanged. Requires @mastra/core 1.80.0 or newer.

If your package manager reports a peer conflict after this release, upgrade @mastra/core first, then this package:

```bash
pnpm add @mastra/core@^1.80.0
pnpm add @mastra/memory@latest
```

Before, @mastra/memory installed next to @mastra/core 1.79 or older; after, that pairing is refused at install time instead of failing at runtime.
