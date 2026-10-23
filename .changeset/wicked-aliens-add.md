---
'@mastra/playground-ui': patch
---

`AppShell` and `MainCard` take an `edgeToEdge` prop. It drops the inset around the page and the card's frame, so the page fills the window. Use it when the sidebar hides completely instead of collapsing to a rail. Pass it on every render, `true` or `false`, and the frame animates between the two on the sidebar's resize timing. Apps that leave it out keep the static frame they have today.

```tsx
const { state, collapsedWidth } = useSidebar();
const edgeToEdge = state === 'collapsed' && collapsedWidth === 0;

<AppShell sidebar={<AppSidebar />} edgeToEdge={edgeToEdge}>
  <MainCard edgeToEdge={edgeToEdge}>
    <Outlet />
  </MainCard>
</AppShell>;
```
