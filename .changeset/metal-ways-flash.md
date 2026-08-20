---
'@mastra/playground-ui': minor
---

Added `flat` and `factory` variants to `Section`, including standard, view-only, and destructive row compositions.

```tsx
<Section variant="factory">
  <Section.Header>
    <div>
      <Section.Heading>Security</Section.Heading>
      <Section.Description>Manage sign-in requirements.</Section.Description>
    </div>
  </Section.Header>
  <Section.Content>
    <Section.Row label="Two-factor authentication">
      <Switch />
    </Section.Row>
  </Section.Content>
</Section>
```
