---
'@mastra/factory': minor
---

Each user and org can now keep several accounts per model provider, and Factory sessions switch to the next account automatically when one is rate-limited, out of quota or rejected. Previously a deployed Factory session used one credential per provider and failed the turn on a 429.

**Automatic switching.** The switch stays inside the pool routing picked (a Factory-wide session uses the org pool, a personal session uses the user pool) and tries accounts in priority order, wrapping once from the active account. API-key accounts rotate the same way as OAuth subscriptions. The limited account is marked as cooling down (rate limit: 1 minute, quota: 15 minutes) or `auth-failed`, so later requests skip it; cooling-down accounts are only tried after every healthy one. Each request keeps its own account selection, so concurrent requests do not fight over the shared active account. The transcript shows a notice naming the account or route it switched to and why, for example `Switched Anthropic account: Work Max → Personal Pro (rate limit)`.

**Adding accounts.** Signing in with OAuth, or saving an API key, adds an account to the pool and makes it active instead of replacing the one that is there. Signing in again to the same subscription, or saving the same key again, updates that account in place (same id, label and priority) and makes it active, as mastracode does on login. A sign-in matches an existing account by provider identity, then by legacy account id, then by refresh token. Providers without an identity (Anthropic, GitHub Copilot) only match when the same refresh token comes back, so a fresh sign-in usually adds another account. New accounts without a provider label are named "<Provider name> account N".

**Removing credentials.** `DELETE /web/config/providers/:provider/key` now removes only an API-key account (the active one, else the first by priority) and returns 404 `api_key_not_found` when the pool holds no key. `DELETE /web/config/providers/:provider/oauth` (sign out) removes only an OAuth account the same way and leaves API keys in place. The next account takes over.

**Model settings.** Once a provider has two or more accounts, its pool is shown under Personal defaults and Factory defaults: each account's name, whether it is a sign-in or a key, which one is active, and whether it is ready, cooling down (with the time it is back) or failing to authenticate. You can make an account active, rename it, remove it, and reorder it by dragging or with the move buttons. Every member manages their own Personal defaults pool. Org members who are not admins see the Factory defaults pool read-only (which account is active and its status) with no controls; only organization admins can change it.

**API.** New routes under `/web/config/providers/:provider/accounts` list the pool and activate, rename, remove and reorder accounts. Every route takes `?scope=user|org` (default `user`). Any org member can list the `org` pool; changing it requires an org admin (403 otherwise). Responses contain account metadata only, never tokens or keys.

```http
GET    /web/config/providers/openai/accounts?scope=org
POST   /web/config/providers/openai/accounts/:accountId/activate
PATCH  /web/config/providers/openai/accounts/:accountId      { "label": "Work" }
DELETE /web/config/providers/openai/accounts/:accountId
PUT    /web/config/providers/openai/accounts/order           { "orderedIds": ["..."] }
```
