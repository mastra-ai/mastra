---
'@mastra/rag': minor
---

Renamed `keepSeparator` parameter to `separatorPosition` with a cleaner type.

The `keepSeparator` parameter had a confusing `boolean | 'start' | 'end'` type where `true` was secretly an alias for `'start'`. The new `separatorPosition` parameter uses explicit `'start' | 'end'` values, and omitting the parameter discards the separator (previous default behavior).

**Migration**

```typescript
// Before
await doc.chunk({
  strategy: 'character',
  separator: '.',
  keepSeparator: true,      // or 'start'
});

await doc.chunk({
  strategy: 'character',
  separator: '.',
  keepSeparator: 'end',
});

await doc.chunk({
  strategy: 'character',
  separator: '.',
  keepSeparator: false,     // or omit entirely
});

// After
await doc.chunk({
  strategy: 'character',
  separator: '.',
  separatorPosition: 'start',
});

await doc.chunk({
  strategy: 'character',
  separator: '.',
  separatorPosition: 'end',
});

await doc.chunk({
  strategy: 'character',
  separator: '.',
  // omit separatorPosition to discard separator
});
```
