---
'@mastra/playground-ui': minor
---

Added `closeOnEscape` to `Sidebar.NavStack.View` so a sidebar view that accompanies a full page can stay open when Escape is pressed. The sidebar now also follows a `minWidth` that changes at runtime: it widens to the new minimum and returns to the user's saved width when the minimum drops, without overwriting that saved width.

```tsx
<Sidebar.Provider minWidth={configuring ? 288 : 200} collapseBelow={200}>
  <Sidebar.NavStack.View value="board-config" title="Work" backLabel="Back to board" closeOnEscape={false}>
    {/* ... */}
  </Sidebar.NavStack.View>
</Sidebar.Provider>
```
