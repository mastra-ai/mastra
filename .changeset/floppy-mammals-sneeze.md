---
'@mastra/mcp-docs-server': patch
---

Adds MCP prompts to the docs server to help users migrate from v0.x to v1.0.

Added a `mastraMigration` tool for exploring migration guides. Now adds two complementary prompts:

- `upgrade-to-v1` - Guides through migration with optional area parameter (agents, tools, workflows, memory, evals, mcp, vectors, syncs)
- `migration-checklist` - Generates comprehensive checklist of all breaking changes

The prompts work with the `mastraMigration` tool to provide step-by-step guidance. Users can invoke them in their IDE like `/prompt upgrade-to-v1 area=agents` to get focused help.
