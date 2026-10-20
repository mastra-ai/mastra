---
'mastra': patch
---

Fixed the `mastra` CLI build with `@clack/prompts` 1.8.1. Its `isCancel` now narrows to the prompt cancel symbol instead of any symbol, so the CLI's prompt helpers now name that cancel symbol in their types.
