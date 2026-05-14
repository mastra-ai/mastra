### 13.4l Background-Task Observation

**Background-task observation.** Remote Harness SDK helpers for background-task
list, get, and stream observation expose only server-scoped reads for ordinary
clients. They do not accept `resourceId`; the server derives that from the
authenticated Harness context and applies any agent/run/thread/task filters
inside that scope. Existing generic or admin client helpers that still expose
`resourceId` are not ordinary Harness client APIs unless they enforce the same
auth-derived scope. Unscoped or cross-resource task diagnostics are separate
operator/admin surfaces and require explicit operator authorization.
