---
'@mastra/playground-ui': minor
---

Composer attachments now reveal a full-height remove action on hover or keyboard focus. An optional `onEdit` callback adds editing below removal. Touch devices use the shared context menu, available through the actions button or a long press.

Dismissing the menu returns focus to the control that opened it. Preview and edit dialogs retain their own focus.

Existing preview children and removal callbacks continue to work. Supply `onPreview` to enable the context-menu preview. Image, PDF, and text entries now accept `open` and `onOpenChange` so the menu and attachment can share preview state:

```tsx
<ComposerAttachment name={file.name} onRemove={removeFile}>
  {preview}
</ComposerAttachment>

<ComposerAttachment name={file.name} onRemove={removeFile} onEdit={editFile} onPreview={() => setPreviewOpen(true)}>
  <ImageEntry src={file.url} name={file.name} open={previewOpen} onOpenChange={setPreviewOpen} />
</ComposerAttachment>
```
