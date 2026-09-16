---
'@mastra/playground-ui': patch
---

Added an opt-in semantic neutral color contract in `new-theme.css` and lightweight scoped color usage reporting.

```css
@import '@mastra/playground-ui/new-theme.css';
```

```tsx
<div className="mastra-theme border-mastra-border bg-mastra-background text-mastra-foreground">Content</div>
```
