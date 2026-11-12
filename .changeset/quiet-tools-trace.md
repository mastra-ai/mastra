---
'@mastra/core': patch
---

Agent traces now cover the setup before the first model call. A new `agent:prepare-tools` span covers resolving the agent's tools, reports the tool count, and names any tool source that took 100ms or more under `slowSourcesMs` (for example `{ "toolsets": 7800 }`). A new `agent:load-thread` span covers loading or creating the memory thread. A slow source, such as one that lists an MCP server's tools on every run, now shows up in the trace instead of as an unexplained gap.
