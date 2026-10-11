---
'@mastra/core': patch
---

Disabled workspace tools are no longer constructed on every agent turn. Previously, an agent with `tools: { enabled: false }` (or individual tools disabled) still built the grep tool and its schema, probed for `@ast-grep/napi`, rebuilt the search schema, and created a write lock and read tracker each turn before discarding them. Tools are now built only after their configuration says they are enabled, and a workspace with all tools statically disabled returns immediately. Fixes #26401.
