---
'@mastra/playground-ui': minor
---

Added chromatic ramps and theme-aware status, product, and visualization colors. Notices now use opaque backgrounds, and badges use a tint of the matching color ramp. Added ProductAvatar and ProductBadge components with product icons and theme-aware inset highlights, product Badge variants and optional SankeyChart color callbacks.

Added numbered chart roles. Legacy hue-named chart variables remain available through the imported compatibility theme. Replace `var(--chart-blue)` with `var(--chart-1)`, `var(--chart-soft-1)` with `var(--chart-sequential-1)`, and `var(--span-type-agent)` with `var(--span-agent)`. See the playground-ui README for the complete mapping.

Moved numbered accent tokens, numbered status aliases, duplicated notice aliases, and the old brand-green ramp aliases into `legacy-theme.css`, imported by `theme.css`. Migrated Studio and Factory consumers to status, focus, chart, and span roles. CodeMirror syntax colors are scoped locally. Added the seven fixed Mastra brand colors as `--color-ds-*`.

Added semantic Badge status variants `success`, `destructive`, `warning`, and `info` for states. The `green`, `red`, `yellow`, and `blue` variants are now categorical tones built from the color ramps, like `purple` and `orange`.

`BADGE_COLORS` and topic colors now return color ramp variables such as `var(--purple-500)` instead of hex values.
