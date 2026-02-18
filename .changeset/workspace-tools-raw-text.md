---
"@mastra/core": minor
---

Removed `outputSchema` from workspace tools to return raw text instead of JSON, optimizing for token usage and LLM performance. Structured metadata that was previously returned in tool output is now emitted as `data-workspace-metadata` chunks via `writer.custom()`, keeping it available for UI consumption without passing it to the LLM. Tools are also extracted into individual files and can be imported directly (e.g. `import { readFileTool } from '@mastra/core/workspace'`).
