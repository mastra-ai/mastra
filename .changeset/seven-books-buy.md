---
'@mastra/playground-ui': minor
---

Added reusable workflow cards, graph presentation, data inspectors, and debug controls with Storybook examples. Studio now uses the shared components while retaining workflow execution and streaming state.

```tsx
import { WorkflowStepCardView } from '@mastra/playground-ui/components/Workflow';

<WorkflowStepCardView label="Enrich customers" displayStatus="running" />;
```
