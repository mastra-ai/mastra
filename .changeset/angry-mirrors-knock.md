---
'@mastra/deployer': patch
---

Fixed `mastra build` deleting `node_modules` from the output directory, which caused `mastra start` and `wrangler dev` to fail with missing module errors (e.g. `hono`, `bufferutil`, `pino`).
