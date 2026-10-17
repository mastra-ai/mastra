---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Raised the `@mastra/core` peer dependency floor to 1.78.0. The Knowledge storage adapters now use a source-probe limit helper that first ships in `@mastra/core` 1.78, so with an older core they fail when imported instead of at install time. Upgrade `@mastra/core` to 1.78.0 or newer.
