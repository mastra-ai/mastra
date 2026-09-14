---
'@mastra/core': patch
---

Add an opt-in `injectCatalog` option to `ToolSearchProcessor`. When enabled, the available-tool catalog (each tool's name and a short description) is injected into the system prompt so the agent can skip the `search_tools` turn and call `load_tool` directly, collapsing the default `search -> load -> use` (3 turns) into `load -> use` (2 turns). `search_tools` stays available as a keyword fallback, injected entries respect the `filter` hook, and the option defaults to `false` so existing behavior is unchanged. Best suited to small/medium tool sets where listing the catalog inline is cheaper than a discovery round-trip. Closes #16463.
