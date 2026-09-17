---
'@mastra/playground-ui': patch
---

Added an opt-in semantic neutral color contract in `new-theme.css` and lightweight scoped color usage reporting.

```css
@import '@mastra/playground-ui/new-theme.css';
```

```tsx
<div className="new-theme border-border bg-background text-foreground">Content</div>
```
