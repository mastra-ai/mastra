---
'@mastra/playground-ui': minor
---

Added a `switcher` slot to `Crumb` for entity switchers. On the current crumb, clicking anywhere on the crumb (name or chevron) now opens the switcher, instead of only the small chevron. On earlier crumbs the name still navigates back and the chevron opens the switcher. Keep `action` for other controls such as a copy button.

```tsx
// Before
<Crumb as="span" isCurrent action={<AgentSwitcher />}>Weather agent</Crumb>

// After
<Crumb as="span" isCurrent switcher={<AgentSwitcher />}>Weather agent</Crumb>
```
