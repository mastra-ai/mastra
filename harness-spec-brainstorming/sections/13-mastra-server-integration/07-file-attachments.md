### 13.7 File attachments

Two paths for sending an attachment with a message:

**(a) Inline.** Caller sends a single request with `Content-Type: multipart/form-data`. The JSON `payload` part carries the `MessageRequest` (with `files` omitted), and each file part is the raw bytes plus name + mimeType in the part headers. The server stores each file as an attachment and rewrites the message to use `kind: 'ref'` before queuing.

Trade-off: one round-trip, but the entire upload must complete before the message is queued. Best for small files (< 1 MiB) where round-trip latency dominates.

**(b) Pre-uploaded.** Caller first POSTs each attachment to `/harness/:name/sessions/:sessionId/attachments` (one multipart request per file), gets back an `attachmentId`, then POSTs the `MessageRequest` as JSON with `kind: 'ref'` entries. Pre-uploaded attachments are reachable from any subsequent message until the session is closed (or the caller deletes them via `DELETE /attachments/:attachmentId`).

Trade-off: two round-trips per file, but attachments can be uploaded in parallel, support resumable uploads if the storage adapter does, and survive client navigation. Best for large files, drag-drop UIs, and progress indicators.

Both paths enforce `HarnessConfig.files.maxInlineBytes` (§9). Larger files **must** be hosted externally and sent as `kind: 'url'`.

The SDK exposes both paths:

```ts
// (a) Inline — SDK picks multipart automatically when files are present.
await session.queue({
  content: 'Look at this screenshot',
  files: [{ kind: 'inline', name: 'screenshot.png', mimeType: 'image/png', data: bytes }],
});

// (b) Pre-uploaded — useful for browser drag-drop with progress UI.
const { attachmentId } = await session.uploadAttachment({
  name: 'screenshot.png',
  mimeType: 'image/png',
  data: bytes,
  onProgress: (loaded, total) => updateProgressBar(loaded / total),
});
await session.queue({
  content: 'Look at this screenshot',
  files: [{ kind: 'ref', name: 'screenshot.png', mimeType: 'image/png', attachmentId }],
});
```

Inline-form attachments coming through the in-process API (not the wire) follow the same flow internally: the harness writes them to `HarnessStorage.saveAttachment(...)` before persisting the queue item, then deletes them after the item is consumed.

Attachments are **session-scoped**. They cannot be referenced from a different session, even within the same resource. `harness.closeSession(...)` cascades to `deleteAttachmentsForSession(...)`.
