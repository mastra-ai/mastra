---
'@mastra/code-sdk': patch
---

Moved the account pool rules out of the file-backed auth storage into `@mastra/code-sdk/auth/account-registry`, so other credential stores can share the same deduping, rotation order and active-account rules. Account-switch and model-fallback notice types and formatters now live in `@mastra/code-sdk/auth/account-switch`, which has no Node.js imports and can be used in the browser. Existing imports from `@mastra/code-sdk/auth/account-rotation-processor` keep working.

Each pool account now has a `priority` that sets the order accounts are tried when one hits a rate limit. Lower numbers go first, and new accounts go last. Use `AuthStorage.reorderAccounts(providerId, orderedIds)` to change the order. Existing `auth.json` pools get priorities in their current order, so rotation stays the same.
