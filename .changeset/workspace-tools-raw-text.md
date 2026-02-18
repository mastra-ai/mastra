---
"@mastra/core": minor
---

Workspace tools now return raw text strings instead of JSON objects, reducing token usage. Tools are extracted into individual files and can be imported directly (e.g. `import { readFileTool } from '@mastra/core/workspace'`). Workspace metadata chunks are scoped by toolCallId for parallel execution. LocalSandbox logs now use `[LocalSandbox]` prefix with reduced verbosity.
