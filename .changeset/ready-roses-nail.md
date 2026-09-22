---
'@mastra/playground-ui': major
---

Added chromatic ramps and theme-aware status, product, and visualization colors. Badges and notices now use opaque backgrounds. Added ProductAvatar and ProductBadge components with product icons and theme-aware inset highlights, product Badge variants and optional SankeyChart color callbacks.

Removed hue-named chart variables in favor of numbered roles. Replace `var(--chart-blue)` with `var(--chart-1)`, `var(--chart-soft-1)` with `var(--chart-sequential-1)`, and `var(--span-type-agent)` with `var(--span-agent)`. See the playground-ui README for the complete mapping.

Removed numbered accent tokens, numbered status aliases, duplicated notice/status-badge aliases, and the old brand-green ramp aliases. Migrated Studio and Factory consumers to status, focus, chart, and span roles. CodeMirror syntax colors are scoped locally. Added the seven fixed Mastra brand colors as `--color-ds-*`.

Renamed Badge status variants from `green`, `red`, `yellow`, and `blue` to `success`, `destructive`, `warning`, and `info`. Migrated component consumers and stories; categorical variants remain unchanged.
