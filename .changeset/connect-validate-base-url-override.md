---
'@mastra/connect': patch
---

Validate `baseUrlOverride` on the connection-proxy client before it is forwarded as a request header. Only absolute HTTPS URLs without embedded credentials are accepted; unparseable values, non-HTTPS schemes, and userinfo-bearing URLs are rejected with `invalid_options` so a compromised connection config cannot redirect authenticated proxy traffic to an unintended origin.
