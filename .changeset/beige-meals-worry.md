---
'@mastra/playground-ui': minor
---

Added `closeOnEscape` to `Sidebar.NavStack.View` so a sidebar view that accompanies a full page can stay open when Escape is pressed. The sidebar now also follows a `minWidth` that changes at runtime: it widens to the new minimum and returns to the user's saved width when the minimum drops, without overwriting that saved width, including when the page first loads with the raised minimum.

```tsx
<Sidebar.Provider minWidth={configuring ? 288 : 200} collapseBelow={200}>
  <Sidebar.NavStack value={view} onValueChange={setView}>
    <Sidebar.NavStack.Root>{/* main navigation */}</Sidebar.NavStack.Root>
    <Sidebar.NavStack.View value="board-config" title="Work" backLabel="Back to board" closeOnEscape={false}>
      {/* board settings */}
    </Sidebar.NavStack.View>
  </Sidebar.NavStack>
</Sidebar.Provider>
```
