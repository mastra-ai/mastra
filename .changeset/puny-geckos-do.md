---
'@mastra/playground-ui': minor
---

Added a new `@mastra/playground-ui/theme.css` export that ships the design system's raw token layer — the `:root` / `html.light` custom properties and the Tailwind `@theme` block.

**Why:** Apps that consume the prebuilt `@mastra/playground-ui/style.css` had to redeclare every design token in their own `@theme` block so their Tailwind build would generate the design-system utility classes (`bg-surface1`, `text-neutral4`, …) for their own markup. The compiled stylesheet only carries the utilities playground-ui itself uses, so consumers couldn't rely on it. Importing the raw token layer instead lets the consumer's own Tailwind compiler read `@theme` once and generate every DS utility — no duplication, single source of truth.

**Before** — every token mirrored by hand:

```css
@import 'tailwindcss';
@import '@mastra/playground-ui/style.css';

@theme inline {
  --color-surface1: var(--surface1);
  --color-neutral4: var(--neutral4);
  /* …dozens more… */
}
```

**After** — import the token layer, the rest is generated:

```css
@import 'tailwindcss';
@import '@mastra/playground-ui/theme.css'; /* tokens + @theme → DS utilities */
@import '@mastra/playground-ui/style.css'; /* component styles */
```
