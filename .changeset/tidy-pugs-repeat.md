---
'@mastra/server': patch
---

Resolve the public origin from `X-Mastra-Public-Host` when present, ahead of `X-Forwarded-Host`.

Gateways that overwrite `X-Forwarded-Host` with their own internal domain (Railway's does) left `getPublicOrigin()` resolving an internal hostname, so deployed apps built OAuth callback URIs like `https://my-project-qa-qa.up.railway.app/api/auth/sso/callback` and sign-in failed against providers that validate the redirect URI. The same mis-resolved origin also failed the same-origin check on `redirect_uri`, silently collapsing the post-login landing page to `/`.
