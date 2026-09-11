---
'@mastra/core': minor
'@mastra/docker': minor
'@mastra/vercel': minor
'@mastra/e2b': minor
'@mastra/daytona': minor
'@mastra/cloudflare-sandbox': minor
---

Added an optional per-file `mode` to `WorkspaceSandbox.writeFiles` inputs so callers can set POSIX permissions (0o001–0o777) when provisioning files. The Docker sandbox applies the requested mode to each uploaded file, falling back to 0644 when omitted. Sandboxes that cannot honor an explicit mode reject the request instead of silently ignoring it. Closes #23580.
