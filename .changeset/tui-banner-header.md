---
'mastracode': patch
---

Added styled ASCII art banner header to the TUI with purple gradient and project frontmatter display. The banner shows "MASTRA CODE" in block letters for wide terminals, "MASTRA" for medium terminals, and falls back to a compact single line for narrow terminals. Project info (name, resource ID, branch, user) now renders inside the TUI header instead of via console.info before startup.
