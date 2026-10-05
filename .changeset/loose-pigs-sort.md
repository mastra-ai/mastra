---
'@mastra/playground-ui': minor
---

Added an inset variant to `CommandDialog`. It wraps the search and results in one panel inside a muted frame, pins the dialog near the top so the input stays put while results change height, and takes a `footer` for actions like feedback links or keyboard hints. `DialogContent` also accepts `showCloseButton={false}` to hide its close button.

```tsx
<CommandDialog
  variant="inset"
  open={open}
  onOpenChange={setOpen}
  footer={
    <Button variant="ghost" size="sm">
      Send feedback
    </Button>
  }
>
  <CommandInput placeholder="Search" />
  <CommandList scrollArea scrollAreaViewportClassName="max-h-dropdown">
    {/* groups */}
  </CommandList>
</CommandDialog>
```
