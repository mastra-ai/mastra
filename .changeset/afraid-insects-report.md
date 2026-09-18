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

Deprecated `as`, `href`, `to`, and `target` props remain supported. Disabled links composed through `render` no longer navigate and use disabled styling. Buttons without an explicit `type` retain native form submission.
