---
'@mastra/core': patch
---

Added support for reading resource IDs from `Harness`.

You can now get the default resource ID and list known resource IDs from stored threads.

```ts
const defaultId = harness.getDefaultResourceId();
const knownIds = await harness.getKnownResourceIds();
```
