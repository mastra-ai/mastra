---
'@mastra/factory': minor
---

Factory storage now keeps a pool of model provider accounts per scope instead of one credential. Each personal (user) pool and Factory-wide (org) pool can hold several accounts for a provider, mixing API keys and OAuth subscriptions. A second sign-in no longer replaces the first.

`ModelCredentialsStorage` adds `listAccounts`, `getAccountCredential`, `addAccount`, `removeAccount`, `activateAccount`, `renameAccount`, `reorderAccounts`, `markAccountStatus` and `refreshAccountOAuth`. `listAccounts` returns summaries without tokens, ordered by `priority` and then creation time. `addAccount` puts a new account at the end of the pool. When it is given a provider `identity` that is already in the pool, it updates that account instead of adding a duplicate. `reorderAccounts` moves the listed accounts to the front in the order given and keeps the rest in their current order.

`getCredential`, `setCredential`, `resolveCredential`, `listCredentials` and `refreshOAuth` work as before by using each pool's active account. `removeCredential` now signs out of the active account only: the pool's other accounts stay, and the next one by priority becomes active. Existing credentials are copied at boot into one-account pools. Running the copy again, or on several replicas at once, is safe. The old `model_provider_credentials` table is deprecated and only read during this copy.
