---
'@mastra/server': patch
---

Fixed `getPublicOrigin` to parse only the first value from the `X-Forwarded-Host` header. When requests pass through multiple proxies, each proxy appends its host to the header, creating a comma-separated list. The previous code used the raw value, producing a malformed URL that broke OAuth redirect URIs. Now only the first (client-facing) host is used, per RFC 7239.
