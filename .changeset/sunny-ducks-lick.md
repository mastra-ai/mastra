---
'mastra': patch
---

Fixed `mastra init` writing the API key to the project's `.env` file using a path resolved from the project root, so the file location no longer depends on how the process working directory is set.
