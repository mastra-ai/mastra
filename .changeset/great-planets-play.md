---
'mastra': patch
---

Fixed unreadable code blocks in the agent chat when Studio runs in light mode. Code blocks in assistant replies rendered white text on a transparent background, which collapsed to white-on-white against the light-mode page. They now follow the active light/dark theme — light code on a light surface in light mode, dark in dark mode — so syntax-highlighted code stays readable in both.
