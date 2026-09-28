import { WorkflowRunProvider } from '@mastra/playground-ui/domains/workflows/context/workflow-run-provider';
import type { ComponentProps } from 'react';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';

type PlaygroundWorkflowRunProviderProps = Omit<ComponentProps<typeof WorkflowRunProvider>, 'requestContext'>;

/** Feeds the playground's merged request context into the workflow run scope for workflow fetching. */
export function PlaygroundWorkflowRunProvider(props: PlaygroundWorkflowRunProviderProps) {
  return <WorkflowRunProvider {...props} requestContext={useMergedRequestContext()} />;
}
