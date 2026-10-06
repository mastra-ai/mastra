---
'@mastra/react': patch
---

`useChat` is now also available from `@mastra/react/chat`, an entry that does not pull in TanStack Query, and `useStreamWorkflow`, `useCreateWorkflowRun` and `useCancelWorkflowRun` from `@mastra/react/hooks/workflows`. Root imports from `@mastra/react` still work.

```tsx
// Before
import { useChat, useStreamWorkflow } from '@mastra/react';

// After
import { useChat } from '@mastra/react/chat';
import { useStreamWorkflow } from '@mastra/react/hooks/workflows';
```
