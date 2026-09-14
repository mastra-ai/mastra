---
'@mastra/playground-ui': minor
---

Added a reusable AppShell for composing sidebars, mobile headers, route headers, and independently scrolling page content. PageHeader icons now sit inside the header grid, with aligned text and readable description contrast.

```tsx
<AppShell mainLabel="Agents" sidebar={<Sidebar />} mobileHeader={<MobileHeader />} routeHeader={<RouteHeader />}>
  <Page />
</AppShell>
```
