---
'@mastra/server': patch
'@mastra/ai-sdk': patch
---

Fixed a client's own auth header being sent to the model provider. When a request body included `modelSettings.headers` with credentials such as `Authorization` (for example, an app forwarding its user's bearer token), that header was passed to the provider and overrode the `apiKey` configured on the server. Agent routes in `@mastra/server` and `handleChatStream`/`chatRoute` in `@mastra/ai-sdk` now drop credential headers (`authorization`, `proxy-authorization`, `x-api-key`, `api-key`, `x-goog-api-key`, `cookie`) from client-supplied `modelSettings.headers`. Other headers and body options are passed through unchanged.
