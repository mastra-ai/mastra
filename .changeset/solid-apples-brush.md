---
'@mastra/factory': minor
---

Added `runEnded(binding, engine)` to `FactoryBoardEngine`. Factory now asks the board engine what a finished run means for its card instead of applying the run's outcome itself, so a custom engine decides when a phase ends.

**Custom engines must implement `runEnded`.** An engine that wraps the default one keeps today's behaviour, and still sees every move, by forwarding it with the engine it is given:

```ts
// Before
const boardEngine: FactoryBoardEngineFactory = context => {
  const inner = createDispatcherBoardEngine(context);
  return {
    requestMove: request => inner.requestMove(request),
    requestPlacement: placement => inner.requestPlacement(placement),
  };
};

// After
const boardEngine: FactoryBoardEngineFactory = context => {
  const inner = createDispatcherBoardEngine(context);
  return {
    requestMove: request => inner.requestMove(request),
    requestPlacement: placement => inner.requestPlacement(placement),
    runEnded: (binding, engine) => inner.runEnded(binding, engine),
  };
};
```

**The engine context also carries `workItems` and `boards`.** Engine factories passed to `MastraFactory` receive them already. Code that constructs `DispatcherBoardEngine` itself must pass them:

```ts
// Before
new DispatcherBoardEngine({ transitionService });

// After
new DispatcherBoardEngine({ transitionService, workItems, boards });
```
