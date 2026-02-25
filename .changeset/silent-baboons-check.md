---
'mastracode': minor
---

Added light theme support and automatic terminal theme detection. Mastra Code now detects your terminal's color scheme and applies a matching dark or light theme. Use the new `/theme` slash command to switch between `auto`, `dark`, and `light` modes. The choice is persisted across sessions. You can also set the `MASTRA_THEME` environment variable to override the detected theme.

```sh
# Switch theme at runtime via slash command
/theme auto    # detect from terminal background
/theme dark    # force dark theme
/theme light   # force light theme

# Or override via environment variable
MASTRA_THEME=light mastracode
```
