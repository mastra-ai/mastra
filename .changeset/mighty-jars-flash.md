---
'@mastra/auth-studio': patch
---

Exposed the resolved shared API base as a public `sharedApiUrl` property on `MastraAuthStudio`, so callers can report which identity endpoint a deployment ended up talking to instead of re-deriving it from environment variables.

```ts
const auth = new MastraAuthStudio();
console.log(auth.sharedApiUrl); // https://platform.mastra.ai/v1
```
