---
'@mastra/playground-ui': minor
---

Added a conversation replay action that previews turn counts, selects a history window, and creates or extends a dataset before opening an experiment. Choose **Independent turns** to import each completed turn as its own test case, or **Whole conversation** to import all completed turns as one item that carries the candidate's history and memory forward; the dialog shows the source turn count and only offers agent datasets.

```tsx
import { CreateReplayDatasetButton } from '@mastra/playground-ui/domains/threads/components/create-replay-dataset-button';

<CreateReplayDatasetButton source={{ agentId: 'support', threadId: 'golden-thread' }} />;
```
