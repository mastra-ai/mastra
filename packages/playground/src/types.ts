import { AgentIcon, ToolsIcon, WorkflowIcon } from '@mastra/playground-ui';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: any;
  isError?: boolean;
}

export interface ChatProps {
  agentId: string;
  agentName?: string;
  threadId?: string;
  initialMessages?: Message[];
  memory?: boolean;
  url?: string;
}

export const ToolIconMap = {
  agent: AgentIcon,
  workflow: WorkflowIcon,
  tool: ToolsIcon,
};
