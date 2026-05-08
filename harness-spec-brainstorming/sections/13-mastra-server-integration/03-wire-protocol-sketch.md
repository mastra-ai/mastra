### 13.3 Wire protocol (sketch)

The implementation contract — not a user-facing API. Consumers use the SDK (§13.4); only client implementers in other languages or version-skew debuggers care about the wire shape directly.

**Request payloads** mirror the in-process option types one-to-one. Example for `POST /messages`:

```ts
// Request body — application/json
interface MessageRequest {
  content: string;
  files?: WireAttachment[];
  output?: { schema: JsonSchema };  // Zod schema serialized to JSON Schema
  // Per-turn overrides
  model?: string;
  mode?: string;
  yolo?: boolean;
  // addTools is not sendable over the wire — see §13.5
}

type WireAttachment =
  | { kind: 'inline'; name: string; mimeType: string; data: string /* base64 */ }
  | { kind: 'url'; name: string; mimeType: string; url: string }
  | { kind: 'ref'; name: string; mimeType: string; attachmentId: string };
```

For larger payloads, the route also accepts `multipart/form-data`: a JSON `payload` part (containing the `MessageRequest` minus `files`) plus one file part per attachment. The server promotes uploaded files into pre-stored attachments and rewrites the message to use `kind: 'ref'` references before queuing.

**Event envelope** for SSE streams:

```
id: <epoch>-<seq>
event: <event-type>
data: <json>
```

Each event includes an epoch-prefixed, session-scoped ID (see §10.5). `epoch` is regenerated on every cold start of the in-memory Session instance — initial hydration, re-hydration after eviction, or hydration after a process restart — and `seq` is monotonic within the epoch.

Resume on reconnect uses the standard `Last-Event-ID` header. The server keeps an in-memory ring buffer per Session instance (configurable, default 1000 events; `sessions.eventBufferSize` in §9) and applies the replay rules from §10.5:

- Same epoch, `seq` inside the buffer → replay newer entries, then live-tail.
- Same epoch, `seq` older than the buffer → `412 Precondition Failed` (buffer overflow).
- Different epoch → `412 Precondition Failed` (the previous in-memory buffer is gone).
- Missing or malformed `Last-Event-ID` → live-tail from now, no replay.

In any `412` case the client is expected to refetch state via `GET /sessions/:sessionId` and resubscribe. Durable replay across restarts is **not** a v1 feature; the SSE buffer is in-memory and best-effort. Clients that need history beyond the live buffer should fetch `GET /sessions/:sessionId/messages` for the persisted message log.

**Error envelope:**

The envelope is a discriminated union on `code`. Each `code` corresponds one-to-one with a typed error class in §4.5; the SDK rehydrates the response into an instance of that class with the `details` fields populated. The set of codes is **stable** — adding a new code is a wire-protocol change.

```ts
interface HarnessErrorResponseBase {
  message: string;                 // Human-readable. Not part of any contract;
                                   // SDK callers should branch on `code`, not `message`.
  retryable?: boolean;             // Optional advisory. Servers may set this for
                                   // transient failures (e.g. storage outages); SDKs
                                   // may use it to drive automatic retry/backoff.
}

type HarnessErrorResponse = HarnessErrorResponseBase & (
  // ── Admission failures (4xx) ────────────────────────────────────────────
  | { code: 'harness.busy';                    // → HarnessBusyError (only on `message({ sync: true })`,
                                               //   `message({ stream: true })`, and `useSkill(...)`)
      details: { sessionId: string;
                 reason: 'in_flight' | 'pending_approval' | 'pending_question' | 'pending_plan' } }
  | { code: 'harness.queue_full';              // → HarnessQueueFullError
      details: { sessionId: string; maxQueueDepth: number; currentDepth: number } }
  | { code: 'harness.validation';              // → HarnessValidationError
      details: { field: string; reason: string } }
  | { code: 'harness.override_conflict';       // → HarnessOverrideConflictError
      details: { sessionId: string; activeRunId: string;
                 conflictingFields: Array<'model' | 'mode' | 'addTools'> } }
  | { code: 'harness.subagent_depth_exceeded'; // → HarnessSubagentDepthExceededError
      details: { maxDepth: number; attemptedDepth: number } }
  | { code: 'harness.skill_not_found';         // → HarnessSkillNotFoundError
      details: { skillName: string;
                 searchedSources: Array<'code-registered' | 'workspace'> } }

  // ── Session lifecycle (4xx) ─────────────────────────────────────────────
  | { code: 'harness.session_not_found';       // → HarnessSessionNotFoundError
      details: { sessionId: string } }
  | { code: 'harness.session_closed';          // → HarnessSessionClosedError
      details: { sessionId: string } }
  | { code: 'harness.session_locked';          // → HarnessSessionLockedError
      details: { sessionId: string; currentOwnerId: string; expiresAt: number } }
  | { code: 'harness.aborted';                 // → HarnessAbortedError
      details: { sessionId: string;
                 reason: 'agent_aborted' | 'parent_aborted' | 'session_closed' | 'process_restart';
                 parentSessionId?: string } }

  // ── Workspace (4xx) ─────────────────────────────────────────────────────
  | { code: 'harness.workspace_provider_mismatch'; // → HarnessWorkspaceProviderMismatchError
      details: { sessionId: string; storedProviderId: string; configuredProviderId: string } }
  | { code: 'harness.workspace_lost';          // → HarnessWorkspaceLostError
      details: { sessionId: string; providerId: string; reason: 'restart' | 'eviction' } }

  // ── Persistence (5xx, retryable) ────────────────────────────────────────
  | { code: 'harness.storage';                 // → HarnessStorageError
      details: { sessionId: string; operation: 'flush' | 'load' | 'attachment' } }
  | { code: 'harness.session_corrupt';         // → HarnessSessionCorruptError
      details: { sessionId: string; reason: 'parse_failed' | 'schema_incompatible' } }
  | { code: 'harness.state_serialization';     // → HarnessStateSerializationError
      details: { sessionId: string; path: string } }

  // ── Server-layer (no typed class; SDK throws a generic Error) ───────────
  | { code: 'harness.permission_denied';       // Auth/tenancy boundary, set by the server middleware.
      details?: { sessionId?: string; resourceId?: string } }
  | { code: 'harness.bad_request';             // Malformed HTTP request (bad JSON, missing route param).
                                               // Distinct from `harness.validation`, which is harness-layer
                                               // admission for well-formed requests.
      details?: Record<string, unknown> }
  | { code: 'harness.internal';                // Catch-all for unhandled server exceptions.
      details?: { traceId?: string } }
);
```

The `details` field on a response is fully typed by the discriminated `code`; SDK rehydration is a switch on `code` that constructs the matching `Harness*Error` subclass with the corresponding fields. The set of codes deliberately mirrors the typed class hierarchy in §4.5 — adding a new typed error class therefore requires adding a new code to this union.

**Local-only errors not represented on the wire.** `HarnessConfigError` (§4.5) is intentionally not wire-representable. It is a startup-time failure: a misconfigured workspace provider, missing required field, or unresumable provider declared without a fallback prevents `harness.init()` from succeeding, and therefore prevents the Mastra Server from accepting requests at all. By the time a client could issue an HTTP call, this class of error has already aborted server boot. There is no other typed error in §4.5 that is intentionally local-only.
