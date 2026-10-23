---
'@mastra/playground-ui': patch
---

`AppShell` and `MainCard` take an `edgeToEdge` prop. It drops the inset around the page and the card's frame, so the page fills the window. Use it when the sidebar hides completely instead of collapsing to a rail. The change animates on the sidebar's resize timing.

```tsx
const { state, collapsedWidth } = useSidebar();
const edgeToEdge = state === 'collapsed' && collapsedWidth === 0;

<AppShell sidebar={<AppSidebar />} edgeToEdge={edgeToEdge}>
  <MainCard edgeToEdge={edgeToEdge}>
    <Outlet />
  </MainCard>
</AppShell>;
```
