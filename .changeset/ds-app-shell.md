---
'@mastra/playground-ui': minor
---

Added `AppShell`, the application frame (sidebar, optional header, content) that every app page sits in. A required `scroll` prop says who owns the scrolling — `document` lets the page scroll natively, `viewport` pins the frame so the content owns its nested scroll regions — and the frame itself never scrolls or clips in either mode, so a layout overflow shows up as a visible scrollbar instead of silently disappearing.

```tsx
import { AppShell } from '@mastra/playground-ui/components/AppShell';

<AppShell scroll="viewport" sidebar={<Sidebar />} header={<Header />}>
  <div className="min-h-0 flex-1 overflow-auto">{content}</div>
</AppShell>;
```
