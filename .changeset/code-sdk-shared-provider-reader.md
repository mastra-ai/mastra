---
'@mastra/code-sdk': patch
'mastracode': patch
---

An exhausted provider quota now shows its own error and a hint to check the account's billing or usage allowance, instead of being reported as a rate limit with "Wait a moment and try again".

Account rotation and transient server error detection now read failures through the shared provider error reader in `@mastra/core/error`. A credential, usage or rate-limit failure named only in a provider's response body or stream frame now rotates to the next account, and an overloaded stream frame is retried as a server error.
