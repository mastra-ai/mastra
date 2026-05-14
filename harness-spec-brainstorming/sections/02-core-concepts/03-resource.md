### 2.3 Resource

A `resourceId` represents a tenant — usually a user or a logical owner.
**Threads and sessions are both single-tenant inside one registered Harness**:
every thread has exactly one `resourceId`, and every session inherits its
thread's `resourceId`. This is a hard isolation boundary, not a hint.
`(harnessName, resourceId, threadId)` defines the active session ownership key:
there can be only one active session for a live thread at a time (§2.2).

Caller-visible thread and session lookup are resolved inside the calling
Harness's immutable `harnessName` namespace. On multi-tenant, multi-harness, or
remote-callable paths, the harness must have a trusted `resourceId` for lookup
before it returns a thread/session or applies a destructive operation.
`threadId` and `sessionId` are globally unique physical IDs within the Harness
namespace, but they are not sufficient tenant or harness authority across
boundaries. Single-tenant deployments and explicit operator/admin tooling may
use the ID-only session forms defined by §4.1 and §5.5; those forms are not a
cross-tenant or cross-harness authority. Storage primitives may accept just
`threadId` / `sessionId` for harness-internal operations (cascade-delete,
migrations, admin tools), but the harness layer always scopes to its registered
`harnessName` and cross-checks `resourceId` before surfacing records or applying
destructive work.

A tenant or harness mismatch is treated identically to "does not exist" — the
harness throws `HarnessSessionNotFoundError` for sessions and returns `null` (or
`404` over the wire) for threads. **Cross-tenant and cross-harness access never
returns 403 — it returns 404, so existence isn't leaked.** This tenant-safe
not-found boundary is distinct from `HarnessForbiddenError` (§4.5), which
applies after authentication succeeds for a known resource but the principal
lacks authorization for a specific action.

Exact API overloads and method-specific lookup behavior belong to §4.1.
Destructive close/delete ordering belongs to §5.5, but it preserves the same
resource cross-check: a resource mismatch is tenant-safe not-found before
close/delete, force-delete, ledger cleanup, or closed-record handling is
evaluated. Subagent sessions inherit the parent's `resourceId` and are
addressable only under that resource; subagent creation and traversal mechanics
live in §5.6 and §8.

In server deployments, the route or registry first resolves the intended
`harnessName`, then `resourceId` is resolved server-side from auth context.
Clients never send `resourceId` themselves (see §13.2).

Channel integrations follow the same tenancy rule, but the trusted authority is
the configured channel bridge and registry rather than browser auth. A platform
payload never becomes a trusted `resourceId` just because it contains a user ID
or thread ID. The bridge resolves a trusted binding, resource, and session
before runtime admission; binding modes, multi-user resource mapping, durable
ingress, and channel actor context live in §14.1, §14.2, and §14.3.
