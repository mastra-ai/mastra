---
'@mastra/playground-ui': minor
---

Added shared chat notifications, signals, skill activations, time gaps and pull request icons. Studio and Factory keep their event parsing and use these components for presentation. Component stories cover both the compact transcript rows and Studio notices and cards.

```tsx
import { ChatNotification, ChatSignal } from '@mastra/playground-ui/components/ai/chat-event';

<ChatNotification label="factory" message="The work item moved to building." />
<ChatSignal variant="card" kind="state" label="workspace" message="The workspace is ready." />
```
