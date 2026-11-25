---
'@mastra/core': minor
---

`runKnowledgeImport` takes a new `maxFlushBytes` option: the largest flush request, in bytes of the request encoded as JSON. The runner sends its buffered items before one more item, or a saved cursor, would take the request over it. An item or a saved state too big for a request on its own ends the run with the new `flush_too_large` error code, before anything more is sent.

```ts
await runKnowledgeImport({ importers, host, bindingId, maxFlushBytes: 8 * 1024 * 1024 });
```

Without the option nothing changes: a flush holds up to `bufferSize` items whatever their size. Set it when the host limits request size, so a batch of large items is sent in parts instead of failing the run at the same items each time.
