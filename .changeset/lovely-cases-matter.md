---
'@mastra/playground-ui': minor
---

Added a `switcher` slot to `Crumb` for entity switchers. On the current crumb, clicking anywhere on the crumb (name or chevron) now opens the switcher, instead of only the small chevron. On earlier crumbs the name still navigates back and the chevron opens the switcher. While the switcher is disabled, the crumb stays a plain label. Keep `action` for other controls such as a copy button, and spread the new `crumbSwitcherTriggerProps` on the switcher so every crumb switcher has the same trigger.

```tsx
// Before
<Crumb as="span" isCurrent action={<AgentCombobox value={id} variant="ghost" size="icon-sm" align="end" />}>
  Weather agent
</Crumb>

// After
<Crumb as="span" isCurrent switcher={<AgentCombobox value={id} {...crumbSwitcherTriggerProps} />}>
  Weather agent
</Crumb>
```
