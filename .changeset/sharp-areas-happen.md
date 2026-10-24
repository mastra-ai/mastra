---
'@mastra/playground-ui': minor
---

Added quieter Notice and toast surfaces, optional right-side Notice actions, and an onDismiss callback for dismissible notices. Existing actions remain below the message by default and use the Button link treatment without a persistent underline. Toasts share Notice icons, use the Mastra BrandLoader, and place actions below the message. Long toast content scrolls within the viewport. Toaster also accepts variant="neutral" for gray surfaces with semantic icons. Default Sonner stacking is preserved.

```tsx
<Notice variant="info" action={<Notice.Button>View setup</Notice.Button>}>
  Push to a linked branch to create your first deploy.
</Notice>

<Notice variant="info" actionPlacement="end" action={<Button>View setup</Button>}>
  Push to a linked branch to create your first deploy.
</Notice>
```
