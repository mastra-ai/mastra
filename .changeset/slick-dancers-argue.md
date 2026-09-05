---
'@mastra/playground-ui': minor
---

Added DialogNew for opt-in confirmations with shared layouts, scroll fades, and configurable press-and-hold actions. Existing Dialog and AlertDialog components are unchanged.

```tsx
import { DialogNew } from '@mastra/playground-ui/components/DialogNew';

<DialogNew open={open} onOpenChange={setOpen} variant="destructive" pending={isDeleting}>
  <DialogNew.Content>
    <DialogNew.Header>
      <DialogNew.Title>Delete workspace?</DialogNew.Title>
    </DialogNew.Header>
    <DialogNew.Body>
      <DialogNew.Description>Uncommitted changes will be lost.</DialogNew.Description>
    </DialogNew.Body>
    <DialogNew.Footer>
      <DialogNew.Cancel>Cancel</DialogNew.Cancel>
      <DialogNew.Action confirmation="hold" holdSeconds={2} onConfirm={deleteWorkspace}>
        Hold to delete
      </DialogNew.Action>
    </DialogNew.Footer>
  </DialogNew.Content>
</DialogNew>;
```

The caller closes the dialog after the action succeeds.

Also added `IntegrationDialog`, a searchable integration picker built on `DialogNew` with a fixed search field and a fading scroll list.
