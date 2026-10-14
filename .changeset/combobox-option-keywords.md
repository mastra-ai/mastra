---
'@mastra/playground-ui': patch
---

Added an optional `keywords` field to `Combobox` options. Search matches these terms as well as the label, so an option can show a friendly label and still be found by an id or alias.

```tsx
<Combobox
  options={[
    { label: 'Claude Haiku 4.5', value: 'anthropic/claude-haiku-4-5', keywords: ['anthropic/claude-haiku-4-5'] },
  ]}
/>
```
