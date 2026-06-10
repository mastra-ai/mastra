---
'@mastra/playground-ui': major
---

Removed the `default` Button size. Buttons now use `md` when no size is provided, and the previous `default` styling is available as `lg`.

**Migration**

Before:

```tsx
<Button size="default">Save</Button>
```

After:

```tsx
<Button size="lg">Save</Button>
```

Use `size="md"` or omit `size` for the new default Button size.
