---
'@mastra/playground-ui': minor
---

Added `SettingsLayout` for settings page titles, actions, constrained width, and section spacing. Section headings now align with the card edge by default. Pass `inset` to `SettingsLayout` and `Section.Header` to align headings with row content.

```tsx
<SettingsLayout title="Project Settings">
  <Section variant="factory">...</Section>
</SettingsLayout>
```
