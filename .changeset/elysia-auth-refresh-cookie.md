---
'@mastra/elysia': patch
---

Fixed `createAuthMiddleware` dropping the refreshed session `Set-Cookie` after a transparent session refresh. Raw Elysia routes protected by `createAuthMiddleware` now send the refreshed session headers on both allowed and denied (401/403) responses, alongside any cookies the route sets through `ctx.cookie`, `set.headers`, or a returned `Response`. Previously the refreshed cookie was lost, which could log users out or revoke sessions that use single-use refresh tokens.
