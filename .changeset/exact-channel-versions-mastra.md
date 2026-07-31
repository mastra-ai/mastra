---
'mastra': patch
---

`mastra create` now pins every Mastra dependency in generated default and empty projects to the exact version published on the invoked release channel instead of writing the channel tag (for example `alpha`) verbatim. If the CLI cannot resolve exact versions, it warns and falls back to the channel tag.
