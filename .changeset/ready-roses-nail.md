---
'@mastra/playground-ui': minor
---

Added chromatic ramps and theme-aware status, product, and visualization colors. Badges and notices now use opaque backgrounds. Added ProductAvatar and ProductBadge components with product icons and theme-aware inset highlights, product Badge variants and optional SankeyChart color callbacks.

Added numbered chart roles. Legacy hue-named chart variables remain available through the imported compatibility theme. Replace `var(--chart-blue)` with `var(--chart-1)`, `var(--chart-soft-1)` with `var(--chart-sequential-1)`, and `var(--span-type-agent)` with `var(--span-agent)`. See the playground-ui README for the complete mapping.

Moved numbered accent tokens, numbered status aliases, duplicated notice/status-badge aliases, and the old brand-green ramp aliases into `legacy-theme.css`, imported by `theme.css`. Migrated Studio and Factory consumers to status, focus, chart, and span roles. CodeMirror syntax colors are scoped locally. Added the seven fixed Mastra brand colors as `--color-ds-*`.

Added semantic Badge status variants `success`, `destructive`, `warning`, and `info` alongside the existing hue names. Migrated component consumers and stories; old status spellings remain compatibility aliases, and categorical variants remain unchanged.
