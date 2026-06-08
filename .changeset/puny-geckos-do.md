---
'@mastra/playground-ui': minor
---

Added a new `@mastra/playground-ui/theme.css` export — the design system's raw token layer (the `:root` / `html.light` custom properties and the Tailwind `@theme` block) — and made the Mastra brand green a first-class design-system color.

**New raw theme export**

Apps that consume the prebuilt `@mastra/playground-ui/style.css` had to redeclare every design token in their own `@theme` block so their Tailwind build would generate the design-system utility classes (`bg-surface1`, `text-neutral4`, …) for their own markup. The compiled stylesheet only carries the utilities playground-ui itself uses, so consumers couldn't rely on it. Importing the raw token layer instead lets the consumer's own Tailwind compiler read `@theme` once and generate every DS utility — no duplication, single source of truth (the same pattern as `tailwindcss/theme.css`).

```css
@import 'tailwindcss';
@import '@mastra/playground-ui/theme.css'; /* tokens + @theme → DS utilities */
@import '@mastra/playground-ui/style.css'; /* component styles */
```

**Brand green + chart tokens**

The `green-*` utility palette now resolves to the Mastra brand green (centered on the `notice-success` token) in both light and dark mode, instead of Tailwind's default green. New `--chart-1…5` tokens are available for data-viz. If you previously relied on Tailwind's stock green in a Studio surface, expect a slightly more vivid, brand-aligned green.
