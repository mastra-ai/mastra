---
'@mastra/platform': patch
---

Parse structured proxy error payloads on `PlatformApiError`. Non-2xx responses that carry the workspace-proxy `{ error: { message, type } }` shape now expose `.code` (machine-readable kind, e.g. `not_found`, `authentication_error`, `invalid_request`) and `.proxyMessage` (human string) as first-class fields, so callers no longer need to `JSON.parse(error.body)` to branch on the failure kind. `.body` still carries the raw response text as a fallback, and `.code` / `.proxyMessage` stay `undefined` when the body isn't a matching JSON payload (e.g. an HTML 502 from a load balancer). New `PlatformProxyError` type is exported alongside.
