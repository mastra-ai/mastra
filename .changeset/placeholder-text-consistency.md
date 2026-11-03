---
'@mastra/playground-ui': patch
'mastra': patch
'@mastra/factory': patch
---

Placeholders in Studio and Factory now read the same everywhere: sentence case with no trailing ellipsis ("Search agents", "Filter traces"). Added a `playground-ui/placeholder-text` lint rule to `@mastra/playground-ui/oxlint` that keeps placeholders this way; it is part of the `recommended` preset.
