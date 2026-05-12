---
'@mastra/acp': minor
'@mastra/core': minor
'@mastra/inngest': patch
---

Added `@mastra/acp` support for running ACP-compatible coding agents as Mastra tools and lightweight subagents. The package now exposes `createACPTool` and `AcpAgent`, supports incremental ACP response streaming, and integrates with Mastra supervisor delegation through the new public `SubAgent` interface.

Workflows and the Inngest workflow adapter now recognize `SubAgent`-compatible implementations when creating agent-backed workflow steps.
