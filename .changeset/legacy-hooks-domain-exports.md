---
'@mastra/react': patch
---

`useChat` is now also available from `@mastra/react/hooks/agents`, and `useStreamWorkflow`, `useCreateWorkflowRun` and `useCancelWorkflowRun` from `@mastra/react/hooks/workflows`. Root imports from `@mastra/react` still work.

```tsx
// Before
import { useChat, useStreamWorkflow } from '@mastra/react';

// After
import { useChat } from '@mastra/react/hooks/agents';
import { useStreamWorkflow } from '@mastra/react/hooks/workflows';
```
