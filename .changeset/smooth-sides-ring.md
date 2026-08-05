---
'@mastra/playground-ui': minor
---

Preserved browser shortcuts by making the MainSidebar Command+B toggle opt-in. Consumers that want the previous shortcut can enable it explicitly:

```tsx
<MainSidebarProvider disableKeyboardShortcut={false}>{children}</MainSidebarProvider>
```

Added selective hooks for consumers that only need sidebar state or mobile drawer state:

```tsx
import { useMaybeSidebarState, useMobileDrawer } from '@mastra/playground-ui/components/MainSidebar';

const sidebar = useMaybeSidebarState();
const { openMobile } = useMobileDrawer();
```
