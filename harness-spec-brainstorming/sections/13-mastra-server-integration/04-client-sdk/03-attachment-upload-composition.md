### 13.4c Attachment Upload Composition

**Attachment upload composition.** `RemoteSession.uploadAttachment(opts)` is
an SDK-local facade over the pre-upload route declared in §13.7. The SDK
turns `{ name, mimeType, data: Uint8Array }` into a `multipart/form-data`
upload against `/harness/:name/sessions/:sessionId/attachments` and
deserializes the route response to `{ attachmentId }`. The SDK keeps the
same call shape as the in-process `Session.uploadAttachment(...)`; only the
transport — multipart pre-upload plus a deserialized response — differs.

The `attachmentId` returned here is a **staged, session-scoped** identity
until a later `message`/`queue`/`useSkill` admission references it as
`kind: 'ref'` (§13.7). Until that admission commits, the SDK may issue
`DELETE /attachments/:attachmentId` to drop the staged file; once any
durable surface references it (queue, message history, current run, channel
inbox, wakeup, outbox), `DELETE` rejects with
`HarnessAttachmentInUseError`.

`onProgress` is a transport-local callback for that active HTTP upload only.
It is never serialized into the wire body, stored on the staged attachment,
replayed through SSE, or exposed to raw HTTP clients. It also is not the
admission boundary: a fully reported progress callback does not imply the
server response has been received, and a successful upload still requires
the `{ attachmentId }` response before the file is safe to reference.

Per §13.4d, pre-upload is not on the SDK retry allow-list: the route has no
stable idempotency key and the SDK cannot synthesize one for raw bytes.
After an ambiguous transport failure the SDK rejects the call rather than
reattempting the multipart POST. Callers that need retry must call
`uploadAttachment` again with the same bytes, accept that the prior attempt
may also have committed a distinct staged `attachmentId`, and either drop
the unused id via `DELETE /attachments/:attachmentId` once it is observable
or rely on §13.7 / §9 staged-attachment retention cleanup
(`HarnessConfig.files.stagedAttachmentRetentionMs`) to reclaim it.
