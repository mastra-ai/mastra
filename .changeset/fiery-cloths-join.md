---
'@mastra/playground-ui': minor
---

Added shared Status and StatusDot components for consistent semantic status indicators.

```tsx
import { Status } from '@mastra/playground-ui/components/StatusIndicators';

<Status presentation={{ label: 'Running', tone: 'success', description: 'The server is live.' }} />;
```
