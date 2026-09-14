# Mastra React

Use the root entry for agent hooks, workflow hooks, and UI components.

If your app only needs workflow hooks, import them from the workflow entry to avoid loading the UI components and their syntax-highlighting dependencies:

```tsx
import {
  MastraReactProvider,
  useCreateWorkflowRun,
  useStreamWorkflow,
  useCancelWorkflowRun,
} from '@mastra/react/workflow-hooks';
```

This entry exports the same provider, client hook, workflow hooks, and workflow types as the root package. Existing hook options and behavior are unchanged. A provider from either entry works with hooks from either entry. Continue importing UI components such as `WorkflowStepFactory` from `@mastra/react`.

To check the built package entries and their public types, run `pnpm build:js` followed by `pnpm test:package` from this directory.
