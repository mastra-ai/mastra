---
'@mastra/playground-ui': patch
---

Added aligned `flat` and `factory` layouts to `Section`, including standard, view-only, and destructive row compositions.

```tsx
<Section variant="factory">
  <Section.Header>
    <Section.HeaderText>
      <Section.Heading>Security</Section.Heading>
      <Section.Description>Manage sign-in requirements.</Section.Description>
    </Section.HeaderText>
  </Section.Header>
  <Section.Content>
    <Section.Row label="Two-factor authentication">
      <Switch />
    </Section.Row>
  </Section.Content>
</Section>
```
