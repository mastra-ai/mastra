---
'@mastra/playground-ui': minor
---

Added responsive AppLayout, AppFrame, and PageContent components that reuse SidebarNew and support optional breadcrumbs and page headers. Page content and sidebar scrollbars share hover/scroll visibility. Button and sidebar control labels no longer become selected when clicked.

Use the composition without replacing existing AppShell consumers:

```tsx
import { AppLayout, AppFrame, PageContent } from '@mastra/playground-ui/new/layout/app-layout';

<AppLayout sidebar={navigation}>
  <AppFrame breadcrumb={breadcrumbs}>
    <PageContent pageHeader={pageHeader}>{children}</PageContent>
  </AppFrame>
</AppLayout>
```
