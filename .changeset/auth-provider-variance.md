---
'@mastra/core': patch
---

Fixed `CompositeAuth` types so typed auth providers, such as `SimpleAuth<MyUser>` or `MastraAuthClerk`, can be combined without casts.
