---
'@mastra/react': minor
---

Added the `@mastra/react/workflows` entrypoint for headless workflow lifecycle hooks and components in Expo and React Native applications.

```tsx
import { MastraWorkflowProvider, useStreamWorkflow } from '@mastra/react/workflows';
import { Button } from 'react-native';

function App() {
  return (
    <MastraWorkflowProvider baseUrl="https://example.com">
      <WorkflowScreen />
    </MastraWorkflowProvider>
  );
}

function WorkflowScreen() {
  const { streamWorkflow, streamResult } = useStreamWorkflow({ debugMode: false });
  const generate = () =>
    streamWorkflow.mutateAsync({
      workflowId: 'campaign-workflow',
      runId: 'run-1',
      inputData: { image: 'image.png' },
      requestContext: {},
    });

  return <Button title={streamResult.status ?? 'Generate'} onPress={generate} />;
}
```
