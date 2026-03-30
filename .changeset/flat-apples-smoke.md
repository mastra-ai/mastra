---
'mastra': patch
---

Fixed `--no-example` flag being ignored when `--default` is also passed to `create-mastra`. Previously, running `create-mastra --default --no-example` would always scaffold the weather agent example. Now `--no-example` correctly suppresses example files even when using `--default`.
