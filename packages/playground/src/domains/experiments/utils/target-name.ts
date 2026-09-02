import type { DatasetExperiment, GetAgentResponse, GetScorerResponse, GetWorkflowResponse } from '@mastra/client-js';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { ProcessorIcon } from '@mastra/playground-ui/icons/ProcessorIcon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';

export const TARGET_ICON = {
  agent: AgentIcon,
  workflow: WorkflowIcon,
  scorer: ScorersIcon,
  processor: ProcessorIcon,
} as const;

export const TARGET_LABEL = {
  agent: 'Agent',
  workflow: 'Workflow',
  scorer: 'Scorer',
  processor: 'Processor',
} as const;

export const EXTERNAL_TARGET_LABEL = 'External (caller-run)';

export interface TargetRegistries {
  agents?: Record<string, GetAgentResponse>;
  workflows?: Record<string, GetWorkflowResponse>;
  scorers?: Record<string, GetScorerResponse>;
}

/** Human-readable name of the experiment target, falling back to the raw id. */
export function resolveTargetName(
  experiment: Pick<DatasetExperiment, 'targetType' | 'targetId'>,
  { agents, workflows, scorers }: TargetRegistries,
): string {
  const { targetType, targetId } = experiment;
  if (!targetId) return EXTERNAL_TARGET_LABEL;
  switch (targetType) {
    case 'agent':
      return agents?.[targetId]?.name ?? targetId;
    case 'workflow':
      return workflows?.[targetId]?.name ?? targetId;
    case 'scorer':
      return scorers?.[targetId]?.scorer?.config?.name ?? targetId;
    default:
      return targetId;
  }
}
