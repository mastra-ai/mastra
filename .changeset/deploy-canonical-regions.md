---
'mastra': patch
---

`mastra deploy --region` now accepts the Railway region codes `pdx`, `iad`, `sfo`, and `ams` in addition to the `us` and `eu` shorthands, and passes the chosen value to the platform unchanged, including when it creates a new Factory project.

```bash
mastra deploy --env production --region iad
```
