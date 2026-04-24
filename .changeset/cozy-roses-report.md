---
'@mastra/core': patch
---

Fixed output processors returning `undefined` from `processOutputStream` causing an `undefined` chunk to be enqueued into the consumer stream. A processor that forgets to `return part` (or explicitly returns `undefined`) now drops that chunk, matching existing `null` behavior, instead of emitting a bogus value to downstream readers.

```ts
// Before: returning undefined emitted { value: undefined, done: false } to consumers
// After:  returning undefined drops the chunk, same as returning null
const processor = {
  id: 'my-processor',
  processOutputStream: async ({ part }) => {
    if (shouldDrop(part)) return; // implicit undefined — now safely dropped
    return part;
  },
};
```
