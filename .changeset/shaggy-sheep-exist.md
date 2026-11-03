---
'@mastra/factory': minor
'mastra': patch
---

Added normalized source facts to Factory cards and the API so boards show provider keys, titles, states, labels, and authors without extra provider lookups. Read source facts from `card.workItem`: provider labels, author, state, and key are no longer on `card.metadata`.

```ts
// Before
card.metadata.labels;
card.metadata.author;

// After
card.workItem.labels;
card.workItem.author;
card.workItem.state;
card.workItem.key;
```
