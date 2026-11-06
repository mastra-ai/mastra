---
'@mastra/mcp-apps-components': patch
'@mastra/playground-ui': patch
---

`StatelessWidget` now passes the widget definition to `pin.onPin`, the same way `DashboardRenderer` does, so a host can save which chart or widget was pinned or unpinned.

```tsx
<StatelessWidget
  prepared={prepared}
  pin={{
    name: 'Agent runs',
    isPinned,
    onPin: (widget, isPinned) => savePin(widget, isPinned),
  }}
  {...props}
/>
```
