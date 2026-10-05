---
'@mastra/playground-ui': minor
---

Added a shared floating More menu with saved sidebar visibility choices. Studio and Factory reuse shared navigation sections and headers. Existing Platform routes and row styling remain unchanged. Pass visibilityStorageKey to SidebarNew.Sections to scope preferences, and defaultVisible on optional links to supply product defaults.

```tsx
<SidebarNew.Sections
  visibilityStorageKey="my-app:sidebar"
  sections={[{ key: 'tools', links: [], moreLinks: [{ name: 'Tools', url: '/tools', defaultVisible: true }] }]}
/>
```
