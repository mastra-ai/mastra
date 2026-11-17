---
'@mastra/playground-ui': patch
---

`Sidebar.NavShowMore` accepts a `ref` to its button, so an app can move focus to it, for example when the other toggle disappears after a click.

```tsx
const showLess = useRef<HTMLButtonElement>(null);

<Sidebar.NavShowMore ref={showLess} foldedCount={20} expanded onExpandedChange={collapse} />;

showLess.current?.focus();
```
