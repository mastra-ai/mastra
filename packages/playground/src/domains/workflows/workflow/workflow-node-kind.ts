import type { WorkflowStepCardViewProps } from '@mastra/playground-ui/components/Workflow';
import type { ResolvedWorkflowStep } from '@mastra/react';

export function getWorkflowCardKind(step: ResolvedWorkflowStep): WorkflowStepCardViewProps['nodeKind'] {
  switch (step.kind) {
    case 'agent-step':
      return 'agent';
    case 'tool-step':
      return 'tool';
    case 'map-step':
      return 'map';
    case 'sleep-step':
      return 'delay';
    case 'sleep-until-step':
      return 'wait-until';
    default:
      return 'step';
  }
}
