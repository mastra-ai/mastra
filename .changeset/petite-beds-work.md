---
'@mastra/playground-ui': patch
---

Changed `Spinner` to render the new compact loader by default and added `variant="pulse"` for longer data-loading states. Removed the `color` prop so the loader defaults to the neutral text token and color overrides go through `className`.

**Migration note**

Before:

```tsx
<Spinner color={Colors.neutral3} />
```

After:

```tsx
<Spinner className="text-neutral3" />
<Spinner variant="pulse" className="text-neutral1" />
```
