---
'@mastra/core': minor
---

Added the Harness storage domain under `@mastra/core/storage`.

The new `HarnessStorage` domain stores session records, lease metadata, and
attachments for Harness v1. It is exposed alongside the existing storage
domains through `MastraCompositeStore.stores.harness`, and the in-memory storage
adapter now includes a Harness adapter with optimistic-CAS writes, lease-based
ownership, and attachment cascade delete on session removal.

```ts
const stores = await storage.getStores();
const harnessStore = stores.harness;

await harnessStore.createSession({
  /* session record */
});
```
