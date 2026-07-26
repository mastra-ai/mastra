---
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Give the Factory supervisor its tools on server-initiated runs. The supervisor resolved its tenant identity from the authenticated user on the request context, but runs the server starts itself — boot check-ins, idle worker observations, and approval notifications — build a fresh request context that carries no user. Those runs therefore woke the supervisor with none of its Factory tools registered, leaving it unable to query state or act on the very event that woke it. Tenant identity now comes from the supervisor session's own state, which is durable and pinned to the session's canonical resource and thread. A request user, when present, must still belong to the session's tenant and is used to attribute the resulting audit entries.
