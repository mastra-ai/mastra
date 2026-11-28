---
'@mastra/core': minor
---

Importers now leave alone a page that someone merged into another page, instead of refusing every later write to it as a conflict.

When a person or agent merges an imported page into another page, the merged page's content lives on in the page it was merged into. The importer keeps tracking the item, and:

- a later upsert of that item is skipped and counted in the new `merged` count on the run's counts and flush receipts
- removing the item does nothing
- the page it was merged into is never touched
- an existing child of a merged item stays where the merge put it and is updated in place when the merge kept it in the importer's scope; a new child is created in the importer's folder as if its parent were missing, and nothing waits for it
- when the page was merged into a page in another scope, its existing children move to that scope with it and become ordinary pages there, as a page a person moves to another scope does; the importer leaves them as they are and creates the child again in its own folder on the next import

```ts
const receipt = await knowledge.importers!.run('notion');
console.log(receipt.counts.merged); // upserts skipped because their page was merged away
```
