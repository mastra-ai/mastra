---
'@mastra/factory': minor
---

Added support for replacing the built-in Work and Review boards. Set `includeDefaultBoards: false` and install your own board with id `work` or `review`. A same-id board still errors while the built-ins are installed. Closes #23881.

```typescript
new MastraFactory({
  storage,
  includeDefaultBoards: false,
  boards: [myWorkBoard],
});
```
