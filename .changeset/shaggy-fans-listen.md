---
'@mastra/playground-ui': minor
---

Added a reusable AppShell for composing mobile headers, route headers, framed pages, and independently scrolling page content. PageHeader icons now sit inside the header grid, with aligned text and readable description contrast.

```tsx
<AppShell mainLabel="Agents" mobileHeader={<MobileHeader />} routeHeader={<RouteHeader />}>
  <Page />
</AppShell>
```
