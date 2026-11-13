---
'create-factory': patch
---

Added a `--name <name>` flag as an alternative to the positional project name, so every installer input can be passed as a flag (for example `npx create-factory@latest --name acme-factory --org my-org --region eu`). Passing two different names exits with an error.
