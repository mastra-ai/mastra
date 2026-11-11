---
'@mastra/core': patch
---

Agent traces now show the setup that runs before the first model call. An `agent:prepare-tools` span has one `tools:<source>` child per tool source (assigned tools, toolsets, memory, workspace, skills, and so on), and `agent:load-thread` covers loading or creating the memory thread. A slow tool source, such as one that lists an MCP server's tools on every run, now shows up in the trace instead of as an unexplained gap.
