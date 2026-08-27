---
'@mastra/code-sdk': patch
---

Added Cursor subscription authentication and token refresh.

```ts
import { cursorOAuthProvider } from '@mastra/code-sdk/auth/index';

const credentials = await cursorOAuthProvider.login({
  onAuth: ({ url }) => console.log(`Open ${url}`),
  onPrompt: async () => '',
});
```
