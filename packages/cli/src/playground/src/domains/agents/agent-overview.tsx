import { GetAgentResponse } from '@mastra/client-js';
import { AgentPromptEnhancer } from './agent-instructions-enhancer';
import { ToolList } from './tool-list';
import { Txt } from '@mastra/playground-ui';
import { WorkflowList } from './workflow-list';
import { Link } from 'react-router';

export interface AgentOverviewProps {
  agent: GetAgentResponse;
  agentId: string;
}

export const AgentOverview = ({ agent, agentId }: AgentOverviewProps) => {
  return <AgentPromptEnhancer agentId={agentId} />;
};
