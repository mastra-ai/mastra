---
'@mastra/core': patch
---

`LocalSandbox` now publishes its id as `getInfo().metadata.sandboxId` and honors `clone({ sandboxId })` by adopting it as the constructed sandbox's `id`. This lets local sandboxes participate in fleet release/claim pools using the same code path as remote providers (Railway, Platform), where the pooled id round-trips through the provider's own `getInfo`/`clone` contract. Local has no host VM to actually reattach to — the id is a stable logical handle, and `clone` continues to construct a fresh sandbox — but the pool contract is now uniform across providers.
