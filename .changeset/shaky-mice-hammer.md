---
'@mastra/core': minor
---

Added `FileUploadProcessor`, an input processor that uploads files from user messages to the workspace sandbox and gives the model the sandbox path instead of the file content.

Use it when an agent works on user files with its sandbox tools. A `filter` function decides, file by file, what is uploaded; the files it rejects, such as images, keep going to the model. Only files sent inline are uploaded: a file sent as a URL or a provider file ID is left to the model, and never downloaded. Files sent with `agent.generate()`, `agent.stream()`, and signals are all handled, and a file uploaded on one turn isn't uploaded again on the next.

The agent needs memory and a thread. Pass the same workspace to the agent and to the processor:

```ts
import { FileUploadProcessor, FILE_UPLOAD_ERROR_CODES } from '@mastra/core/processors';
import type { FileUploadTripwireMetadata } from '@mastra/core/processors';

const agent = new Agent({
  // ...
  memory,
  workspace,
  inputProcessors: [
    new FileUploadProcessor({
      workspace,
      filter: ({ mimeType, extension }) => mimeType === 'application/pdf' || extension === 'csv',
      maxFileSize: () => 25 * 1024 * 1024,
    }),
  ],
});

const result = await agent.generate(messages, { memory: { thread, resource } });

if (result.tripwire?.processorId === 'file-upload') {
  const { code } = result.tripwire.metadata as FileUploadTripwireMetadata;

  if (code === FILE_UPLOAD_ERROR_CODES.FILE_TOO_LARGE) {
    // ...
  }
}
```

When a file can't be uploaded, the processor stops the turn and reports why in the tripwire metadata. `FILE_UPLOAD_ERROR_CODES` lists every code.
