---
'@mastra/playground-ui': minor
---

Added a conversation replay action that previews turn counts, selects a history window, and creates or extends a dataset before opening an experiment.

```tsx
import { CreateReplayDatasetButton } from '@mastra/playground-ui/domains/threads/components/create-replay-dataset-button';

<CreateReplayDatasetButton source={{ agentId: 'support', threadId: 'golden-thread' }} />;
```
