---
'@mastra/playground-ui': patch
---

Added `MainCard`, the rounded, raised surface that sits inside `AppShell` and holds the page content.

```tsx
import { AppShell, MainCard } from '@mastra/playground-ui/new/layout/app-shell';

<AppShell sidebar={<Sidebar />}>
  <MainCard>
    <Outlet />
  </MainCard>
</AppShell>;
```
