---
'@mastra/server': patch
---

Fix: Public origin resolution for AWS ALB deployments

Implement cascading header resolution in getPublicOrigin() to properly handle:

- X-Forwarded-Host (traditional reverse proxies) → always HTTPS
- Host header (AWS ALB with Preserve Host Header) → respect X-Forwarded-Proto or default HTTPS
- request.url (local development) → fallback

Fixes OAuth callback URLs being resolved to http:// instead of https:// when deployed behind AWS ALB with Preserve Host Header enabled.
