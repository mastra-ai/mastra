---
'@mastra/weaviate': patch
---

Raise the `@mastra/core` peer dependency floor to `1.68.0`. Every published version of this store has shipped alongside core 1.68, but the previous `>=1.0.0-0` range advertised compatibility with 68 earlier core releases that were never tested, so a package manager installed those pairings without a peer warning.

If your package manager reports a `@mastra/weaviate` peer conflict, upgrade `@mastra/core` to `1.68.0` or newer.
