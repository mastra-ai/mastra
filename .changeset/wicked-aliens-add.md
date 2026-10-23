---
'@mastra/playground-ui': patch
---

With a hidden sidebar (`collapsedWidth={0}` and collapsed), `AppShell` and `MainCard` now run the page edge to edge instead of framing it in an inset card. The frame comes back, animated, when the sidebar opens. `useSidebar()` also returns `isHidden` for layouts that need the same signal.

```tsx
import { useSidebar } from '@mastra/playground-ui/components/Sidebar';

function PageFrame({ children }: { children: React.ReactNode }) {
  const { isHidden } = useSidebar();
  return <div className={isHidden ? 'p-0' : 'p-2'}>{children}</div>;
}
```
