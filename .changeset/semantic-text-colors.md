---
'@mastra/playground-ui': patch
---

Add `placeholder` semantic color token and migrate text colors from `text-neutralN` to `text-foreground` / `text-muted-foreground` / `text-placeholder`. Semantic tokens (`foreground`, `muted-foreground`, `placeholder`, `border`, …) are now defined on `:root` in `theme.css` and exposed as Tailwind utilities globally, not only under `.new-theme`.
