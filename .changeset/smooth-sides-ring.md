---
'@mastra/playground-ui': patch
---

Preserved browser shortcuts by making the MainSidebar Command+B toggle opt-in. Consumers that want the previous shortcut can enable it explicitly:

```tsx
<MainSidebarProvider disableKeyboardShortcut={false}>{children}</MainSidebarProvider>
```
