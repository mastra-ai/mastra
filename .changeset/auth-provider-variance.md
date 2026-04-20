---
'@mastra/core': patch
---

Fix TUser variance on `MastraAuthProvider` so providers with a narrower `TUser` (e.g. `SimpleAuth<MyUser>`, `MastraAuthClerk`) can be passed to `new CompositeAuth([...])` without a cast.
