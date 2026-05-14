### 13.7 File attachments

File attachments are caller-supplied model inputs. Agent-produced files,
reports, screenshots, and other outputs are not attachments. Harness v1 does
not define first-class durable output artifact records; produced outputs remain
committed assistant messages, tool results, workspace state, or
application-owned datastore references (§11.5, §15.3).

Two upload paths and one URL input form can send an attachment with a message:

**(a) Inline.** Caller sends a single request with
`Content-Type: multipart/form-data`. The JSON `payload` part carries the
`MessageRequest` (with `files` omitted), and each file part is the raw bytes
plus name + mimeType in the part headers. The server stores each file as a
Harness-owned attachment and rewrites the message to use `kind: 'ref'` before
durable admission.

Trade-off: one round-trip, but the entire upload must complete before the
message is queued. Best for small files (< 1 MiB) where round-trip latency
dominates.

**(b) Pre-uploaded.** Caller first POSTs each attachment to
`/harness/:name/sessions/:sessionId/attachments` (one `multipart/form-data`
request per file carrying bytes plus `name` and `mimeType` metadata), gets back
an `attachmentId`, then POSTs the `MessageRequest` as JSON with `kind: 'ref'`
entries. A pre-uploaded attachment is a staged, session-scoped input until
admitted. The caller may delete it only while it is unused; once queue,
message-history, current-run, channel inbox, wakeup, or outbox state references
it, `DELETE /attachments/:attachmentId` fails with `HarnessAttachmentInUseError`
until those durable references are gone.

Trade-off: two round-trips per file, but attachments can be uploaded in
parallel, support resumable uploads if the storage adapter does, and survive
client navigation. Best for large files, drag-drop UIs, and progress indicators.

**(c) URL.** Caller supplies `kind: 'url'` for an already-hosted asset. This is
an input form, not a persisted attachment shape. Before any durable admission
stores the file in `QueuedItem`, `ChannelInboxItem`, `HarnessWakeupItem`,
accepted-signal/thread history, or `currentRun`, the server fetches/copies the
bytes into Harness-owned attachment storage, records size and digest metadata,
and rewrites the operation to a `kind: 'ref'` attachment. If the URL cannot be
fetched, exceeds the storage policy, fails MIME/content validation, or cannot
produce a stable digest, the operation rejects before the durable write with
`HarnessAttachmentUnavailableError` or `HarnessValidationError`. Raw URLs,
signed URLs, provider temporary URLs, and process-local file handles are never
stored as replay inputs.

URL ingestion is a server-owned fetch/copy with a normative security policy:

- The initial URL and every redirect hop must use `http:` or `https:`. Other
schemes reject with
`HarnessAttachmentUnavailableError.reason = 'unsupported_url'`.
- Redirects are capped by `HarnessConfig.files.maxUrlRedirects`; exceeding the
cap rejects with `reason = 'redirect_limit_exceeded'`. Every hop is revalidated
before following it.
- Unless `HarnessConfig.files.allowPrivateNetworkUrls` is explicitly enabled for
the deployment, DNS resolution and connection targets must reject loopback,
link-local, private, multicast, reserved, and cloud metadata-service address
ranges. The check applies to the initial URL, every redirect hop, and the
connection target so DNS rebinding cannot bypass the policy. Blocked targets,
including DNS rebinding discoveries at connection time, reject with
`reason = 'network_target_blocked'`.
- The server never forwards caller `Authorization`, `Cookie`, session, bearer,
API-key, or ambient server credentials to a caller-supplied URL. A signed URL's
own query string may be used for that fetch, but the raw URL is transient input
and is not persisted.
- Fetching enforces `HarnessConfig.files.urlFetchTimeoutMs` and a streamed
stored-byte cap of `HarnessConfig.files.maxUrlBytes`; `Content-Length` alone is
not sufficient. Timeout aborts reject with `reason = 'fetch_timeout'`; oversized
bodies abort with `reason = 'too_large'` before admission.
- The caller-declared `mimeType`, response `Content-Type` when present, and
byte-sniffed content type must be compatible and must satisfy
`HarnessConfig.files.allowedUrlMimeTypes` when configured. Mismatches reject
with `reason = 'mime_mismatch'`.
- The persisted digest is SHA-256 over the exact bytes written to Harness-owned
attachment storage. A digest write/verification mismatch rejects with
`reason = 'digest_mismatch'`.
- Deployment or storage-adapter malware scanning and content policy may run
before admission. Harness v1 does not guarantee a built-in malware scanner; when
a configured policy blocks the content or cannot produce a required allow
verdict, the operation rejects before admission with
`reason = 'blocked_by_policy'`.

Policy, target, redirect, timeout, scan, and content-validation failures leave
no durable queue, channel inbox, wakeup, accepted-signal, thread-history, or
current-run row that depends on the external URL. If bytes were staged before a
later pre-admission failure, they are treated as unreferenced staged attachments
and become eligible for adapter/deployment cleanup after
`HarnessConfig.files.stagedAttachmentRetentionMs` with zero durable references
(§9); they are never attached to the failed operation.

This URL ingestion contract is the only path from a caller-supplied,
channel-supplied, or provider-supplied URL into a durable Harness v1
attachment. Any server-side URL fetch that feeds a Harness v1 durable row
must enforce the §13.7 scheme, redirect, private-network/metadata,
credential-forwarding, timeout, byte, MIME, and digest controls.
Current-code helpers that fetch URLs server-side without those controls —
including `AgentChannels.inlineLinks` string-rule server-side URL
inspection through `headContentType(...)` at
`packages/core/src/channels/agent-channels.ts` — are not Harness v1 URL
ingestion primitives.

Forced-MIME `inlineLinks` entries (`{ match, mimeType }`) skip the
server-side HEAD and push the raw URL directly into a model message file
part. Because raw URLs are never stored as replay inputs in v1, that
direct promotion is also not a Harness v1 ingestion path: a harness-bound
adapter bridge either routes the URL through the §13.7 URL ingestion
helper (which fetches, stores, and returns a `kind: 'ref'` attachment) or
leaves the URL in the inbound message text. Either branch — `HEAD`-based
inspection or forced-MIME promotion — must end the same way for
harness-bound channels: no durable Harness row stores the raw URL as the
file's authoritative data.

Inline forms enforce `HarnessConfig.files.maxInlineBytes` (§9). Larger files
should be pre-uploaded through the file route or supplied as URL inputs that the
server can ingest under the URL policy above before durable admission.

The SDK exposes the two upload paths; URL inputs use the `FileAttachment`
`kind: 'url'` form directly and are ingested before durable admission:

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

`RemoteSession.uploadAttachment(...)` keeps the same SDK-facing shape as the
in-process `Session` method, but that shape is not the raw wire DTO. The SDK
maps the caller's `Uint8Array` to the multipart pre-upload route; raw JSON
message bodies use `WireAttachment` (§13.3), where inline bytes are base64 and
pre-uploaded files are referenced later as `kind: 'ref'`. `onProgress` is a
client-side transport callback for the active upload only.

Inline-form attachments coming through the in-process API (not the wire) follow
the same flow internally: the harness writes them to
`HarnessStorage.saveAttachment(...)` before persisting a durable record. Guarded
delete, reference listing, and retention checks are owned by §5.2's attachment
storage contract; force-delete cleanup is owned by §5.5.

Attachments are **session-scoped** for new admissions. A staged pre-upload or
live `kind: 'ref'` input cannot target an attachment from a different session,
even within the same resource; subagents that need the same input must receive
their own persisted ref through the parent/subagent admission path.

The narrow exception is committed cloned message history. `threads.clone(...)`
may retain guarded historical `PersistedAttachment` refs under §5.2's clone
graph. Those refs are read/replay/history evidence for the cloned messages
only; they keep the original `ownerSessionId`, `attachmentId`, and `sha256`,
and they cannot be reused as staged or live inputs for a different session.
Admission paths resolve `kind: 'ref'` inputs only against the active session as
attachment owner; an internal or adapter path that tries to submit a historical
ref whose `ownerSessionId` differs from the active session rejects before
admission. If the guarded reference graph cannot be proven, clone rejects before
writing the new thread instead of creating dangling attachment refs (§5.2,
§15.1).

`harness.closeSession(...)` and `deleteSession(...)` attachment cleanup follow
the lifecycle rules in §5.5, which defer guarded attachment references to the
§5.2 storage graph and must respect cross-thread clone references while they
exist.
