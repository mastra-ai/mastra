---
'@mastra/playground-ui': minor
---

Composer attachments now reveal removal through a full-container sleeve by default, with optional editing below it and a native context menu on touch devices. Action button corners follow the attachment radius minus their inset for concentric curves. Existing previews and removal callbacks continue to work.

Attachment surfaces use the raised-container fill so they appear lighter than the composer in dark mode. In light mode they keep the white card surface, with the shared rim and shadow providing separation.

The action buttons fill their column with consistent spacing; when removal is the only action, it fills the available height. The attachment list keeps an even gutter around each row. The preview fills its cover without an extra strip of unused padding. Dismissing the context menu restores focus to the control that opened it.

Applications can now supply an optional editor and override the context-menu preview:

```tsx
// Existing usage remains supported.
<ComposerAttachment name={file.name} onRemove={removeFile}>
  {preview}
</ComposerAttachment>

// Add application-owned actions when available.
<ComposerAttachment
  name={file.name}
  onRemove={removeFile}
  onEdit={editFile}
  onPreview={previewFile}
>
  {preview}
</ComposerAttachment>
```
