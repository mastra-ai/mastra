---
'@mastra/core': minor
---

Added `FileUploadProcessor`, an input processor that uploads the files a user sends to the workspace sandbox and gives the model the sandbox path instead of the file content.

Use it when an agent works on user files with its sandbox tools. A `filter` function decides, file by file, what is uploaded; the files it rejects, such as images, keep going to the model. Only the prompt sent to the model changes: the stored messages keep their files, so the thread and clients still have the original. Memory is optional.

Files are named after a hash of their content, so a file is written once and the next turns only check that it's still in the sandbox. Files of the thread history and files sent with signals are handled too. The processor never downloads anything itself: a link the model fetches, or a provider file ID, is left to the model.

Pass the same workspace to the agent and to the processor:

```ts
import { FileUploadProcessor, FILE_UPLOAD_ERROR_CODES } from '@mastra/core/processors';
import type { FileUploadTripwireMetadata } from '@mastra/core/processors';

const agent = new Agent({
  // ...
  workspace,
  inputProcessors: [
    new FileUploadProcessor({
      workspace,
      filter: ({ mimeType, extension }) => mimeType === 'application/pdf' || extension === 'xlsx',
      maxFileSize: () => 25 * 1024 * 1024,
    }),
  ],
});

const result = await agent.generate(messages);

if (result.tripwire?.processorId === 'file-upload') {
  const { code } = result.tripwire.metadata as FileUploadTripwireMetadata;

  if (code === FILE_UPLOAD_ERROR_CODES.FILE_TOO_LARGE) {
    // ...
  }
}
```

When a file of the current turn can't be uploaded, the processor stops the turn and reports why in the tripwire metadata. `FILE_UPLOAD_ERROR_CODES` lists every code. A file of the thread history that can't be uploaded is replaced by a note in the prompt instead, so it never blocks the thread.
