---
'mastra': minor
---

Added `agentBuilder` flag to `create()` and `init()` to scaffold projects with Agent Builder pre-configured. When enabled, the CLI writes an index file with MastraEditor, createBuilderAgent, LibSQLStore, and Observability, and installs Agent Builder dependencies alongside core dependencies.

Use `pnpm dlx create-agentbuilder my-agent-builder-app --llm-api-key <openai-api-key>` to scaffold a ready-to-run Agent Builder project.
