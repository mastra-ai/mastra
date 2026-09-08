---
'@mastra/client-js': minor
---

Added typed optional author profiles to listFeedback(), without additional network requests. Profiles are available when the server authentication provider supports user lookup.

```ts
const result = await client.listFeedback();
// Before: only the stored author ID was typed.
console.log(result.feedback[0]?.feedbackUserId);
// Now: the resolved profile is also typed when available.
console.log(result.feedback[0]?.author?.name);
```
