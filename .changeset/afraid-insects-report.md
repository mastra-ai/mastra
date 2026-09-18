---
'@mastra/playground-ui': major
---

Updated Button to use semantic color roles and Base UI composition.

**Breaking change**

Use the `render` prop instead of `as`, `href`, or `to` when rendering a Button as a link.

```tsx
// Before
<Button as={Link} to="/agents">Agents</Button>

// After
<Button render={<Link href="/agents" />}>Agents</Button>
```

Native buttons now default to `type="button"`.
