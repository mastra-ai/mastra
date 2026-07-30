---
'create-mastra': patch
---

Generated projects now pin every Mastra dependency to the exact version published on the invoked release channel instead of writing the channel tag (for example `alpha`) verbatim. If the CLI cannot resolve exact versions, it warns and falls back to the channel tag.
