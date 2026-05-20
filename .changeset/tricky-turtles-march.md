---
'@mastra/playground-ui': patch
---

Migrated the `Dialog` component from Radix UI to Base UI. The public API is unchanged — `asChild` on `DialogTrigger` and `DialogClose` is preserved through a render-prop shim, and open/close animations are kept intact.
