import type { AgentTool } from '../../../types/agent-tool';
import { ToolsDetail } from '../details/tools-detail';

export interface ToolsProps {
  availableAgentTools: AgentTool[];
  editable?: boolean;
  /** Disables interaction (e.g. while a stream is running). */
  disabled?: boolean;
}

export const Tools = ({ availableAgentTools, editable = true, disabled = false }: ToolsProps) => {
  return <ToolsDetail editable={editable && !disabled} availableAgentTools={availableAgentTools} />;
};
