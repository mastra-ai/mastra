import type { GetAgentResponse } from '@mastra/client-js';

export type AgentTableData = GetAgentResponse & {
  id: string;
};
