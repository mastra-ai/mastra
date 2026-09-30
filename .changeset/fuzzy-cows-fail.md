---
'@mastra/core': minor
---

Added `WorkspaceAttachmentsProcessor`, which agents with a workspace add automatically. Spreadsheet attachments (`.xlsx`, `.xls`) are no longer sent to the model, because most models cannot read them. Each file is saved to the agent's workspace under `uploads/<id>/<name>`, and the model gets a note with the file path so it can open the file with workspace tools. This applies to every input: `agent.generate()`, `agent.stream()`, UI messages, the `context` option, and the HTTP routes.

The file goes to the workspace filesystem, or to the first writable mount when the filesystem uses mounts. If the workspace only has a sandbox, the file is written there, using `writeFiles` when the provider has it and shell commands through `executeCommand` otherwise. Filesystems and sandboxes resolved per request are supported. When there is nowhere to write the file, the run stops with a tripwire and `metadata.code: 'WORKSPACE_REQUIRED_FOR_ATTACHMENT'`. This happens when the agent has no workspace or when every destination is read-only.

```ts
const agent = new Agent({ id: 'analyst', model, workspace });

await agent.generate([
  { role: 'user', content: [{ type: 'file', data: base64, mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: 'report.xlsx' }] },
]);
// The model sees: [Attachment "report.xlsx" (...) was uploaded to the workspace at uploads/<id>/report.xlsx. ...]
```
