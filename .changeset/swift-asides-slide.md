---
'@mastra/playground-ui': minor
---

Added `AsideReveal`, a right-edge drawer for phones that works like the sidebar's mobile drawer. Swiping left anywhere in the app shell slides the page left to show the panel. Swiping right, pressing Escape, or tapping the page closes it. The sidebar and the aside use the same swipe handling, so a swipe moves only one of them: with either drawer open, the opposite swipe closes it and does not open the other.

```tsx
<SidebarProvider>
  <AppShell sidebar={<Sidebar>{/* ... */}</Sidebar>}>
    <AsideReveal open={open} onOpenChange={setOpen} label="Session panel" triggerRef={triggerRef}>
      <SessionDetails />
    </AsideReveal>
  </AppShell>
</SidebarProvider>
```
