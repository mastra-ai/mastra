---
'@mastra/playground-ui': minor
---

Updated Button to use semantic color roles and Base UI composition.

Compose a Button with another element through `render` instead of `as`:

```tsx
// Before
<Button as={Link} to="/agents">Agents</Button>

// After
<Button render={<Link to="/agents" />}>Agents</Button>
```

`as`, `href`, `to`, and `target` still work and are deprecated. They keep their original element path, so a router link still receives its `to` and still navigates.

Native buttons now default to `type="button"`. A button inside a form that relied on the implicit `submit` needs `type="submit"` set explicitly.
