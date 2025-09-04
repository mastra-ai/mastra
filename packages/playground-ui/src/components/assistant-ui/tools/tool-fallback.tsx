import { ToolCallMessagePartComponent } from '@assistant-ui/react';

import { useAgent } from '../context/agent-provider';
import { ToolBadge } from './badges/tool-badge';
import { WorkflowBadge } from './badges/workflow-badge';

export const ToolFallback: ToolCallMessagePartComponent = ({ toolName, argsText, result, ...props }) => {
  const { agentDetails, isLoading } = useAgent();
  const workflow = agentDetails?.workflows[toolName];

  if (isLoading) return null;

  if (workflow) {
    return <WorkflowBadge workflowId={toolName} workflow={workflow} result={result} />;
  }

  return <ToolBadge toolName={toolName} argsText={argsText} result={result} />;
};
