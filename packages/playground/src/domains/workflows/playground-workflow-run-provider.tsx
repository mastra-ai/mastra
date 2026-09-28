import { WorkflowRunProvider } from '@mastra/playground-ui/domains/workflows/context/workflow-run-provider';
import type { ComponentProps } from 'react';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';

type PlaygroundWorkflowRunProviderProps = Omit<ComponentProps<typeof WorkflowRunProvider>, 'requestContext'>;

/** Feeds the playground's entity-scoped request context into the workflow run scope for workflow fetching. */
export function PlaygroundWorkflowRunProvider(props: PlaygroundWorkflowRunProviderProps) {
  return <WorkflowRunProvider {...props} requestContext={useEntityRequestContext('workflow', props.workflowId)[0]} />;
}
