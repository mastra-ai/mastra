---
'@mastra/playground-ui': patch
---

Hardened the design system against out-of-bounds array and object access. TypeScript now checks every indexed access (noUncheckedIndexedAccess), and all code paths were updated with explicit guards or safer restructuring. No behavior changes.
