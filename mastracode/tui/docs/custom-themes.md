# Themes

Mastra Code ships with bundled themes and loads custom ones from
`~/.mastracode/themes/<name>.json`.

- `/theme` — open the theme picker (built-ins + bundled + custom, live preview)
- `/theme list` — list all available themes
- `/theme <name>` — apply and persist a theme by name
- `/theme auto|dark|light` — built-in modes
- `/theme status` — show the active mode and stored preference
- `MASTRA_THEME=<name>` — environment override (mode or theme name)

## Bundled themes

`tokyo-night`, `catppuccin-mocha`, `catppuccin-latte`, `gruvbox-dark`,
`dracula`, `nord`, `solarized-dark`, `solarized-light`

Bundled themes are defined in `src/tui/bundled-themes.ts`. A user file in
`~/.mastracode/themes/` with the same name overrides the bundled version, so
you can tweak one by copying its definition into a file and editing it.

## File format

```json
{
  "name": "midnight",
  "appearance": "dark",
  "bg": "#1a1b26",
  "vars": {
    "bg-raise": "#16161e",
    "blue": "#7aa2f7",
    "purple": "#bb9af7",
    "green": "#9ece6a",
    "red": "#f7768e",
    "yellow": "#e0af68",
    "fg": "#c0caf5",
    "fg-dim": "#565f89"
  },
  "colors": {
    "accent": "blue",
    "borderAccent": "blue",
    "success": "green",
    "error": "red",
    "warning": "yellow",
    "text": "fg",
    "muted": "fg-dim",
    "dim": "fg-dim",
    "textHighlight": "purple",
    "userMessageBg": "bg-raise",
    "function": "blue",
    "number": "yellow",
    "path": "fg-dim"
  }
}
```

- `appearance` (required): `"dark"` or `"light"`. Selects the surface palette
  and the built-in theme used as a fallback for any color you don't set.
- `bg` (optional): terminal background. When set, the TUI repaints the
  terminal background to this color (OSC 11), derives panel shades from it,
  and contrast-adapts foreground colors against it. The terminal's selection
  highlight is also set to the theme's `selectedBg` (OSC 17) so selected text
  stays readable against the new background. Both are reset on exit or when
  switching themes. Background color keys you don't set explicitly
  (`overlayBg`, `selectedBg`, `userMessageBg`, `systemReminderBg`,
  `toolPendingBg`, `toolSuccessBg`, `toolErrorBg`, `errorBg`) are derived
  from `bg` so overlays and panels match instead of falling back to the
  built-in near-black/white values.
- `vars` (optional): named palette. Values must be hex colors (`#rrggbb` or `#rgb`).
- `colors` (optional): any subset of the color keys below. Values are a hex
  color or the name of a `var`. Unknown keys are ignored.

Foreground colors are still contrast-adapted against the actual terminal
background (WCAG-based), so a theme stays readable even if the terminal
background doesn't match the theme's assumptions.

## Color keys

| Key                                                           | Used for                                             |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `accent`                                                      | Primary accent: prompts, highlights, selected prefix |
| `border` / `borderAccent` / `borderMuted`                     | Box borders                                          |
| `success` / `error` / `warning`                               | Status colors                                        |
| `text`                                                        | Main body text                                       |
| `secondary`                                                   | One step softer than `text`: tool calls, status line |
| `muted` / `dim`                                               | De-emphasized text                                   |
| `thinkingText`                                                | Reasoning/thinking output                            |
| `userMessageBg` / `userMessageText`                           | Sent user messages                                   |
| `systemReminderBg`                                            | System reminder blocks                               |
| `toolPendingBg` / `toolSuccessBg` / `toolErrorBg`             | Tool call panels                                     |
| `toolBorderPending` / `toolBorderSuccess` / `toolBorderError` | Tool panel borders                                   |
| `toolTitle` / `toolArgs` / `toolOutput`                       | Tool call text                                       |
| `textHighlight`                                               | Inline code, headings, links                         |
| `selectedBg`                                                  | Selected list rows                                   |
| `overlayBg`                                                   | Modal overlays                                       |
| `errorBg`                                                     | Error display background                             |
| `path` / `number` / `function`                                | File paths, line numbers, function names             |

## Translating themes from other tools

Any existing theme can be converted — pi themes (`~/.pi/agent/themes/*.json`),
VS Code color themes, terminal schemes (iTerm2, Ghostty, Alacritty, Windows
Terminal), base16/base24 palettes, and editor themes like Tokyo Night,
Catppuccin, or Gruvbox. The job is always the same: extract the source's
palette, then map it onto the color keys above.

Common source vocabularies and where they land:

| Source concept                      | mastracode                                    |
| ----------------------------------- | --------------------------------------------- |
| Editor / terminal background        | `bg`                                          |
| Accent / primary / blue             | `accent`, `borderAccent`, `function`          |
| Green / success / diff-added        | `success`                                     |
| Red / error / diff-removed          | `error`, `toolBorderError`                    |
| Yellow / orange / warning           | `warning`, `number`                           |
| Magenta / purple / keywords         | `textHighlight`                               |
| Foreground / editor text            | `text`                                        |
| Comments / gray / inactive          | `muted`, `dim`, `path`                        |
| Selection background                | `selectedBg`                                  |
| Panel / sidebar / raised background | `overlayBg`, `toolPendingBg`, `toolSuccessBg` |
| Error background                    | `errorBg`, `toolErrorBg`                      |
| Dark/light variant                  | `appearance`                                  |

Specific source hints:

- **pi** (`vars` + `colors`): structure is nearly identical — keep `vars`,
  remap `colors` keys per the table.
- **VS Code** (`.json` theme): use `editor.foreground`/`editor.background` for
  `text`/`appearance`, `editor.selectionBackground` for `selectedBg`, and
  `tokenColors` scopes (keyword → `textHighlight`, string → `success`-family,
  comment → `muted`).
- **Terminal schemes** (ANSI 16): foreground → `text`, blue → `accent`,
  green/red/yellow → `success`/`error`/`warning`, bright black → `muted`,
  magenta → `textHighlight`.
- **base16**: base05 → `text`, base03 → `muted`, base0D → `accent`,
  base0B/base08/base0A → `success`/`error`/`warning`, base0E → `textHighlight`,
  base02 → `selectedBg`.

Keep hex values as-is; drop source keys with no counterpart and let the
built-in fallback fill the rest. Ask your agent: "translate <theme file or
name> to a mastracode theme at ~/.mastracode/themes/<name>.json using the
mapping in custom-themes.md".
