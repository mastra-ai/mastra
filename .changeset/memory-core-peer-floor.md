---
'@mastra/memory': patch
---

Raised the `@mastra/core` peer dependency floor to `1.78.0`. Knowledge in `@mastra/memory` uses helpers that first ship in `@mastra/core` 1.78, so with an older core `@mastra/memory` fails as soon as it is imported. The old `>=1.4.1` range let package managers install those pairings without a peer warning.

If your package manager reports a `@mastra/memory` peer conflict, upgrade `@mastra/core` to `1.78.0` or newer.
