---
'@mastra/auth-okta': patch
---

Fix endpoint URL construction for Okta org authorization servers.

`MastraAuthOkta` concatenated `/v1/authorize` (and `/token`, `/keys`, `/logout`) directly onto `OKTA_ISSUER`. That yields the right endpoint for a custom authorization server (`https://{domain}/oauth2/default` → `.../oauth2/default/v1/authorize`), but 404s on an Okta org authorization server (`https://{domain}` → `.../v1/authorize`, whereas the real org endpoint is `.../oauth2/v1/authorize`).

An internal `endpointBase` is now derived from the issuer — verbatim when it already contains `/oauth2/`, otherwise `${issuer}/oauth2` — and used for the authorize, token, keys, and logout URLs. JWT `iss`-claim validation still uses the raw issuer so token validation stays correct on both server types. Trailing slashes on the issuer are also normalized so `OKTA_ISSUER=https://{domain}/` no longer produces `.../oauth2//v1/...`.
