---
'@mastra/playground-ui': minor
---

Added a full-container sleeve for composer attachments, with vertically stacked controls and a native context menu on touch devices. Action button corners follow the attachment radius minus their inset for concentric curves. Existing previews and removal callbacks continue to work.

Attachment surfaces use the raised-container fill so they appear lighter than the composer in dark mode and remain distinct in light mode.

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
