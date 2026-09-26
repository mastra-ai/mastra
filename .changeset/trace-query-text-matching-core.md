---
'@mastra/core': minor
---

Added `matches` and `notMatches` operators to advanced trace queries. They match whole words or phrases, ignoring case, on span `name` and feedback `comment`.

```ts
{ feedback: { some: { op: 'matches', left: { path: 'comment' }, right: { literal: 'incorrect dosage' } } } }
```
