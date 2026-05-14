### 13.4a RemoteSession

**`RemoteSession`** implements the wire-safe subset of `Session`'s methods (the
`RemoteSafeSession` interface — §2.6, §13.5). Each method either:

- POSTs/PATCHes/GETs to the corresponding route and returns the deserialized
result;
- composes the admission route, session event stream, and result lookup routes
  to preserve the local return shape under the §4.2 settlement contract;
  `message(...)`, untyped `useSkill(...)`, and `queue(...)` retain the server's
  admission metadata and reconcile replay gaps through the §13.2 / §13.3 result
  lookup boundary; or
- (for `subscribe`) opens an authenticated SSE connection to `/events`,
dispatches events to the listener, and returns an unsubscribe function. The
local-looking return shape is SDK sugar: it does not expose subscription tokens,
replay cursors, or SSE connection state; it also does not make SSE replay
durable or settle operations outside the matching terminal event / result-lookup
boundary.

Methods listed in §13.5 are absent from the relevant remote type. For example,
raw `getWorkspace`, function-valued `addTools`, the functional form of
`setState`, and `refreshSkills` are absent from `RemoteSession`; `onInterval`
and cross-session subscriptions are absent from the remote harness type.
Reaching for them remotely fails to type-check.
