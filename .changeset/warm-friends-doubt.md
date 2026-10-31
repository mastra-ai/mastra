---
'@mastra/factory': minor
---

Improved provider ingestion so source facts refresh independently of board stages. Read normalized facts from `card.workItem` while Factory trust and automation state remain on the card.

```ts
const [card] = await workItems.list({ orgId, factoryProjectId });
console.log(card.workItem.key, card.workItem.state, card.workItem.labels);
```
