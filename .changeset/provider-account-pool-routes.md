---
'@mastra/factory': minor
---

Factory now lets each user and org keep several accounts per model provider and manage them from the API.

Signing in with OAuth, or saving an API key, adds an account to the pool instead of replacing the one that is there. Signing in again to the same subscription (same provider account), or saving the same key again, updates that account instead of adding a duplicate.

New routes under `/web/config/providers/:provider/accounts` list the pool and let you activate, rename, remove and reorder accounts. Every route takes `?scope=user|org` (default `user`); `org` requires an org admin. Responses contain account metadata only, never tokens or keys.

```http
GET    /web/config/providers/openai/accounts?scope=org
POST   /web/config/providers/openai/accounts/:accountId/activate
PATCH  /web/config/providers/openai/accounts/:accountId      { "label": "Work" }
DELETE /web/config/providers/openai/accounts/:accountId
PUT    /web/config/providers/openai/accounts/order           { "orderedIds": ["..."] }
```
