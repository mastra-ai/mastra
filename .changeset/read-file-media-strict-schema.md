---
'@mastra/core': patch
---

Fixed `mastra_workspace_read_file` never returning media parts with strict-schema providers (e.g. OpenAI, Vercel AI Gateway). Media surfacing is now decided from the file's mime type and tool config instead of the absence of the optional `encoding` argument, so configured media within `maxMediaBytes` is returned as a native file/image part regardless of the model-supplied `encoding`.
