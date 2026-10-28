import type { ResolvedWorkflowStep } from '@mastra/react';
import type { WorkflowStepCardViewProps } from '@/ds/components/Workflow';

export function getWorkflowCardKind(step: ResolvedWorkflowStep): WorkflowStepCardViewProps['nodeKind'] {
  switch (step.kind) {
    case 'agent-step':
      return 'agent';
    case 'tool-step':
      return 'tool';
    case 'classifier-step':
      return 'classifier';
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
