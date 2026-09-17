---
'@mastra/playground-ui': minor
---

Shared draft attachment previews and remove controls between Studio and Factory. Factory message images now open in the shared preview dialog, including base64 and URL sources.

Use the shared layout with a prepared preview and your application's removal callback:

```tsx
import { ImageEntry } from '@mastra/playground-ui/domains/chat/attachments/attachment-preview-dialog';
import { ComposerAttachment } from '@mastra/playground-ui/domains/chat/attachments/composer-attachment';
import { ComposerAttachmentList } from '@mastra/playground-ui/domains/chat/attachments/composer-attachment-list';

<ComposerAttachmentList>
  <ComposerAttachment name="diagram.png" onRemove={() => removeAttachment(id)}>
    <ImageEntry src={previewUrl} name="diagram.png" />
  </ComposerAttachment>
</ComposerAttachmentList>;
```

File reading, accepted types, uploads, and draft persistence remain application-owned.
