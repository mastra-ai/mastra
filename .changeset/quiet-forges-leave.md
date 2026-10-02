---
'@mastra/auth-okta': patch
---

`MastraRBACOkta` now calls the Okta groups API directly with `fetch` instead of going through `@okta/okta-sdk-nodejs`. It pages through the `Link` header and only follows links on your Okta org. Behavior is unchanged, but the package no longer pulls in `node-jose` and `node-forge`, which has an unfixed signature-forgery advisory (CVE-2026-85393).
