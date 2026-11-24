---
'create-factory': patch
---

Added canonical pdx, iad, sfo, and ams regions to create-factory, preserving the selected project and environment placement and provisioning Neon in the nearest supported region. Invalid region values, including an explicit empty string, are rejected before scaffolding.

Choose a region when creating a Factory project:

```bash
npx create-factory@latest my-factory --region iad
```
