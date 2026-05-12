### 13.4d Retry Policy

**Retry policy.** The SDK may retry only operations whose route contract has a
stable idempotency key or read-only semantics. For run-starting writes, that
means signal-driven `message(...)`, `queue(...)`, and untyped `useSkill(...)`
when the SDK has supplied or preserved an `admissionId`. The SDK must not
automatically retry `message({ sync: true, output })` or `useSkill({ output })`
after a request is sent or after an ambiguous transport failure; those paths
bypass the signal admission boundary and are non-retry-safe in v1 (§4.4,
§15.1).
Callers that need retry-safe typed extraction must model their own application
receipt or use a durable Harness admission such as `queue(...)` and perform the
typed read as a separate, non-automatic step.

For SDK retry capability to apply to signal-driven `message(...)`,
`queue(...)`, and untyped `useSkill(...)`, the SDK generates and retains the
`admissionId` it intends to send before issuing the first transport request for
that operation, preserves the same value across automatic retries, and reuses
the same §4.4 admission hash inputs (normalized content, file references,
serializable `requestContext`, and turn overrides) so a retry after an
ambiguous failure hits the §4.4 admission boundary instead of starting a second
run or raising `HarnessAdmissionConflictError`. A caller-supplied `admissionId`
overrides the SDK-minted value; in both cases the same value is reused for
every automatic retry of that operation. SDKs must not derive a fresh
`admissionId` or recompute hash inputs per attempt. SDK paths that opt out of
automatic retry (for example a per-call `retries: 0` override) are not required
to mint an `admissionId` solely to satisfy this rule.

The transport implementing `RemoteSession` must enforce this route-aware retry
policy at the transport layer rather than inheriting a non-route-aware retry
helper unchanged. Acceptable shapes are a Harness-specific transport or an
explicit per-request retry policy on a shared helper that the Harness path
overrides; either way the default for non-read, non-route-declared-idempotent
writes is no automatic retry, and the non-retry-safe sync-typed and typed-skill
rules above are not overridable per call. Wider migration of non-Harness SDK
methods is out of scope for v1.

`RemoteSession.close()` / `DELETE /sessions/:sessionId` is retry-safe because
the route is idempotent against the stored `closingAt` / `closedAt` close
marker (§5.5). After an ambiguous transport failure, the SDK may retry the same
DELETE; if it cannot obtain a close response, it refreshes
`SessionSnapshot.summary` to distinguish Closing, Closed, and tenant-safe
not-found states. It must not look for or emulate a separate close-status route.

For remote state writes, the SDK preserves the local `getState()` return shape:
callers still receive only the detached read-only state snapshot. Internally,
`RemoteSession` records the `ETag` returned by `GET /state` or the full session
read and attaches it as `If-Match` on the next `setState(patch)` call. The
patch uses the same §5.1 object-form merge semantics as local `setState`:
omitted keys remain unchanged, explicit `null` is a value, arrays and nested
objects replace as whole top-level values, and deletion is not supported. If no
state validator is known, the SDK first fetches the current state to obtain one
before sending the patch; that path is safe for absolute patches, but callers
doing read-modify-write from external cached state must refetch through the SDK
first. A `harness.state_conflict` response rejects with
`HarnessStateConflictError`; the SDK does not automatically re-read and replay a
caller-computed patch because the caller must recompute it against the new
snapshot.

`RemoteSession.setThreadSetting(...)` uses the same cached session `ETag`
discipline as object-form `setState(...)`, but the write is limited to
`thread.metadata.app[key]`. If no validator is known, the SDK first fetches the
session snapshot, then sends `PATCH /thread-settings/:key` with `If-Match`. A
stale validator rejects with `HarnessStateConflictError`; the SDK does not
silently replay the app-metadata write because intervening durable session
writes may matter to the caller's UI or coordination logic. Raw top-level
thread metadata is never exposed as a remote mutator.

SDK error reactions branch on §4.5 typed classes and §13.3 wire codes. This
section describes client composition and render-state reactions; it does not
define new error codes, `details` shapes, or retryability fields.
