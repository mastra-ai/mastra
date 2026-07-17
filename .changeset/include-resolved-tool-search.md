---
'@mastra/core': patch
---

Add `includeResolvedTools` to ToolSearchProcessor so per-request tools (such as MCP) can be discovered via search_tools and load_tool without being injected into the prompt until loaded. Fixes #14127.
