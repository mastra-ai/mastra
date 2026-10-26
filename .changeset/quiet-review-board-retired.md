---
'@mastra/factory': minor
---

Removed the `reviewBoard` and `ReviewBoardPhase` exports. Work is now the only built-in board: pull requests are filed and reviewed on it, so code that installed `reviewBoard` should install `workBoard` instead.

```ts
// Before
new MastraFactory({ boards: [workBoard, reviewBoard], includeDefaultBoards: false });
// After
new MastraFactory({ boards: [workBoard], includeDefaultBoards: false });
```

Starting a `review` session on a Work card with `factory_start_session` works again.
