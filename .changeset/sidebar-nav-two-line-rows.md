---
'@mastra/playground-ui': minor
---

Added two-line sidebar rows. Pass `description` to `Sidebar.NavLabel` to show a smaller second line under the label, such as a timestamp or a count, and set `size="two-line"` on `Sidebar.NavLink` so the row grows to fit it. When the sidebar collapses to icons, the description is hidden and the row returns to its normal height. Icons line up with the first line, and row actions sit in the top-right corner, the same distance from the top and right edges.

Buttons in a sidebar row's `action` slot are now 24px with corners that follow the row's rounded edge, instead of 28px circles. They sit the same distance from the row's top and right edges in both single-line and two-line rows.

```tsx
<Sidebar.NavLink
  size="two-line"
  render={
    <a href="/sessions/1">
      <Sidebar.NavLabel description={<time dateTime="2026-11-10T10:00:00Z">3h</time>}>Fix flaky login</Sidebar.NavLabel>
    </a>
  }
/>
```
