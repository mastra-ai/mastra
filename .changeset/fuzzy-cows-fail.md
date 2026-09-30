---
'@mastra/core': minor
---

Agents with a workspace now accept spreadsheet attachments (`.xlsx`, `.xls`). The new `WorkspaceAttachmentsProcessor` saves each spreadsheet to `uploads/<id>/<name>` in the workspace and gives the model a note with the path, so the agent reads the file with workspace tools or skills instead of sending binary data the model rejects.

```ts
const agent = new Agent({ id: 'analyst', model, workspace });

await agent.generate([
  {
    role: 'user',
    content: [{ type: 'file', data: base64, mediaType: 'application/vnd.ms-excel', filename: 'report.xls' }],
  },
]);
// The model sees: [Attachment "report.xls" (application/vnd.ms-excel) was uploaded to the workspace at uploads/<id>/report.xls. ...]
```

If the workspace has no writable filesystem, mount, or sandbox, the run stops with a tripwire whose `metadata.code` is `'WORKSPACE_REQUIRED_FOR_ATTACHMENT'`.
