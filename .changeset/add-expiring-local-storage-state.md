---
'@mastra/playground-ui': patch
---

Add `useExpiringLocalStorageState` hook that persists a value under a localStorage key with an expiration date. The value is returned until it expires; afterwards the hook returns `undefined` with `expired: true` and removes the entry.
