---
'@mastra/playground-ui': patch
---

Removed the serif default from the typography tokens. `--font-display` now defaults to the same system sans stack as `--font-body`, and the `font-serif` utility no longer exists — the design system has no serif family, and display is a role (headlines and brand), not a typeface. The `--font-sans` alias still resolves to `--font-body` so the generic utility picks up the product font.

Apps that never overrode the tokens saw Georgia on anything using `font-display` or `text-display`; they now get the system sans stack. Override the role tokens to apply product fonts:

```css
:root {
  --font-display: 'Mona Sans', system-ui, sans-serif;
  --font-body: 'Mona Sans', system-ui, sans-serif;
  --font-mono: 'Commit Mono', ui-monospace, monospace;
}
```
