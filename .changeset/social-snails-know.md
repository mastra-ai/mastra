---
'mastracode': patch
---

Fixed MastraCode to require a configured PubSub when cross-process mode is enabled. Existing cross-process setups that previously passed `crossProcessPubSub: true` without shared signal routing now fail at startup with a clear configuration error.

```ts
createMastraCode({
  pubsub,
  crossProcessPubSub: true,
});
```
