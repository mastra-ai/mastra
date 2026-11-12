---
'create-factory': patch
---

`create-factory` no longer asks where your Factory project should run. New projects are created in the US region by default. To create the project in the EU instead, pass `--region eu`:

```bash
npx create-factory@latest my-mastra-factory --region eu
```
