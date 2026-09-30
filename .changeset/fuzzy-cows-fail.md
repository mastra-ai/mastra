---
'@mastra/core': minor
---

Added `WorkspaceAttachmentsProcessor`, which lets an agent accept attachments the model can't read, such as spreadsheets. Each matching attachment is saved to `uploads/<id>/<name>` in the agent's workspace, and the model gets a note with the path, so the agent reads the file with workspace tools or skills.

You choose which attachments are routed by extension and/or MIME type. With neither set, every attachment goes to the model unchanged. A `.csv` is never routed by MIME type alone, since browsers report CSVs as `application/vnd.ms-excel`. Set `maxBytes` to cap attachment size; without it any size is accepted.

```ts
import { WorkspaceAttachmentsProcessor } from '@mastra/core/processors';

const agent = new Agent({
  id: 'analyst',
  model,
  workspace,
  inputProcessors: [
    new WorkspaceAttachmentsProcessor({
      extensions: ['.xlsx', '.xls'],
      mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    }),
  ],
});
// The model sees: [Attachment "report.xlsx" (...) was uploaded to the workspace at uploads/<id>/report.xlsx. ...]
```

List the processor directly in `inputProcessors`, not inside a processor workflow. If the workspace has no writable filesystem, mount or sandbox, the run stops with a tripwire whose `metadata.code` is `'WORKSPACE_REQUIRED_FOR_ATTACHMENT'`.
