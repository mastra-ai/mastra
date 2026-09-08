---
'@mastra/playground-ui': minor
---

Added a `variant="new"` to `Dialog` with Factory-style spacing, an `intent="destructive"` option, a `pending` state that blocks dismissal, and `DialogCancel` and `DialogAction` footer buttons, including a configurable press-and-hold confirmation. The new variant's `DialogBody` always scrolls inside a bounded, fading area so long copy needs no special handling. The default variant and `AlertDialog` are unchanged.

```tsx
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';

<Dialog variant="new" intent="destructive" open={open} onOpenChange={setOpen} pending={isDeleting}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Delete workspace?</DialogTitle>
    </DialogHeader>
    <DialogBody>
      <DialogDescription>Uncommitted changes will be lost.</DialogDescription>
    </DialogBody>
    <DialogFooter>
      <DialogCancel>Cancel</DialogCancel>
      <DialogAction confirmation="hold" holdSeconds={2} onConfirm={deleteWorkspace}>
        Hold to delete
      </DialogAction>
    </DialogFooter>
  </DialogContent>
</Dialog>;
```

The caller closes the dialog after the action succeeds.

Also added `IntegrationDialog`, a searchable integration picker built on the new dialog variant with a fixed search field and a fading scroll list. Items carry an id, name, optional logo, an optional `badge` shown next to the name, and optional `meta` text shown muted on the right. Consumers own any vendor mapping, such as turning an auth type into a label.

```tsx
import { IntegrationDialog } from '@mastra/playground-ui/components/IntegrationDialog';

<IntegrationDialog
  open={open}
  onOpenChange={setOpen}
  title="Add connection"
  description="Choose an integration to authorize."
  items={[
    { id: 'notion', name: 'Notion', logo: <img src={notionLogo} alt="" />, meta: 'OAuth' },
    { id: 'render-mcp', name: 'Render', badge: 'MCP', meta: 'OAuth' },
  ]}
  onSelect={item => startConnect(item.id)}
>
  <IntegrationDialog.Trigger render={<Button>Add connection</Button>} />
</IntegrationDialog>;
```
