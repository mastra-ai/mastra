---
'@mastra/react': minor
---

Added a workflow-only entry that reuses the existing provider and hooks without loading UI components or syntax-highlighting dependencies.

```tsx
import {
  MastraReactProvider,
  useCreateWorkflowRun,
  useStreamWorkflow,
  useCancelWorkflowRun,
} from '@mastra/react/workflow-hooks';
```

Existing root imports remain supported and share the same provider context with the new entry.
