---
'@mastra/core': minor
---

Importers now leave alone a page that someone merged into another page, instead of refusing every later write to it as a conflict.

When a person or agent merges an imported page into another page, the merged page's content lives on in the page it was merged into. The importer keeps tracking the item, and:

- a later upsert of that item is skipped and counted in the new `merged` count on the run's counts and flush receipts
- removing the item does nothing
- the page it was merged into is never touched
- an existing child of a merged item stays where the merge put it and is updated in place; a new child is created in the importer's folder as if its parent were missing, and nothing waits for it

```ts
const receipt = await knowledge.importers!.run('notion');
console.log(receipt.counts.merged); // upserts skipped because their page was merged away
```
