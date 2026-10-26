---
'@mastra/playground-ui': minor
---

Added quieter Notice and toast surfaces, with more control over Notice actions.

- **Notice:** `actionPlacement="end"` puts the action beside the message, and `onDismiss` adds a close button. `Notice` also accepts native `div` props and a ref.
- **Toast:** surfaces match Notice, actions sit below the message, and long content scrolls inside the toast. `<Toaster variant="neutral">` keeps every tone on a gray surface with its semantic icon.
- **Promise toasts:** the loader turns into a check or an ×, and the dismiss timer starts only once the promise settles.

```tsx
<Notice variant="info" actionPlacement="end" action={<Button>View setup</Button>} onDismiss={dismiss}>
  Push to a linked branch to create your first deploy.
</Notice>
```
