---
'@mastra/factory': patch
---

Scope the Platform GitHub event worker to the repositories linked to a Factory project instead of every repository a GitHub App installation exposes. The worker now derives its polling set from `sourceControlStorage.projectRepositories.listConfiguredExternalKeys()` — the same source of truth the reconciler already uses — and stops calling `GET /v1/server/github-app/installations` and `GET /v1/server/github-app/installations/:id/repositories` per tick.

Practical effect for a customer whose GitHub App installation exposes ~554 repos with 4 linked to Factory projects: `/events` polling drops from ~554 requests per tick to 4, the two per-tick installation-listing round trips are eliminated, and a proportional amount of downstream WorkOS `validateApiKey` load goes away. Repositories become polled/unpolled automatically on the next tick as project links are added or removed — no worker restart and no additional configuration required.
