---
'mastracode': patch
---

Use workspace tool name remapping to restore original tool names (view, search_content, string_replace_lsp, etc.) so they match the tool guidance prompts. Extracted tool names into `MC_TOOLS` constants for reuse across permissions, TUI, subagents, and tool guidance.
