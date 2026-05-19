---
'@mastra/core': patch
---

Fixed a startup bug in `MastraCompositeStore.init()` when using `default` or `editor`.

Before this fix, the composite initialized inner domains directly and could skip parent store initialization. That could skip adapter setup steps and cause missing-table errors during startup (most visibly with `LibSQLStore` on a local file).

Now, `MastraCompositeStore.init()` runs parent `default` and `editor` initialization first, then initializes only domains not already covered by those parents. This preserves adapter-specific initialization behavior and prevents startup races.

Fixes #16782.
