---
'@mastra/react': patch
---

Handle `reasoning-start` and `reasoning-end` agent stream chunks in `toUIMessage`. A `reasoning-start` chunk now opens an empty streaming `reasoning` part carrying any `providerMetadata` from the payload, and `reasoning-end` flips the matching streaming reasoning part to `state: 'done'`, merging provider metadata from the end payload.
