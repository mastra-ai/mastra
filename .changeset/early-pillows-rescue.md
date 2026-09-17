---
'@mastra/playground-ui': minor
---

Added shared chat notifications, signals, skill activations and time gaps so Factory and Studio presentation can be designed together in Storybook. Shared model selection, model settings, composer actions, mode selection and voice controls now power the application adapters and interactive chat stories. Stories cover both application presentations, with a coverage inventory documenting the remaining app-specific surfaces and simulated behavior.

```tsx
import { ModelPicker } from '@mastra/playground-ui/components/ModelPicker';
import { ChatNotification, ChatSignal } from '@mastra/playground-ui/components/ai/chat-event';

<ModelPicker
  value={modelId}
  label={modelLabel}
  models={availableModels}
  onValueChange={setModelId}
/>
<ChatNotification label="factory" message="The work item moved to building." />
<ChatSignal variant="card" kind="state" label="workspace" message="The workspace is ready." />
```
