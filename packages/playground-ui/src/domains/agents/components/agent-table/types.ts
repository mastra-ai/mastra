import { GetToolResponse } from '@mastra/client-js';

export type AgentTableData = {
  branch?: string;
  executedAt?: Date;
  modelId: string;
  id: string;
  name: string;
  provider: string;
  instructions: string;
  tools?: Record<string, GetToolResponse>;
  link: string;
};
