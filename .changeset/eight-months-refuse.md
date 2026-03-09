---
'@mastra/core': patch
---

Output processors can now inspect, modify, or block custom `data-*` chunks emitted by tools via `writer.custom()` during streaming. Processors must opt in by setting `processDataParts = true` to receive these chunks in `processOutputStream`.

```ts
class MyDataProcessor extends Processor {
  processDataParts = true;

  processOutputStream(part, { abort }) {
    if (part.type === 'data-sensitive') {
      abort('Blocked sensitive data');
    }
    return part;
  }
}
```
