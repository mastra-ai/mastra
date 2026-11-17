---
'@mastra/playground-ui': patch
'mastra': patch
---

Added the `playground-ui/icon-size-from-parent` lint rule. It flags an icon that sets its own size with `size`, `width`, `height` or a size class, so icons take their size from the component they sit in, an `<Icon size>` wrapper, or a `size-icon-*` token. Sizes relative to the text (`h-[1em]`) and sizes computed from data are allowed.

```tsx
// Before
<IconPlusMedium className="size-3.5" />

// After
<IconPlusMedium className="size-icon-sm" />
```

Icons now sit on the four icon sizes everywhere, and the skill and prompt block pickers use `EmptyState` and `Spinner` for their empty and loading states.
