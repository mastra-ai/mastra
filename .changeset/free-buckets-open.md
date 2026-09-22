---
'@mastra/playground-ui': minor
---

Removed the `Kbd` `theme` prop and pointed the radius tokens at the theme.

`Kbd` rendered the same surface for both `theme` values, so the prop is gone and the component always uses the card surface. Callers passing it can drop the prop:

```tsx
/* Before */
<Kbd theme="dark">⌘ K</Kbd>

/* After */
<Kbd>⌘ K</Kbd>
```

`BorderRadius` exported stale pixel values (2px, 4px, 6px, 12px) that no longer matched the theme, so `cn()` could not resolve a conflict between two radius classes. Each key now resolves to its `--radius-*` token and follows the theme.

**Removed.** The unused `--brand-green-badge-bg` and `--brand-green-badge-fg` tokens, their `--color-green-badge-*` aliases, and a `shimmer` keyframe no animation referenced.
