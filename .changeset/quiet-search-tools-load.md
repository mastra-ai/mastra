---
'@mastra/core': patch
---

Fixed tool search loading every `search_tools` hit when `autoLoad` is `false`. Only `load_tool` now activates tools, so the tool list stays stable and the prompt cache is preserved across steps.
