---
'@mastra/connect': patch
---

Fixed project-level Connect activity showing empty on the Mastra platform. @mastra/connect now sends its configured project id (MASTRA_PROJECT_ID or the projectId option) with every proxied provider request, so the platform can attribute tool and channel activity to the right project.

```typescript
import { tools } from '@mastra/connect';

// Uses MASTRA_PROJECT_ID by default; pass projectId to override.
const agentTools = tools({ projectId: 'proj_123' });
```
