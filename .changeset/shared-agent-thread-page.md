---
'@mastra/playground-ui': minor
---

Expose the shared agent thread page, chat integration, and draft cleanup APIs for Studio and other hosts. Studio sign-out now clears the same draft controllers used by the shared composer, preventing pending edits from being restored after logout.

To clear drafts after a successful sign-out, pass the serialized API and user scope and await cleanup:

```ts
import { clearDraftsOnLogout } from '@mastra/playground-ui/domains/agents/chat';

await clearDraftsOnLogout(JSON.stringify([client.options.baseUrl, client.options.apiPrefix, userId]));
```
