---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed the `SpanOutputProcessor` contract. The `process()` hook must mutate the span it receives and return that same instance (or `undefined` to drop it), because only the live span can be exported. `SensitiveDataFilter` already did this while its docstring promised "a new span", and the interface never said either way, so a custom processor returning `{ ...span, input: redacted }` made `startSpan()` throw `exportSpan is not a function` or silently dropped every ended span. The interface and docs now state the contract, and a processor that returns a copy is logged as a processor error while the span is dropped instead of exported unredacted.

**Before**

```ts
process(span) {
  return { ...span, input: '[REDACTED]' }; // throws in startSpan, or nothing is ever exported
}
```

**After**

```ts
process(span) {
  span.input = '[REDACTED]';
  return span;
}
```
