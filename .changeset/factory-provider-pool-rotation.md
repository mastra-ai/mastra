---
'@mastra/factory': minor
'@mastra/code-sdk': minor
---

Factory sessions now switch to the next account in a provider pool when the current one is rate-limited, out of quota or rejected. Previously a deployed Factory session used one credential per provider and failed the turn on a 429.

The switch stays inside the pool routing picked (a Factory-wide session uses the org pool, a personal session uses the user pool) and tries accounts in priority order, wrapping once from the active account. API-key accounts rotate the same way as OAuth subscriptions. The limited account is marked as cooling down (rate limit: 1 minute, quota: 15 minutes) or `auth-failed`, so later requests skip it; cooling-down accounts are only tried after every healthy one. Each request keeps its own account selection, so concurrent requests do not fight over the shared active account. The switch is saved in the thread as a `data-mastracode-account-switch` part.

`CredentialStore` changes in `@mastra/code-sdk`:

- `listAccounts` and `getActiveAccount` return the token-free `CredentialAccount` type (`AuthStorage` records still satisfy it).
- `activateAccount` may return a promise; callers await it.
- New optional `getAccountCredential(providerId, accountId)` reads one account's credential.
- `RotationCredentialStore` gains optional `markAccountUnavailable(providerId, accountId, reason)`.
