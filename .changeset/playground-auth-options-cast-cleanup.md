---
'@internal/playground': patch
---

Removed the cosmetic `as any` casts on `client.options` across the Studio auth hooks (`use-auth-actions`, `use-auth-capabilities`, `use-credentials-login`, `use-credentials-signup`, `use-current-user`). `useMastraClient()` already returns a typed `MastraClient` whose `options: ClientOptions` field is public, so the casts were unnecessary. The `makeSSOLoginRequest` and `makeLogoutRequest` helper signatures were also tightened from `{ options: any }` to `MastraClient`. No runtime change. Closes [#16655](https://github.com/mastra-ai/mastra/issues/16655).
