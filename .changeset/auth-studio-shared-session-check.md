---
'@mastra/auth-studio': patch
---

Fixed sign-outs and extra platform calls when a page sends several requests at once. Requests that arrive together with the same session cookie now share one check with the Mastra platform. Before, each request checked the cookie on its own. When the session had expired, each one also tried to renew it with the same refresh token. The platform accepts a refresh token only once, so the other requests failed and could sign the user out.
