---
'mastra': minor
---

Added `--server-api-prefix` option to `mastra studio` command for connecting to servers with custom API route prefixes.

```bash
# Connect to server using custom prefix
mastra studio --server-port 3000 --server-api-prefix /mastra
```
