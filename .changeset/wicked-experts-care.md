---
'@mastra/editor': patch
---

Fixed editor tool providers (Composio, Arcade) receiving a hardcoded 'default' userId. The userId is now read from `requestContext.get('userId')` and forwarded to `provider.resolveTools`, matching the documented behavior. Tool calls now scope correctly to the authenticated user.

```typescript
import { RequestContext } from '@mastra/core/request-context';

const ctx = new RequestContext();
ctx.set('userId', 'user-123');

await agent.generate('list my repos', { requestContext: ctx });
```
