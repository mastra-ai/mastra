---
'@mastra/core': patch
---

Fixed `DurableAgent` losing tools discovered by `ToolSearchProcessor` after the first search. With `includeResolvedTools: true`, the first model step correctly saw only `search_tools`, but the next step saw only `search_tools` again instead of the tool the search auto-loaded, so real models looped on `search_tools` forever. The durable loop now keeps the complete resolved toolset separate from the narrowed per-step snapshot, so tools loaded by `search_tools` or `load_tool` become available on the following step. Fixes #22933.
