---
'@mastra/code-sdk': minor
---

You can now set the order in which pool accounts are tried when one hits a rate limit. Each account has a `priority`: lower numbers go first, and new accounts go last. Existing `auth.json` pools get priorities in their current order, so rotation stays the same. Loading an existing `auth.json` does not rewrite it; priorities are saved with the next change to the pool.

```ts
import { AuthStorage } from '@mastra/code-sdk/auth/storage';

const storage = new AuthStorage();
const [first, ...rest] = storage.listAccounts('anthropic');

// Move the first account to the end of the switch order.
// Reordering does not change which account is active.
if (first) {
  storage.reorderAccounts(
    'anthropic',
    [...rest, first].map(account => account.id),
  );
}
```

`renameAccount(providerId, accountId, label)` now only renames an account that belongs to `providerId`. Before, an id from another provider's pool was renamed too.

The pool rules (deduping, switch order, active account) now live in `@mastra/code-sdk/auth/account-registry` so other credential stores can share them. Account-switch and model-fallback notice types and formatters live in `@mastra/code-sdk/auth/account-switch`, which has no Node.js imports and can be used in the browser. Existing imports from `@mastra/code-sdk/auth/account-rotation-processor` keep working.
