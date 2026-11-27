---
'@mastra/factory': minor
---

A person's move now interrupts a running phase on workflow boards. With `createWorkflowBoardEngine`, dragging a card whose phase's run is going into another phase that runs work used to be refused with `card_busy`. The engine now stops the card's runs, waits up to two minutes for them to end, and commits the move. A run that is still going after that, that another Factory process holds, or that runs in someone else's private session keeps the `card_busy` refusal. The default engine still refuses it.

Deleting a card now ends its `factory-board` run. Custom engines can hear of a delete through the new optional `cardDeleted`, and reach a card's runs through the new optional `runs` on the engine context:

```ts
const boardEngine: FactoryBoardEngineFactory = context => {
  const inner = createDispatcherBoardEngine(context);
  return {
    ...inner,
    requestMove: request => inner.requestMove(request),
    requestPlacement: placement => inner.requestPlacement(placement),
    runEnded: (binding, engine) => inner.runEnded(binding, engine),
    cardDeleted: async card => console.log('deleted', card.workItemId),
  };
};
```
