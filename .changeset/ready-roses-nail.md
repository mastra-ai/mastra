---
'@mastra/playground-ui': minor
---

Added chromatic ramps and theme-aware status, product, and visualization colors. Notices and badges use solid backgrounds. Dark badges sit on new low-chroma `--{hue}-soft-900` and `--{hue}-soft-950` steps (also available as utilities such as `bg-green-soft-900`), and badges and product avatars share a neutral `shadow-inset` edge built from `--inset-highlight` and `--inset-rim`. Product avatars and badges use the same soft steps in dark mode. Component tints no longer use opacity or `color-mix()`: they point at status, badge, or ramp tokens, and destructive buttons step through `--red-*` for hover, pressed, and disabled states, with a new `--destructive-bg-active` token for pressed ghost states. Added ProductAvatar and ProductBadge components with product icons and theme-aware inset highlights, product Badge variants and optional SankeyChart color callbacks.

Chart roles keep their hue names (`--chart-blue`, `--chart-green`, and so on) and now resolve from the color ramps. Replace `var(--chart-soft-1)` with `var(--chart-sequential-1)`, and `var(--span-type-agent)` with `var(--span-agent)`. See the playground-ui README for the complete mapping.

**Breaking:** removed the numbered accent tokens (`accent1`–`accent6` and their `Dark`/`Darker` variants), `positive1`, `negative1`, `warning1`, the `notice-success/destructive/warning/info` aliases, `--brand-green-*`, `--chart-soft-*`, `--span-type-*`, and `error` (use `destructive-fg` for text and `destructive-indicator` for icons), along with their `Colors` entries. Use the status, chart, and span roles instead. Migrated Studio and Factory consumers to status, focus, chart, and span roles. CodeMirror syntax colors are scoped locally. Added the seven fixed Mastra brand colors as `--color-ds-*`.

Added semantic Badge status variants `success`, `destructive`, `warning`, and `info` for states. The `green`, `red`, `yellow`, and `blue` variants are now categorical tones built from the color ramps, like `purple` and `orange`.

`BADGE_COLORS` and topic colors now return color ramp variables such as `var(--purple-500)` instead of hex values.
