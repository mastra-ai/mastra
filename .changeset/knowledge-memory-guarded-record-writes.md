---
'@mastra/memory': patch
---

Subconscious Knowledge tools now create, append, pin and rescope records through the configured Knowledge instance, so those writes get the same placement check as other Knowledge writes. Without a Knowledge instance they still write to storage directly.
