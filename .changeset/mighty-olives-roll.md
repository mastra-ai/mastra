---
'@mastra/playground-ui': minor
---

Added nested children support to `MainSidebar.Sections` navigation. Parent rows can now stay clickable while rendering child links as nested subitems.

```tsx
<MainSidebar.Sections
  sections={[
    {
      key: 'workspace',
      title: 'Workspace',
      links: [
        {
          name: 'Agents',
          url: '/agents',
          children: [{ name: 'Templates', url: '/agents/templates' }],
        },
      ],
    },
  ]}
/>
```
