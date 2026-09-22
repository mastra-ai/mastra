---
'@mastra/playground-ui': patch
---

Removed the serif default from the typography tokens. `--font-display` now defaults to the same system sans stack as `--font-body`, and the `font-serif` utility no longer exists — the design system has no serif family, and display is a role (headlines and brand), not a typeface. `--font-sans` still resolves to `--font-body`, which is also what Tailwind's preflight reads for the document's default font, so page text keeps following the product font.

Apps that never overrode the tokens rendered Georgia wherever they used `font-display` or `font-serif`; they now get the system sans stack. The `text-*` roles are unaffected — they carry size, line height and weight, never a family. Override the role tokens to apply product fonts:

```css
:root {
  --font-display: 'Mona Sans', system-ui, sans-serif;
  --font-body: 'Mona Sans', system-ui, sans-serif;
  --font-mono: 'Commit Mono', ui-monospace, monospace;
}
```
