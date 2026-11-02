---
'@mastra/code-sdk': minor
---

`CredentialStore` now supports pools whose accounts live outside the local `auth.json`, so a hosted credential store can rotate accounts on rate limits:

- `listAccounts` and `getActiveAccount` return the token-free `CredentialAccount` type (`AuthStorage` records still satisfy it).
- `activateAccount` may return a promise; callers await it.
- New optional `getAccountCredential(providerId, accountId)` reads one account's credential.
- `RotationCredentialStore` gains optional `markAccountUnavailable(providerId, accountId, reason)`.

Account switches are saved in the thread as a `data-mastracode-account-switch` part.
