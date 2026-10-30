---
'@mastra/factory': patch
---

Restored `title`, `role` and `next` on boards returned by `defineBoard()`. Apps that extended a built-in board with `title: workBoard.title` crashed at boot with `Board "work" must declare a name.` They are deprecated read-only copies of the new fields:

```ts
const relaxed = defineBoard({
  id: workBoard.id,
  name: workBoard.name, // workBoard.title still works, but is deprecated
  initialPhase: workBoard.initialPhase,
  phases: workBoard.phases,
});
```
