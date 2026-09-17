---
'@mastra/playground-ui': minor
---

Added shared chat notifications, signals, skill activations and time gaps so Factory and Studio presentation can be designed together in Storybook. The complete chat stories include both application presentations and their interactive states.

```tsx
import { ChatNotification, ChatSignal } from '@mastra/playground-ui/components/ai/chat-event';

<ChatNotification label="factory" message="The work item moved to building." />
<ChatSignal variant="card" kind="state" label="workspace" message="The workspace is ready." />
```
