---
'@mastra/playground-ui': minor
---

Added two-line sidebar rows and a `Sidebar.NavAction` button for row actions.

Pass `description` to `Sidebar.NavLabel` to show a smaller second line under the label, such as a timestamp or a count. The row grows to fit it, its icon lines up with the first line, and its actions move to the top-right corner. When the sidebar collapses to icons, the description is hidden and the row keeps its normal height.

Use `Sidebar.NavAction` for buttons in a row's `action` slot. It is a 24px ghost icon button whose corners follow the row's rounded edge, so it sits the same distance from the row's top and right edges. Hover-only actions can reveal with `group-hover/nav-row:`.

```tsx
<Sidebar.NavLink
  render={
    <a href="/sessions/1">
      <Sidebar.NavLabel description={<time dateTime="2026-11-10T10:00:00Z">3h</time>}>Fix flaky login</Sidebar.NavLabel>
    </a>
  }
  action={
    <Sidebar.NavAction aria-label="Session actions">
      <MoreHorizontal />
    </Sidebar.NavAction>
  }
/>
```
