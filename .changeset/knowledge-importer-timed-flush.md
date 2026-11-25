---
'@mastra/core': patch
---

Knowledge importers now send waiting items once the oldest has waited 30 seconds, instead of holding them until 200 items are queued, the cursor is saved or `import` returns. Items from a slow source show up in Knowledge during the run. A timed batch carries only items; the cursor still moves only with `ctx.state.set()`. Change the interval with the `flushAfterMs` option of `runKnowledgeImport`.

```ts
await runKnowledgeImport({
  importers: [LinearImporter],
  host,
  bindingId: 'linear',
  flushAfterMs: 10_000, // send waiting items after 10 seconds instead of 30
})
```

If the host can't take a batch, the run fails there and no later `ctx.state.set()` saves a cursor past it, however the batch was sent.
