---
'@mastra/playground-ui': minor
---

Added `ResponsiveDialog`, a dialog that becomes a bottom drawer on phone-sized screens (below 640px). It uses the same parts as `Dialog`, so switching is a rename.

```tsx
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@mastra/playground-ui/components/ResponsiveDialog';

<ResponsiveDialog>
  <ResponsiveDialogTrigger render={<Button>Edit</Button>} />
  <ResponsiveDialogContent size="md">
    <ResponsiveDialogHeader>
      <ResponsiveDialogTitle>Edit agent</ResponsiveDialogTitle>
    </ResponsiveDialogHeader>
    <ResponsiveDialogBody>…</ResponsiveDialogBody>
  </ResponsiveDialogContent>
</ResponsiveDialog>;
```
