---
'@mastra/playground-ui': minor
---

Added quieter Notice and toast surfaces, optional right-side Notice actions, and an onDismiss callback for dismissible notices. Existing actions remain below the message by default and use the Button link treatment without a persistent underline. Toasts share Notice icons, use the Mastra BrandLoader, and place actions below the message, aligned with its text. Long toast content scrolls within the viewport. Toaster also accepts variant="neutral" for gray surfaces with semantic icons. Default Sonner stacking is preserved. Toast descriptions use the 13px body role, promise loaders morph into a check on success or an × on failure, and unscaled card measurements preserve bounds and spacing when stacked toasts update, wrap or expand. Added the shared errorToast and ErrorNotice helpers for structured errors. Existing toast callsites, native duration options and promise callbacks remain supported; promise dismissal timers start after completion.

```tsx
<Notice variant="info" action={<Notice.Button>View setup</Notice.Button>}>
  Push to a linked branch to create your first deploy.
</Notice>

<Notice variant="info" actionPlacement="end" action={<Button>View setup</Button>}>
  Push to a linked branch to create your first deploy.
</Notice>
```
