---
'@mastra/server': minor
---

Added optional feedback author profiles using the configured authentication provider, without extra setup when user lookup is supported. Authenticated feedback writes now prefer the authenticated user ID; anonymous writes remain supported. Missing users and lookup failures never remove feedback records.

Before, HTTP feedback lists returned only the author ID. Now clients can read the optional profile from the same response:

```ts
const result = await client.listFeedback();
console.log(result.feedback[0]?.author?.name);
```
