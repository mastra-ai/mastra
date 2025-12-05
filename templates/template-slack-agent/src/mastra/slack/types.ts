import type { WebClient } from '@slack/web-api';
import type { Mastra } from '@mastra/core/mastra';

export interface StreamingOptions {
  mastra: Mastra;
  slackClient: WebClient;
  channel: string;
  threadTs: string;
  agentName: string;
  message: string;
  resourceId: string;
  threadId: string;
}

export type Status = 'thinking' | 'routing' | 'tool_call' | 'workflow_step' | 'agent_call' | 'responding';

export interface StreamState {
  text: string;
  status: Status;
  toolName?: string;
  workflowName?: string;
  stepName?: string;
  agentName?: string;
}
