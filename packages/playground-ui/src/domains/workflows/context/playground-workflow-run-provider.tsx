import type { ComponentProps } from 'react';
import { useEntityRequestContext } from '../../request-context/hooks/use-entity-request-context';
import { useEntityTracingOptions } from '../../run-options/hooks/use-entity-tracing-options';
import { WorkflowRunProvider } from './workflow-run-provider';

type PlaygroundWorkflowRunProviderProps = Omit<
  ComponentProps<typeof WorkflowRunProvider>,
  'requestContext' | 'tracingOptions'
>;

/** Feeds the playground's entity-scoped request context into the workflow run scope for workflow fetching. */
export function PlaygroundWorkflowRunProvider(props: PlaygroundWorkflowRunProviderProps) {
  return (
    <WorkflowRunProvider
      {...props}
      requestContext={useEntityRequestContext('workflow', props.workflowId)[0]}
      tracingOptions={useEntityTracingOptions('workflow', props.workflowId)[0]}
    />
  );
}
