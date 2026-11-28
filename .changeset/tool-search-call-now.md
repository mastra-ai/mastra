---
'@mastra/core': patch
---

ToolSearchProcessor now tells the model that loaded tools are callable right away instead of "on your next turn". A loaded tool is offered at the very next step of the same run, but models could read "next turn" as waiting for the user's next message and stall before using it. The `load_tool` and `search_tools` messages, the autoLoad search result, and the injected system instructions now say the tool can be called now. Result fields (`success`, `toolName`, `loaded`, `notFound`, `alreadyLoaded`, `loadedCount`) are unchanged; only the human-readable `message` text changed.
