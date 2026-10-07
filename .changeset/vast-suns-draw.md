---
'@mastra/playground-ui': minor
---

Composer attachments now reveal a full-height remove action on hover or keyboard focus. An optional `onEdit` callback adds editing below removal. Touch devices use the shared context menu, available through the actions button or a long press.

Dismissing the menu returns focus to the control that opened it. Preview and edit dialogs retain their own focus.

Existing preview children and removal callbacks continue to work. Use `onPreview` to override the context-menu preview when needed:

```tsx
<ComposerAttachment name={file.name} onRemove={removeFile}>
  {preview}
</ComposerAttachment>

<ComposerAttachment name={file.name} onRemove={removeFile} onEdit={editFile} onPreview={previewFile}>
  {preview}
</ComposerAttachment>
```
