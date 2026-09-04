---
'@mastra/factory': minor
---

Added Factory instance board installation. Custom boards can now be installed alongside the built-in Work and Review boards, or the defaults can be disabled for custom-only configurations.

```ts
const factory = new MastraFactory({
  storage,
  boards: [releaseBoard],
  includeDefaultBoards: false,
});
```
