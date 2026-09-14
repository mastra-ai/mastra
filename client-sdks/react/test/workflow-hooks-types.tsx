import {
  MastraReactProvider,
  useMastraClient,
  useCreateWorkflowRun,
  useCancelWorkflowRun,
  useStreamWorkflow,
} from '@mastra/react/workflow-hooks';
import type {
  MastraClientProviderProps,
  CreateWorkflowRunParams,
  CancelWorkflowRunParams,
  StreamWorkflowParams,
  WorkflowStreamResult,
} from '@mastra/react/workflow-hooks';

const createParams: CreateWorkflowRunParams = { workflowId: 'example' };
const cancelParams: CancelWorkflowRunParams = { workflowId: 'example', runId: 'run-1' };
const streamParams: StreamWorkflowParams = { ...cancelParams, inputData: {}, requestContext: {} };
const props: MastraClientProviderProps = { baseUrl: 'https://mastra.example', children: null };

export function WorkflowTypeConsumer() {
  const client = useMastraClient();
  const create = useCreateWorkflowRun();
  const cancel = useCancelWorkflowRun();
  const stream = useStreamWorkflow({ debugMode: false });
  const state: WorkflowStreamResult = stream.streamResult;
  void client.getWorkflow('example');
  void create.mutateAsync(createParams);
  void cancel.mutateAsync(cancelParams);
  void stream.streamWorkflow.mutateAsync(streamParams);
  // A missing or untyped declaration must not silently pass the consumer check.
  // @ts-expect-error workflowId is required
  void create.mutateAsync({});
  void state;
  return <MastraReactProvider {...props} />;
}
