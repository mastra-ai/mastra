---
'@mastra/core': patch
'mastracode': patch
---

Added a Unix socket PubSub transport and wired the Mastra Code TUI through a per-resource socket so local sessions can coordinate thread streams across processes. Programmatic `createMastraCode` usage remains opt-in:

```ts
await createMastraCode({ unixSocketPubSub: true });
```
