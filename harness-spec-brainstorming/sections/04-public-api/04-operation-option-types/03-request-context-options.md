### 4.4c Request Context Options

```ts
// `requestContext` is JSON-shaped caller metadata merged into the agent
// `RequestContext` that tools receive. In Harness v1, callers may provide only
// `requestContext.app`: a canonical-JSON application metadata bag (`JsonValue`
// is defined in §6.1). Top-level request-context slots are
// infrastructure-owned. Caller input that contains any other top-level key is
// rejected with `HarnessValidationError` before session admission, including
// `harness`, `channel`, `MastraMemory`, `browser`, `user`, `userPermissions`,
// `userRoles`, any `mastra__*` key, any `__mastra*` key, and any future
// Harness/Mastra/server-owned slot. The `app` object must stay
// application-owned: products should namespace their own keys inside it when
// multiple libraries share one session.
//
// The harness owns identity (`sessionId`, `threadId`, `resourceId`, etc.). When
// a queue item, signal admission, wakeup, channel inbox item, or current-run
// snapshot persists request context, it is normalized to canonical JSON and must
// be reproducible from trusted inputs: verified provider payload, resolved
// binding, authenticated resource, and explicit caller `app` metadata. Ambient
// process values such as live request objects, functions, SDK clients,
// non-deterministic timestamps, auth/user objects, workflow control markers, or
// class instances are rejected before admission unless they are converted to
// stable scalar fields under `app` or a named trusted slot.
interface RequestContextInput {
  app?: Record<string, JsonValue>;
}

interface TrustedRequestContextInput extends RequestContextInput {
  // Harness-owned channel metadata. Direct SDK/HTTP callers must not set this
  // field; non-channel routes reject it with `HarnessValidationError` before
  // session admission. It is populated only by the channel bridge,
  // scheduled/proactive channel work, or other harness-owned integration
  // code after provider verification and binding resolution.
  // `ChannelRequestContext` and its origin rules are defined in §14.3.
  channel?: ChannelRequestContext;
}

Request-context assembly precedence is canonical here only for source order; the
referenced sections remain the owners for their shapes. For a fresh entry point
(`message`, `queue`, `useSkill`, or an inbox response), the harness first
validates caller `requestContext.app` through the allowlist above and the §5.1
JSON/canonicalization profile. Omitted `app` means no application metadata for
that entry point, `{}` is an empty app bag, and explicit `null` values inside
`app` are data. The app bag is replaced per entry point; Harness v1 never
deep-merges app keys across turns, queue items, or inbox responses.

Trusted `channel` is attached only by Harness-owned integration paths after
their trust checks: channel ingress, scheduled/proactive channel work, and
channel action callbacks use §14.3 provider verification, binding resolution,
and binding-generation rules. Direct non-channel callers cannot supply it. For
queued, recovered, replayed, or resumed work, the runtime context starts from
the operation's persisted `PersistedRequestContextInput` (§5.1) rather than a
new caller object; recovery must not merge fresh caller `app` over that persisted
context. An inbox response's caller `requestContext.app` is scoped to the
response entry point and must not overwrite the pending run's persisted request
context unless a future storage shape explicitly records response context before
resume.

Runtime-only slots are rebuilt after durable `app` and trusted `channel` have
been established. Harness identity fields (`harnessName`, `sessionId`,
`threadId`, `resourceId`, `runId`, `harnessInstanceId`) and subagent linkage are
derived from the owning session/run tree, not request-context input, and no
request-context source may overwrite them. If an in-process compatibility path
accepts a live Mastra `RequestContext` object, Harness v1 treats it only as an
input envelope for the allowed durable fields and attaches runtime-only slots to
a detached per-execution context or overlay, not to the caller-owned object.
`app` and `channel` are top-level siblings; neither deep-merges into the other.
Admission and response hashes use the normalized DTOs before runtime slots are
attached. Runtime-only slots such as `harness`, `MastraMemory`, `browser`,
auth/user objects, workflow markers, SDK clients, workspace handles, abort
signals, `mastra__*`, and `__mastra*` are omitted from persisted request-context
rows, stable hashes, public read models, activity projections, wire responses,
and client-facing diagnostics; §5.1 owns the exact serialization, stable-hash,
and persisted-redaction rules.

Request-context ownership is split by boundary, not by alternate definitions:
this section owns caller `RequestContextInput`, trusted input allowlists, and
reserved-key rejection; §5.1 owns the persisted `PersistedRequestContextInput`
shape, JSON validation, and stable-hash canonicalization; §14.3 owns
`ChannelRequestContext` and channel-origin rules; §6.1 owns the tool-visible
`HarnessRequestContext` runtime projection. §13 route and wire text mirrors
these owners, and §15 verifies them without defining a second request-context
contract.

```
