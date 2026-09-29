---
'@mastra/playground-ui': minor
---

`Dialog` now has one modern shell. Every dialog gets the same padding, spacing, close button, scroll fades and motion, so call sites only pass layout.

- **Sizes**: `<DialogContent size="sm" | "md" | "lg" | "xl" | "full">` sets the width: 24rem, 32rem (the default), 42rem, 56rem, or the full viewport. Height grows with the content up to a viewport cap.
- **Body**: `DialogBody` is a padded ScrollArea whose edges fade while content scrolls. `layout="fill"` makes the body take the remaining height and lets its children handle scrolling, for example split panes or a pinned search. `flush` removes the inset.
- **Footer actions**: `DialogCancel` closes the dialog. `DialogAction` is the primary action: `onConfirm` for a click, `confirmation="hold"` for press-and-hold, and now `type="submit"` to submit the surrounding form. Both are disabled while the dialog is `pending`.
- **Root**: `intent="destructive"` now works on every dialog: it sets the `alertdialog` role, focuses Close first, and ignores outside clicks. A `<Form>` placed directly inside `DialogContent` fits the layout without extra classes.
- **Text**: titles use the `heading` role (16px), and descriptions use the `body` role, muted. `DialogDescription` is now visible.
- **Motion**: dialogs scale up from 96% with a strong ease-out curve and close faster than they open. With reduced motion, they only fade.
- **AlertDialog**: now built from the same shell and parts as `Dialog`, so it has the same padding, text roles, footer buttons and motion. Its header, body, footer, title, description and cancel are the `Dialog` parts. `AlertDialog.Content` takes the same `size` prop and defaults to `sm`. `AlertDialog.Body` is now the padded scroll area.

```tsx
// Before
<Dialog open={open} onOpenChange={isSaving ? undefined : onOpenChange}>
  <DialogContent className="max-w-2xl">
    <DialogHeader className="border-b border-border px-4 py-4">
      <DialogTitle>Import items</DialogTitle>
      <DialogDescription className="not-sr-only text-caption">Paste JSON or upload a file.</DialogDescription>
    </DialogHeader>
    <DialogBody className="max-h-[70vh] overflow-y-auto px-4 py-5">…</DialogBody>
    <DialogFooter className="px-4 pt-4">
      <Button icon={<X />} onClick={() => onOpenChange(false)}>Cancel</Button>
      <Button variant="primary" onClick={handleImport}>Import</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// After
<Dialog open={open} onOpenChange={onOpenChange} pending={isSaving}>
  <DialogContent size="lg">
    <DialogHeader>
      <DialogTitle>Import items</DialogTitle>
      <DialogDescription>Paste JSON or upload a file.</DialogDescription>
    </DialogHeader>
    <DialogBody>…</DialogBody>
    <DialogFooter>
      <DialogCancel>Cancel</DialogCancel>
      <DialogAction onConfirm={handleImport}>Import</DialogAction>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Removed**

- The `variant` prop on `Dialog` and the `DialogVariant` type. Every dialog now uses the modern shell.
- `asChild` on `DialogTrigger` and `DialogClose`. Use `render` instead: `<DialogTrigger render={<Button>Open</Button>} />`.
- The `dialog-overlay-anim` and `dialog-content-anim` classes. To find the overlay in a test, query `[data-slot="dialog-overlay"]`.
