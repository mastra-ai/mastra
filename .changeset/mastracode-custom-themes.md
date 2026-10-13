---
'mastracode': minor
---

Added custom themes. Pick one of eight bundled palettes, follow your terminal's light or dark appearance, or drop your own theme JSON into `~/.mastracode/themes/`.

**Themes**

- `/theme` opens a picker with live preview. `/theme list`, `/theme <name>`, and `/theme status` cover the rest.
- `MASTRA_THEME` overrides the preference with a mode (`dark` or `light`), a theme name, or a light/dark pair like `catppuccin-latte/catppuccin-mocha` that follows the detected terminal appearance.
- Bundled themes: `tokyo-night`, `catppuccin-mocha`, `catppuccin-latte`, `gruvbox-dark`, `dracula`, `nord`, `solarized-dark`, `solarized-light`. A user file with the same name wins.
- Theme colors adapt to the terminal's actual background for contrast, and every surface — tool pills, code highlighting, the judge display, MCP selector, overlays, and status line — now resolves through the active theme.

```sh
MASTRA_THEME=solarized-light/solarized-dark mastracode
```

```text
/theme catppuccin-mocha                  # a bundled theme
/theme solarized-light/solarized-dark    # follow the terminal with a pair
```
