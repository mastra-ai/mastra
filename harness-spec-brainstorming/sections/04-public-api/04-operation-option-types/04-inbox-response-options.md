### 4.4d Inbox Response Options

```ts
interface InboxResponseOptions {
  // Required for channel actions and other retryable external transports.
  // On wire-level inbox routes `itemId` is always present in the URL path
  // (`POST /sessions/:sessionId/inbox/:itemId`), so this field is only truly
  // optional for direct in-process local calls where the session can resolve
  // the single pending item of this kind. Tool approval/suspension responses
  // that also carry a `toolCallId` must match this stable pending interaction
  // `itemId`.
  itemId?: string;
  // Idempotency key for retrying an inbox response. On every wire-level
  // `POST /inbox` call, SDKs auto-generate a stable responseId before the HTTP
  // request when the caller does not provide one; wire calls without a
  // responseId reject with `400 harness.validation`. Only direct in-process
  // local calls may truly omit it; the harness mints one internally for those.
  // Channel action callbacks always provide `responseId = ChannelActionReceipt.id`.
  responseId?: string;
  requestContext?: RequestContextInput;
}

// Bridge-owned calls with trusted channel request context or any other retryable
// external transport must provide both `itemId` (from the URL path on wire
// routes, or as a field in-process) and `responseId`; omitting either is a
// `HarnessValidationError` before the pending item is inspected.
// The response hash is computed with the Harness stable-hash canonicalization
// profile (§5.1) over the response payload plus the response kind, `itemId`,
// `runId`, and pending `requestedAt`. A retry with the same `responseId` and
// hash returns the first applied result or the current accepted status; a retry
// with the same `responseId` and a different hash throws
// `HarnessInboxResponseConflictError`.

interface ToolApprovalResponse {
  approved: boolean;
  reason?: string;
}

interface ToolSuspensionResponse {
  resumeData: JsonValue;
}

interface InboxResponseResult {
  itemId: string;
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  // `accepted` means the response has won the pending item but the underlying
  // run resume has not completed yet; the session remains busy/resuming.
  // Normal first calls resolve as `applied` except for tool-suspension, where
  // the first call may throw `HarnessRecoveryDeferredError` after committing
  // `accepted` because the workflow snapshot is not yet observable. Retrying
  // transports may observe `accepted` while recovery is still applying the
  // same `responseId`.
  status: 'accepted' | 'applied';
  responseId: string;
  duplicate: boolean;
}

```
