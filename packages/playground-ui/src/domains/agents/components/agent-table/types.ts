import { GetAgentResponse, GetToolResponse } from '@mastra/client-js';

export type AgentTableData = GetAgentResponse & {
  id: string;
};
